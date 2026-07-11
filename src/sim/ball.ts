import type { Vec3 } from "./vec";
import { length } from "./vec";
import {
  BALL_RADIUS,
  DRAG_K,
  GOAL_HALF,
  GOAL_HEIGHT,
  GRAVITY,
  KEEPER_DEPTH,
  KEEPER_HALF_REACH,
  KEEPER_HEIGHT,
  MAGNUS_K,
  NET_DEPTH,
  POST_RADIUS,
  SPIN_DECAY,
  SPIN_SURFACE_KICK,
  WALL_HEIGHT,
  WIND_PUSH_K,
} from "./world";
import type { WallPlacement } from "../levels/levels";

export type BallEvent = "wall" | "post" | "crossbar" | "keeper" | "goal";

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/**
 * Simulação do voo da bola: gravidade, arrasto relativo ao vento e
 * efeito Magnus (spin lateral). Colisões contra chão, barreira, goleiro
 * (móvel) e traves/travessão tratadas como cilindros com detecção
 * contínua (segmento do passo × eixo do cilindro) e troca de spin.
 */
export class BallSim {
  p: Vec3;
  v: Vec3;
  spinZ: number;
  scored = false;
  done = false;
  events: BallEvent[] = [];
  /** Ponto (lateral, altura) onde a bola cruzou a linha do gol. */
  crossing: { x: number; z: number } | null = null;
  /** Amostras da trajetória para desenhar o rastro. */
  trail: Vec3[] = [];

  private t = 0;
  private stepCount = 0;

  constructor(
    start: { x: number; y: number },
    kickV: Vec3,
    spinZ: number,
    private dip: number,
    private wind: { x: number; y: number },
    private wall: WallPlacement,
  ) {
    this.p = { x: start.x, y: start.y, z: BALL_RADIUS };
    this.v = { ...kickV };
    this.spinZ = spinZ;
  }

  step(dt: number, keeperX: number): void {
    if (this.done) return;
    this.t += dt;

    const prev = { ...this.p };

    // Arrasto relativo ao ar: o vento entra como velocidade do ar.
    const rx = this.v.x - this.wind.x;
    const ry = this.v.y - this.wind.y;
    const rz = this.v.z;
    const rel = Math.hypot(rx, ry, rz);
    this.v.x -= DRAG_K * rel * rx * dt;
    this.v.y -= DRAG_K * rel * ry * dt;
    // Topspin (dip) só age com a bola no ar.
    const airborne = this.p.z > BALL_RADIUS * 1.5;
    this.v.z -= (GRAVITY + (airborne ? this.dip : 0) + DRAG_K * rel * rz) * dt;

    // Vento empurrando diretamente (além do arrasto relativo): com
    // vendaval, a bola faz trajetórias cômicas — é feature.
    if (this.p.z > BALL_RADIUS * 2) {
      this.v.x += WIND_PUSH_K * this.wind.x * dt;
      this.v.y += WIND_PUSH_K * this.wind.y * dt;
    }

    // Magnus: acelera perpendicular à velocidade horizontal.
    this.v.x += MAGNUS_K * this.spinZ * -this.v.y * dt;
    this.v.y += MAGNUS_K * this.spinZ * this.v.x * dt;
    this.spinZ *= Math.max(0, 1 - SPIN_DECAY * dt);

    this.p.x += this.v.x * dt;
    this.p.y += this.v.y * dt;
    this.p.z += this.v.z * dt;

    this.collideGround();
    if (!this.scored) {
      this.collideWall(prev);
      this.collideKeeper(prev, keeperX);
      const hitFrame = this.collidePosts(prev) || this.collideCrossbar(prev);
      if (!hitFrame) this.checkGoalLine(prev);
    } else {
      // Dentro da rede: freia rápido e não sai do fundo.
      const brake = Math.max(0, 1 - 6 * dt);
      this.v.x *= brake;
      this.v.y *= brake;
      if (this.p.y < -NET_DEPTH) {
        this.p.y = -NET_DEPTH;
        this.v.y = 0;
      }
    }

    if (this.stepCount++ % 5 === 0) this.trail.push({ ...this.p });
    this.checkDone();
  }

  private collideGround(): void {
    if (this.p.z < BALL_RADIUS) {
      this.p.z = BALL_RADIUS;
      if (this.v.z < 0) {
        this.v.z = Math.abs(this.v.z) > 1 ? -this.v.z * 0.45 : 0;
      }
      // atrito de rolagem
      this.v.x *= 0.99;
      this.v.y *= 0.99;
    }
  }

  /** Interpola o ponto onde o passo cruzou o plano y = planeY. */
  private crossPoint(prev: Vec3, planeY: number): { x: number; z: number } | null {
    if (!(prev.y > planeY && this.p.y <= planeY)) return null;
    const f = (prev.y - planeY) / (prev.y - this.p.y);
    return {
      x: prev.x + (this.p.x - prev.x) * f,
      z: prev.z + (this.p.z - prev.z) * f,
    };
  }

  private collideWall(prev: Vec3): void {
    const hit = this.crossPoint(prev, this.wall.y);
    if (!hit) return;
    if (Math.abs(hit.x - this.wall.x) < this.wall.halfWidth + BALL_RADIUS && hit.z < WALL_HEIGHT) {
      this.events.push("wall");
      this.p.y = this.wall.y + 0.05;
      this.p.x = hit.x;
      this.p.z = Math.max(hit.z, BALL_RADIUS);
      this.v.y = -this.v.y * 0.35;
      this.v.x *= 0.5;
      this.v.z = Math.abs(this.v.z) * 0.5; // pipoca para cima
      this.spinZ *= 0.4;
    }
  }

  private collideKeeper(prev: Vec3, keeperX: number): void {
    const hit = this.crossPoint(prev, KEEPER_DEPTH);
    if (!hit) return;
    const dx = hit.x - keeperX;
    if (Math.abs(dx) < KEEPER_HALF_REACH + BALL_RADIUS && hit.z < KEEPER_HEIGHT) {
      this.events.push("keeper");
      this.p.y = KEEPER_DEPTH + 0.05;
      this.p.x = hit.x;
      this.p.z = Math.max(hit.z, BALL_RADIUS);
      this.v.y = -this.v.y * 0.3;
      this.v.x = Math.sign(dx || 1) * Math.max(Math.abs(this.v.x) * 0.5, 2);
      this.v.z *= 0.4;
      this.spinZ *= 0.4;
    }
  }

  /**
   * Traves verticais como cilindros: distância mínima do segmento do
   * passo (no plano do chão) ao eixo da trave. Reflete na normal do
   * ponto de contato, com atrito tangencial e troca com o spin — é o
   * que faz a bola sair da trave em direções diferentes conforme o
   * jeito que bate.
   */
  private collidePosts(prev: Vec3): boolean {
    const R = POST_RADIUS + BALL_RADIUS;
    for (const px of [-GOAL_HALF, GOAL_HALF]) {
      const ax = prev.x - px;
      const ay = prev.y;
      const dx = this.p.x - prev.x;
      const dy = this.p.y - prev.y;
      const len2 = dx * dx + dy * dy;
      const t = clamp01(len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0);
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const d = Math.hypot(cx, cy);
      const zAt = prev.z + (this.p.z - prev.z) * t;
      if (d >= R || zAt >= GOAL_HEIGHT + POST_RADIUS) continue;

      const nx = d > 1e-6 ? cx / d : 1;
      const ny = d > 1e-6 ? cy / d : 0;
      this.p.x = px + nx * R;
      this.p.y = ny * R;
      this.p.z = Math.max(zAt, BALL_RADIUS);

      const vn = this.v.x * nx + this.v.y * ny;
      if (vn < 0) {
        const e = 0.72;
        this.v.x -= (1 + e) * vn * nx;
        this.v.y -= (1 + e) * vn * ny;
        // Atrito na superfície: parte da velocidade tangencial se perde
        // e o spin empurra a bola ao longo da trave.
        const tx = -ny;
        const ty = nx;
        const vt = this.v.x * tx + this.v.y * ty;
        const newVt = vt * 0.85 + this.spinZ * SPIN_SURFACE_KICK;
        this.v.x += (newVt - vt) * tx;
        this.v.y += (newVt - vt) * ty;
        this.spinZ *= 0.5;
      }
      this.events.push("post");
      return true;
    }
    return false;
  }

  /** Travessão: cilindro horizontal ao longo de x, em (y=0, z=altura do gol). */
  private collideCrossbar(prev: Vec3): boolean {
    const R = POST_RADIUS + BALL_RADIUS;
    const ay = prev.y;
    const az = prev.z - GOAL_HEIGHT;
    const dy = this.p.y - prev.y;
    const dz = this.p.z - prev.z;
    const len2 = dy * dy + dz * dz;
    const t = clamp01(len2 > 0 ? -(ay * dy + az * dz) / len2 : 0);
    const cy = ay + dy * t;
    const cz = az + dz * t;
    const d = Math.hypot(cy, cz);
    const xAt = prev.x + (this.p.x - prev.x) * t;
    if (d >= R || Math.abs(xAt) >= GOAL_HALF + POST_RADIUS) return false;

    const ny = d > 1e-6 ? cy / d : 1;
    const nz = d > 1e-6 ? cz / d : 0;
    this.p.x = xAt;
    this.p.y = ny * R;
    this.p.z = GOAL_HEIGHT + nz * R;

    const vn = this.v.y * ny + this.v.z * nz;
    if (vn < 0) {
      const e = 0.7;
      this.v.y -= (1 + e) * vn * ny;
      this.v.z -= (1 + e) * vn * nz;
      this.spinZ *= 0.6;
    }
    this.events.push("crossbar");
    return true;
  }

  private checkGoalLine(prev: Vec3): void {
    const hit = this.crossPoint(prev, 0);
    if (!hit) return;
    if (Math.abs(hit.x) < GOAL_HALF && hit.z < GOAL_HEIGHT) {
      this.scored = true;
      this.crossing = hit;
      this.events.push("goal");
    }
    // Senão: passou por fora/por cima — segue até sair do campo.
  }

  private checkDone(): void {
    const speed = length(this.v);
    if (this.scored) {
      this.done = speed < 0.4 || this.t > 6;
      return;
    }
    // Lance morto: bola voltando do rebote ou já atrás do gol sem entrar —
    // corta cedo para rearmar a cobrança rápido.
    const deadRebound = this.t > 0.25 && this.v.y > 2.5;
    const behindGoal = this.p.y < -1.2;
    this.done =
      deadRebound ||
      behindGoal ||
      this.t > 7 ||
      Math.abs(this.p.x) > 25 ||
      (speed < 0.3 && this.p.z <= BALL_RADIUS + 0.01);
  }
}

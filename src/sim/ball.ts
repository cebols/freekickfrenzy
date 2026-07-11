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
  NET_DEPTH,
  POST_RADIUS,
  WALL_HEIGHT,
} from "./world";
import type { WallPlacement } from "../levels/levels";

export type BallEvent = "wall" | "post" | "crossbar" | "keeper" | "goal";

export interface Obstacles {
  wall: WallPlacement;
  keeperX: number;
}

/**
 * Simulação do voo da bola. Integra gravidade + arrasto e resolve as
 * colisões contra chão, barreira, goleiro, traves e plano do gol.
 * (Magnus/efeito e vento entram na próxima etapa, como forças extras aqui.)
 */
export class BallSim {
  p: Vec3;
  v: Vec3;
  scored = false;
  done = false;
  events: BallEvent[] = [];
  /** Ponto (lateral, altura) onde a bola cruzou a linha do gol. */
  crossing: { x: number; z: number } | null = null;

  private t = 0;

  constructor(
    start: { x: number; y: number },
    velocity: Vec3,
    private obstacles: Obstacles,
  ) {
    this.p = { x: start.x, y: start.y, z: BALL_RADIUS };
    this.v = { ...velocity };
  }

  step(dt: number): void {
    if (this.done) return;
    this.t += dt;

    const prev = { ...this.p };

    // Forças: gravidade + arrasto aerodinâmico (quadrático).
    const speed = length(this.v);
    this.v.x -= DRAG_K * speed * this.v.x * dt;
    this.v.y -= DRAG_K * speed * this.v.y * dt;
    this.v.z -= (GRAVITY + DRAG_K * speed * this.v.z) * dt;

    this.p.x += this.v.x * dt;
    this.p.y += this.v.y * dt;
    this.p.z += this.v.z * dt;

    this.collideGround();
    if (!this.scored) {
      this.collideWall(prev);
      this.collideKeeper(prev);
      this.collideGoalPlane(prev);
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

  /** Interpola o ponto onde o movimento cruzou o plano y = planeY. */
  private crossPoint(prev: Vec3, planeY: number): { x: number; z: number } | null {
    if (!(prev.y > planeY && this.p.y <= planeY)) return null;
    const f = (prev.y - planeY) / (prev.y - this.p.y);
    return {
      x: prev.x + (this.p.x - prev.x) * f,
      z: prev.z + (this.p.z - prev.z) * f,
    };
  }

  private collideWall(prev: Vec3): void {
    const { wall } = this.obstacles;
    const hit = this.crossPoint(prev, wall.y);
    if (!hit) return;
    if (Math.abs(hit.x - wall.x) < wall.halfWidth + BALL_RADIUS && hit.z < WALL_HEIGHT) {
      this.events.push("wall");
      this.p.y = wall.y + 0.05;
      this.p.x = hit.x;
      this.p.z = Math.max(hit.z, BALL_RADIUS);
      this.v.y = -this.v.y * 0.35;
      this.v.x *= 0.5;
      this.v.z = Math.abs(this.v.z) * 0.5; // pipoca para cima
    }
  }

  private collideKeeper(prev: Vec3): void {
    const hit = this.crossPoint(prev, KEEPER_DEPTH);
    if (!hit) return;
    const dx = hit.x - this.obstacles.keeperX;
    if (Math.abs(dx) < KEEPER_HALF_REACH + BALL_RADIUS && hit.z < KEEPER_HEIGHT) {
      this.events.push("keeper");
      this.p.y = KEEPER_DEPTH + 0.05;
      this.p.x = hit.x;
      this.p.z = Math.max(hit.z, BALL_RADIUS);
      this.v.y = -this.v.y * 0.3;
      this.v.x = Math.sign(dx || 1) * Math.max(Math.abs(this.v.x) * 0.5, 2);
      this.v.z *= 0.4;
    }
  }

  private collideGoalPlane(prev: Vec3): void {
    const hit = this.crossPoint(prev, 0);
    if (!hit) return;

    const postHitR = POST_RADIUS + BALL_RADIUS;

    // Traves verticais
    for (const px of [-GOAL_HALF, GOAL_HALF]) {
      if (Math.abs(hit.x - px) < postHitR && hit.z < GOAL_HEIGHT + POST_RADIUS) {
        this.events.push("post");
        this.bounceBack(hit, 0.55);
        return;
      }
    }

    // Travessão
    if (Math.abs(hit.z - GOAL_HEIGHT) < postHitR && Math.abs(hit.x) < GOAL_HALF + POST_RADIUS) {
      this.events.push("crossbar");
      this.bounceBack(hit, 0.5);
      this.v.z = -Math.abs(this.v.z) * 0.6;
      return;
    }

    if (Math.abs(hit.x) < GOAL_HALF - postHitR && hit.z < GOAL_HEIGHT - postHitR) {
      this.scored = true;
      this.crossing = hit;
      this.events.push("goal");
    }
    // Senão: passou por fora/por cima — segue até sair do campo.
  }

  private bounceBack(hit: { x: number; z: number }, restitution: number): void {
    this.p.y = 0.1;
    this.p.x = hit.x;
    this.p.z = Math.max(hit.z, BALL_RADIUS);
    this.v.y = Math.abs(this.v.y) * restitution;
    this.v.x *= 0.8;
  }

  private checkDone(): void {
    const speed = length(this.v);
    if (this.scored) {
      this.done = speed < 0.4 || this.t > 6;
      return;
    }
    this.done =
      this.t > 7 ||
      this.p.y < -6 ||
      Math.abs(this.p.x) > 25 ||
      (speed < 0.3 && this.p.z <= BALL_RADIUS + 0.01);
  }
}

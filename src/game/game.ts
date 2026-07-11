import { LEVELS, placeWall, type LevelDef, type WallPlacement } from "../levels/levels";
import { BallSim, type BallEvent } from "../sim/ball";
import { KeeperSim } from "../sim/keeper";
import {
  AIM_CIRCLE_RADIUS,
  clampToAimCircle,
  computeKick,
  kickDirection,
  aimCircleCenter,
  type AimState,
  type Kick,
} from "../sim/kick";
import { WIND_MAX_SPEED } from "../sim/world";
import { scoreGoal } from "../scoring/score";
import {
  CANVAS_H,
  CANVAS_W,
  PX_PER_M_X,
  PX_PER_M_Y,
  toScreen,
  toWorldGround,
} from "../render/camera";
import {
  drawAimLine,
  drawAimZone,
  drawBackdrop,
  drawBall,
  drawField,
  drawGoal,
  drawKeeper,
  drawKicker,
  drawTrail,
  drawWall,
} from "../render/renderer";

export type Phase = "title" | "aiming" | "runup" | "flight" | "result";

export interface Wind {
  /** Direção para onde o vento sopra, em radianos no plano do chão. */
  dir: number;
  /** Força 0–100 mostrada ao jogador. */
  force: number;
  /** Velocidade do ar em m/s decomposta nos eixos do mundo. */
  vec: { x: number; y: number };
}

export interface ShotResult {
  goal: boolean;
  score: number;
  /** Motivo da falha, quando não foi gol. */
  reason: BallEvent | "out" | null;
}

export interface GameCallbacks {
  onGoal(result: ShotResult, levelIdx: number, isLast: boolean): void;
  onMiss(result: ShotResult): void;
  onHudChange(levelIdx: number, total: number): void;
  onWind(wind: Wind): void;
}

const MISS_RESET_DELAY = 0.8; // segundos até rearmar a cobrança
const RUN_SPEED = 7; // m/s da corrida do batedor até a bola

export class Game {
  phase: Phase = "title";
  levelIdx = 0;
  level: LevelDef = LEVELS[0];
  wall: WallPlacement = placeWall(LEVELS[0]);
  aim: AimState;
  sim: BallSim | null = null;
  keeper: KeeperSim = new KeeperSim(LEVELS[0].keeper);
  wind: Wind = { dir: 0, force: 0, vec: { x: 0, y: 0 } };

  private missTimer = 0;
  private pendingKick: Kick | null = null;
  /** Centro do semicírculo (clampado para caber na tela), por fase. */
  private aimCenter = { x: 0, y: 0 };

  constructor(private cb: GameCallbacks) {
    this.aimCenter = this.computeAimCenter();
    this.aim = this.restAim();
  }

  /**
   * Centro do semicírculo: atrás da bola na direção oposta ao gol, mas
   * clampado em coordenadas de tela para a área de mira nunca sair do
   * canvas em faltas de canto.
   */
  private computeAimCenter(): { x: number; y: number } {
    const raw = aimCircleCenter(this.level.ball);
    const s = toScreen(raw.x, raw.y);
    const mx = AIM_CIRCLE_RADIUS * PX_PER_M_X + 12;
    const my = AIM_CIRCLE_RADIUS * PX_PER_M_Y + 12;
    const sx = Math.max(mx, Math.min(CANVAS_W - mx, s.sx));
    const sy = Math.max(my, Math.min(CANVAS_H - my, s.sy));
    return toWorldGround(sx, sy);
  }

  private restAim(): AimState {
    // Batedor começa parado no centro do semicírculo.
    return { kicker: { ...this.aimCenter }, power: 0 };
  }

  start(): void {
    this.loadLevel(0);
  }

  loadLevel(idx: number): void {
    this.levelIdx = idx;
    this.level = LEVELS[idx];
    this.wall = placeWall(this.level);
    this.aimCenter = this.computeAimCenter();
    this.cb.onHudChange(idx, LEVELS.length);
    this.newAttempt();
  }

  retryLevel(): void {
    this.loadLevel(this.levelIdx);
  }

  nextLevel(): void {
    this.loadLevel((this.levelIdx + 1) % LEVELS.length);
  }

  /** Rearma a cobrança: vento novo, goleiro no lugar, batedor no centro. */
  private newAttempt(): void {
    this.sim = null;
    this.pendingKick = null;
    this.aim = this.restAim();
    this.keeper.reset(this.level.keeper);
    this.wind = this.rollWind();
    this.cb.onWind(this.wind);
    this.phase = "aiming";
  }

  private rollWind(): Wind {
    const dir = Math.random() * Math.PI * 2;
    const force = Math.round(Math.random() * this.level.windMax);
    const speed = (force / 100) * WIND_MAX_SPEED;
    return {
      dir,
      force,
      vec: { x: Math.cos(dir) * speed, y: Math.sin(dir) * speed },
    };
  }

  pointerMove(sx: number, sy: number): void {
    if (this.phase !== "aiming") return;
    this.aim = clampToAimCircle(this.level.ball, this.aimCenter, toWorldGround(sx, sy));
  }

  /** Confirma a mira: o batedor corre até a bola e só então chuta. */
  pointerClick(sx: number, sy: number): void {
    if (this.phase !== "aiming") return;
    this.pointerMove(sx, sy);
    this.pendingKick = computeKick(this.level.ball, this.aim);
    this.phase = "runup";
  }

  update(dt: number): void {
    if (this.phase === "runup") {
      this.updateRunup(dt);
    } else if (this.phase === "flight" && this.sim) {
      this.keeper.update(dt, this.sim);
      this.sim.step(dt, this.keeper.x);
      if (this.sim.done) this.resolveShot();
    } else if (this.phase === "result" && this.missTimer > 0) {
      this.missTimer -= dt;
      if (this.missTimer <= 0) this.newAttempt();
    }
  }

  private updateRunup(dt: number): void {
    const k = this.aim.kicker;
    const dx = this.level.ball.x - k.x;
    const dy = this.level.ball.y - k.y;
    const dist = Math.hypot(dx, dy);
    const step = RUN_SPEED * dt;
    if (dist <= step + 0.45) {
      // chegou na bola: chuta
      this.sim = new BallSim(
        this.level.ball,
        this.pendingKick!.v,
        this.pendingKick!.spinZ,
        this.pendingKick!.dip,
        this.wind.vec,
        this.wall,
      );
      this.phase = "flight";
      return;
    }
    k.x += (dx / dist) * step;
    k.y += (dy / dist) * step;
  }

  private resolveShot(): void {
    const sim = this.sim!;
    if (sim.scored && sim.crossing) {
      const result: ShotResult = { goal: true, score: scoreGoal(sim.crossing), reason: null };
      this.phase = "result";
      this.cb.onGoal(result, this.levelIdx, this.levelIdx === LEVELS.length - 1);
    } else {
      const blocked = sim.events.filter((e) => e !== "goal").pop() ?? "out";
      const result: ShotResult = { goal: false, score: 0, reason: blocked };
      this.phase = "result";
      this.missTimer = MISS_RESET_DELAY;
      this.cb.onMiss(result);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx);
    drawField(ctx);
    drawGoal(ctx);
    drawKeeper(ctx, this.keeper.x);
    drawWall(ctx, this.wall, this.level.wall.count);

    if (this.phase === "aiming") {
      drawAimZone(ctx, this.level.ball, this.aimCenter);
      drawAimLine(ctx, this.aim.kicker, this.level.ball, kickDirection(this.level.ball, this.aim));
      drawKicker(ctx, this.aim.kicker);
      drawBall(ctx, { ...this.level.ball, z: 0.11 });
    } else {
      drawKicker(ctx, this.aim.kicker);
      if (this.phase === "runup") {
        drawBall(ctx, { ...this.level.ball, z: 0.11 });
      } else if (this.sim) {
        drawTrail(ctx, this.sim.trail);
        drawBall(ctx, this.sim.p);
      }
    }
  }
}

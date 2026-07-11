import { LEVELS, placeWall, type LevelDef, type WallPlacement } from "../levels/levels";
import { BallSim, type BallEvent } from "../sim/ball";
import { clampToAimCircle, computeKick, aimCircleCenter, type AimState } from "../sim/kick";
import { scoreGoal } from "../scoring/score";
import { toWorldGround } from "../render/camera";
import {
  drawAimLine,
  drawAimZone,
  drawBackdrop,
  drawBall,
  drawField,
  drawGoal,
  drawKeeper,
  drawKicker,
  drawWall,
} from "../render/renderer";

export type Phase = "title" | "aiming" | "flight" | "result";

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
}

const MISS_RESET_DELAY = 1.4; // segundos até rearmar a cobrança

export class Game {
  phase: Phase = "title";
  levelIdx = 0;
  level: LevelDef = LEVELS[0];
  wall: WallPlacement = placeWall(LEVELS[0]);
  aim: AimState;
  sim: BallSim | null = null;

  private missTimer = 0;

  constructor(private cb: GameCallbacks) {
    this.aim = this.restAim();
  }

  private restAim(): AimState {
    // Batedor começa parado no centro do semicírculo.
    const c = aimCircleCenter(this.level.ball);
    return { kicker: c, power: 0 };
  }

  start(): void {
    this.loadLevel(0);
    this.phase = "aiming";
  }

  loadLevel(idx: number): void {
    this.levelIdx = idx;
    this.level = LEVELS[idx];
    this.wall = placeWall(this.level);
    this.sim = null;
    this.aim = this.restAim();
    this.phase = "aiming";
    this.cb.onHudChange(idx, LEVELS.length);
  }

  retryLevel(): void {
    this.loadLevel(this.levelIdx);
  }

  nextLevel(): void {
    this.loadLevel((this.levelIdx + 1) % LEVELS.length);
  }

  pointerMove(sx: number, sy: number): void {
    if (this.phase !== "aiming") return;
    this.aim = clampToAimCircle(this.level.ball, toWorldGround(sx, sy));
  }

  pointerClick(sx: number, sy: number): void {
    if (this.phase !== "aiming") return;
    this.pointerMove(sx, sy);
    const v = computeKick(this.level.ball, this.aim);
    this.sim = new BallSim(this.level.ball, v, {
      wall: this.wall,
      keeperX: this.level.keeper.x,
    });
    this.phase = "flight";
  }

  update(dt: number): void {
    if (this.phase === "flight" && this.sim) {
      this.sim.step(dt);
      if (this.sim.done) this.resolveShot();
    } else if (this.phase === "result" && this.missTimer > 0) {
      this.missTimer -= dt;
      if (this.missTimer <= 0) this.retryShot();
    }
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

  /** Tentativas ilimitadas: errou, a bola volta para o mesmo lugar. */
  private retryShot(): void {
    this.sim = null;
    this.aim = this.restAim();
    this.phase = "aiming";
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx);
    drawField(ctx);
    drawGoal(ctx);
    drawKeeper(ctx, this.level.keeper.x);
    drawWall(ctx, this.wall, this.level.wall.count);

    if (this.phase === "aiming") {
      drawAimZone(ctx, this.level.ball);
      drawAimLine(ctx, this.aim.kicker, this.level.ball);
      drawKicker(ctx, this.aim.kicker);
      drawBall(ctx, { ...this.level.ball, z: 0.11 });
    } else {
      drawKicker(ctx, this.aim.kicker);
      if (this.sim) drawBall(ctx, this.sim.p);
    }
  }
}

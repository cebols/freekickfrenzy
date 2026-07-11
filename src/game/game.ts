import { LEVELS, placeWall, type LevelDef, type WallPlacement } from "../levels/levels";
import { BallSim, type BallEvent } from "../sim/ball";
import { KeeperSim } from "../sim/keeper";
import {
  clampToAimCircle,
  computeKick,
  kickDirection,
  aimCircleCenter,
  type AimState,
} from "../sim/kick";
import { WIND_MAX_SPEED } from "../sim/world";
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
  drawTrail,
  drawWall,
} from "../render/renderer";

export type Phase = "title" | "aiming" | "flight" | "result";

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

const MISS_RESET_DELAY = 1.4; // segundos até rearmar a cobrança

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
  }

  loadLevel(idx: number): void {
    this.levelIdx = idx;
    this.level = LEVELS[idx];
    this.wall = placeWall(this.level);
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
    this.aim = clampToAimCircle(this.level.ball, toWorldGround(sx, sy));
  }

  pointerClick(sx: number, sy: number): void {
    if (this.phase !== "aiming") return;
    this.pointerMove(sx, sy);
    const kick = computeKick(this.level.ball, this.aim);
    this.sim = new BallSim(this.level.ball, kick.v, kick.spinZ, this.wind.vec, this.wall);
    this.phase = "flight";
  }

  update(dt: number): void {
    if (this.phase === "flight" && this.sim) {
      this.keeper.update(dt, this.sim);
      this.sim.step(dt, this.keeper.x);
      if (this.sim.done) this.resolveShot();
    } else if (this.phase === "result" && this.missTimer > 0) {
      this.missTimer -= dt;
      if (this.missTimer <= 0) this.newAttempt();
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

  render(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx);
    drawField(ctx);
    drawGoal(ctx);
    drawKeeper(ctx, this.keeper.x);
    drawWall(ctx, this.wall, this.level.wall.count);

    if (this.phase === "aiming") {
      drawAimZone(ctx, this.level.ball);
      drawAimLine(ctx, this.aim.kicker, this.level.ball, kickDirection(this.level.ball, this.aim));
      drawKicker(ctx, this.aim.kicker);
      drawBall(ctx, { ...this.level.ball, z: 0.11 });
    } else {
      drawKicker(ctx, this.aim.kicker);
      if (this.sim) {
        drawTrail(ctx, this.sim.trail);
        drawBall(ctx, this.sim.p);
      }
    }
  }
}

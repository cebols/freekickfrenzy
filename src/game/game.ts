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
  drawReplayBadge,
  drawTitleScene,
  drawTrail,
  drawWall,
  type Mood,
} from "../render/renderer";

export type Phase = "title" | "aiming" | "runup" | "flight" | "replay" | "result";

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
  /** Evento físico durante o voo (trave, barreira, goleiro...) para sfx. */
  onEvent(event: BallEvent): void;
  /** O pé encostou na bola (início do voo). */
  onKick(): void;
  /** Fim do replay: reabrir a tela de resultado se o lance foi gol. */
  onReplayEnd(scored: boolean): void;
}

const MISS_RESET_DELAY = 0.8; // segundos até rearmar a cobrança
const MAX_RUN_TIME = 0.45; // corrida até a bola dura no máximo isto
const WALL_JUMP_DURATION = 0.55;
const WALL_JUMP_HEIGHT = 0.62;
const REPLAY_SPEED = 0.55; // câmera lenta

interface ShotFrame {
  bx: number;
  by: number;
  bz: number;
  rot: number;
  kx: number;
  kvx: number;
  wz: number;
}

export class Game {
  phase: Phase = "title";
  levelIdx = 0;
  level: LevelDef = LEVELS[0];
  wall: WallPlacement = placeWall(LEVELS[0]);
  aim: AimState;
  sim: BallSim | null = null;
  keeper: KeeperSim = new KeeperSim(LEVELS[0].keeper);
  wind: Wind = { dir: 0, force: 0, vec: { x: 0, y: 0 } };
  /** Progresso da passada para animar as pernas na corrida. */
  runPhase = 0;
  /** Empolgação da torcida (0..1) — sobe no gol, decai sozinha. */
  crowd = 0;

  private missTimer = 0;
  private pendingKick: Kick | null = null;
  private aimCenter = { x: 0, y: 0 };
  private runSpeed = 12;
  private flightT = 0;
  private wallJumpAt = Infinity;
  private eventCursor = 0;
  private time = 0;

  // Replay do último lance
  private frames: ShotFrame[] = [];
  private lastScored = false;
  private replayIdx = 0;
  private recordTick = 0;

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
    this.frames = [];
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
    this.runPhase = 0;
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
    const dist = Math.hypot(
      this.level.ball.x - this.aim.kicker.x,
      this.level.ball.y - this.aim.kicker.y,
    );
    this.runSpeed = Math.max(12, dist / MAX_RUN_TIME);
    this.phase = "runup";
  }

  /** Reexibe o último lance em câmera lenta. */
  startReplay(): boolean {
    if (this.frames.length < 8) return false;
    if (this.phase !== "aiming" && this.phase !== "result") return false;
    this.replayIdx = 0;
    this.phase = "replay";
    return true;
  }

  hasReplay(): boolean {
    return this.frames.length >= 8;
  }

  update(dt: number): void {
    this.time += dt;
    this.crowd = Math.max(0, this.crowd - 0.45 * dt);

    if (this.phase === "runup") {
      this.updateRunup(dt);
    } else if (this.phase === "flight" && this.sim) {
      this.updateFlight(dt);
    } else if (this.phase === "replay") {
      this.replayIdx += dt * 60 * REPLAY_SPEED;
      if (this.replayIdx >= this.frames.length) {
        this.phase = this.lastScored ? "result" : "aiming";
        this.cb.onReplayEnd(this.lastScored);
      }
    } else if (this.phase === "result" && this.missTimer > 0) {
      this.missTimer -= dt;
      if (this.missTimer <= 0) this.newAttempt();
    }
  }

  private updateRunup(dt: number): void {
    this.runPhase += dt * 3.6;
    const k = this.aim.kicker;
    const dx = this.level.ball.x - k.x;
    const dy = this.level.ball.y - k.y;
    const dist = Math.hypot(dx, dy);
    const step = this.runSpeed * dt;
    if (dist <= step + 0.45) {
      this.beginFlight();
      return;
    }
    k.x += (dx / dist) * step;
    k.y += (dy / dist) * step;
  }

  private beginFlight(): void {
    this.sim = new BallSim(
      this.level.ball,
      this.pendingKick!.v,
      this.pendingKick!.spinZ,
      this.pendingKick!.dip,
      this.wind.vec,
      this.wall,
    );
    this.flightT = 0;
    this.eventCursor = 0;
    this.frames = [];
    this.recordTick = 0;
    // A barreira cronometra o pulo para quando a bola chegar nela —
    // com um erro humano que diminui nas fases difíceis.
    const vy = Math.abs(this.pendingKick!.v.y);
    const tWall = vy > 1 ? (this.level.ball.y - this.wall.y) / vy : Infinity;
    const err = (Math.random() - 0.5) * (0.36 - 0.22 * this.level.keeper.skill);
    this.wallJumpAt = tWall - WALL_JUMP_DURATION * 0.55 + err;
    this.phase = "flight";
    this.cb.onKick();
  }

  /** Altura atual do pulo da barreira (durante o voo). */
  wallJumpZ(): number {
    const u = (this.flightT - this.wallJumpAt) / WALL_JUMP_DURATION;
    if (u <= 0 || u >= 1) return 0;
    return 4 * WALL_JUMP_HEIGHT * u * (1 - u);
  }

  private updateFlight(dt: number): void {
    const sim = this.sim!;
    this.flightT += dt;
    this.keeper.update(dt, sim);
    sim.step(dt, this.keeper.x, this.wallJumpZ());

    // grava o lance para o replay (a cada 2 passos ≈ 60 fps)
    if (this.recordTick++ % 2 === 0 && this.frames.length < 900) {
      this.frames.push({
        bx: sim.p.x,
        by: sim.p.y,
        bz: sim.p.z,
        rot: sim.rot,
        kx: this.keeper.x,
        kvx: this.keeper.vx,
        wz: this.wallJumpZ(),
      });
    }

    // emite eventos novos (trave, barreira, goleiro...) para os sons
    while (this.eventCursor < sim.events.length) {
      this.cb.onEvent(sim.events[this.eventCursor++]);
    }

    if (sim.done) this.resolveShot();
  }

  private resolveShot(): void {
    const sim = this.sim!;
    this.lastScored = sim.scored;
    if (sim.scored && sim.crossing) {
      this.crowd = 1;
      const result: ShotResult = { goal: true, score: scoreGoal(sim.crossing), reason: null };
      this.phase = "result";
      this.missTimer = 0;
      this.cb.onGoal(result, this.levelIdx, this.levelIdx === LEVELS.length - 1);
    } else {
      const blocked = sim.events.filter((e) => e !== "goal").pop() ?? "out";
      const result: ShotResult = { goal: false, score: 0, reason: blocked };
      this.phase = "result";
      this.missTimer = MISS_RESET_DELAY;
      this.cb.onMiss(result);
    }
  }

  private keeperMood(): Mood {
    if (this.phase === "flight" || this.phase === "replay") return "worried";
    if (this.sim) {
      if (this.sim.scored) return "sad";
      if (this.sim.events.includes("keeper")) return "happy";
    }
    return "neutral";
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.phase === "title") {
      drawTitleScene(ctx, this.time);
      return;
    }

    drawBackdrop(ctx, this.time, this.crowd);
    drawField(ctx);

    if (this.phase === "replay") {
      this.renderReplay(ctx);
      return;
    }

    const netBall = this.sim?.scored ? this.sim.p : null;
    drawGoal(ctx, netBall);
    const diving = this.phase === "flight" && Math.abs(this.keeper.vx) > 3.2;
    drawKeeper(ctx, this.keeper.x, this.keeperMood(), diving ? Math.sign(this.keeper.vx) : 0);
    drawWall(ctx, this.wall, this.phase === "flight" ? this.wallJumpZ() : 0);

    if (this.phase === "aiming") {
      drawAimZone(ctx, this.level.ball, this.aimCenter);
      drawAimLine(ctx, this.aim.kicker, this.level.ball, kickDirection(this.level.ball, this.aim));
      drawKicker(ctx, this.aim.kicker);
      drawBall(ctx, { ...this.level.ball, z: 0.11 });
    } else if (this.phase === "runup") {
      drawKicker(ctx, this.aim.kicker, this.runPhase);
      drawBall(ctx, { ...this.level.ball, z: 0.11 });
    } else {
      drawKicker(ctx, this.aim.kicker);
      if (this.sim) {
        drawTrail(ctx, this.sim.trail);
        drawBall(ctx, this.sim.p, this.sim.rot);
      }
    }
  }

  private renderReplay(ctx: CanvasRenderingContext2D): void {
    const idx = Math.min(Math.floor(this.replayIdx), this.frames.length - 1);
    const f = this.frames[idx];
    const netBall = this.lastScored && f.by < 0 ? { x: f.bx, y: f.by, z: f.bz } : null;
    drawGoal(ctx, netBall);
    const diving = Math.abs(f.kvx) > 3.2;
    drawKeeper(ctx, f.kx, "worried", diving ? Math.sign(f.kvx) : 0);
    drawWall(ctx, this.wall, f.wz);
    drawKicker(ctx, this.aim.kicker);
    const trail = [];
    for (let i = 0; i < idx; i += 8) {
      trail.push({ x: this.frames[i].bx, y: this.frames[i].by, z: this.frames[i].bz });
    }
    drawTrail(ctx, trail);
    drawBall(ctx, { x: f.bx, y: f.by, z: f.bz }, f.rot);
    drawReplayBadge(ctx, this.time);
  }
}

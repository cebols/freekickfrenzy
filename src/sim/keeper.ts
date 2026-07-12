import type { Vec3 } from "./vec";
import { GOAL_HALF, KEEPER_DEPTH } from "./world";

export interface KeeperParams {
  /** Posição inicial (deslocamento lateral do centro do gol). */
  x: number;
  /** 0..1: afeta tempo de reação e velocidade de deslocamento. */
  skill: number;
}

/**
 * Goleiro reativo: depois do tempo de reação, persegue o ponto onde a
 * bola cruzaria a linha *se seguisse reta* (extrapolação linear da
 * velocidade atual). Chutes com efeito mudam de direção no ar e o
 * deixam para trás — e acima de KEEPER_HEIGHT ele não alcança.
 */
export class KeeperSim {
  x: number;
  /** Velocidade lateral atual (para a pose de mergulho no render). */
  vx = 0;
  private time = 0;
  private readonly reaction: number;
  private readonly speed: number;

  constructor(params: KeeperParams) {
    this.x = params.x;
    this.reaction = 0.42 - 0.3 * params.skill;
    this.speed = 2.5 + 4 * params.skill;
  }

  reset(params: KeeperParams): void {
    this.x = params.x;
    this.vx = 0;
    this.time = 0;
  }

  update(dt: number, ball: { p: Vec3; v: Vec3 }): void {
    this.time += dt;
    if (this.time < this.reaction) return;
    if (ball.v.y >= -0.5 || ball.p.y <= KEEPER_DEPTH) return;

    const tHit = (ball.p.y - KEEPER_DEPTH) / -ball.v.y;
    const predX = ball.p.x + ball.v.x * tHit;
    const target = Math.max(-GOAL_HALF + 0.4, Math.min(GOAL_HALF - 0.4, predX));

    const d = target - this.x;
    const maxStep = this.speed * dt;
    const step = Math.abs(d) < maxStep ? d : Math.sign(d) * maxStep;
    this.x += step;
    this.vx = step / dt;
  }
}

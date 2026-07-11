import type { Vec3 } from "./vec";
import { vec3 } from "./vec";

// Mapeamento do clique no semicírculo → velocidade inicial da bola.
// Todas as constantes de "game feel" vivem aqui para facilitar o tuning.

export const AIM_CIRCLE_BEHIND = 4.0; // centro do semicírculo, metros atrás da bola
export const AIM_CIRCLE_RADIUS = 4.2;

const MIN_SPEED = 14.5; // m/s no chute mais fraco
const MAX_SPEED = 29;

// Quanto do desvio lateral da mira vira spin (curva de volta para o centro).
// Calibrado junto com AIM_SENSITIVITY: a curva precisa ser vistosa, mas sem
// cancelar a abertura da mira — senão todo chute converge no goleiro.
const SPIN_AIM_K = 1.2;

// O ângulo batedor→bola é amortecido por este fator para virar a direção
// real do chute — sem isso, miras levemente abertas saem larguíssimas.
const AIM_SENSITIVITY = 0.65;

// Altura em "U" pela força:
// - fraco  = cavadinha: sobe por cima da barreira e cai dentro
// - médio  = chute firme e baixo — é o que corre risco de BARREIRA
// - forte  = sobe e MERGULHA antes do travessão (topspin/folha seca)
// O dip só entra acima de meia força e é escalado pela distância da
// falta para petardos de longe não caírem antes do gol.
const VZ_LOB = 6.9; // força 0
const VZ_DRIVE = 5.6; // força no vale (mais rasteira)
const VZ_SCREAMER = 9.6; // força máxima
const VZ_VALLEY = 0.45; // onde fica o vale do "U"
const DIP_ACCEL_MAX = 9.2; // m/s² extras para baixo na força máxima
const DIP_REF_DIST = 18; // distância em que o dip vale o nominal

function vzForPower(p: number): number {
  if (p < VZ_VALLEY) return VZ_LOB + (VZ_DRIVE - VZ_LOB) * (p / VZ_VALLEY);
  return VZ_DRIVE + (VZ_SCREAMER - VZ_DRIVE) * ((p - VZ_VALLEY) / (1 - VZ_VALLEY));
}

export interface AimState {
  /** Posição do batedor (pé de apoio) no chão, em metros. */
  kicker: { x: number; y: number };
  /** Força normalizada 0..1 (distância ao centro do semicírculo). */
  power: number;
}

/**
 * Centro do semicírculo de mira: fica atrás da bola, na direção oposta
 * ao centro do gol (a "meia-lua" clara do jogo original).
 */
export function aimCircleCenter(ball: { x: number; y: number }): { x: number; y: number } {
  const dist = Math.hypot(ball.x, ball.y);
  return {
    x: ball.x + (ball.x / dist) * AIM_CIRCLE_BEHIND,
    y: ball.y + (ball.y / dist) * AIM_CIRCLE_BEHIND,
  };
}

/**
 * Restringe a posição do mouse (em metros) ao semicírculo de mira:
 * dentro do raio e nunca à frente do centro (semiplano oposto ao gol).
 * O centro pode vir deslocado (clamp de tela em faltas de canto).
 */
export function clampToAimCircle(
  ball: { x: number; y: number },
  c: { x: number; y: number },
  point: { x: number; y: number },
): AimState {
  let dx = point.x - c.x;
  let dy = point.y - c.y;

  // Normal do semiplano: direção bola → gol (gol é a origem).
  const toGoal = { x: -ball.x, y: -ball.y };
  const tgLen = Math.hypot(toGoal.x, toGoal.y);
  const nx = toGoal.x / tgLen;
  const ny = toGoal.y / tgLen;

  // Não deixa o batedor passar do diâmetro do semicírculo (lado do gol).
  const forward = dx * nx + dy * ny;
  if (forward > 0) {
    dx -= forward * nx;
    dy -= forward * ny;
  }

  const r = Math.hypot(dx, dy);
  if (r > AIM_CIRCLE_RADIUS) {
    dx *= AIM_CIRCLE_RADIUS / r;
    dy *= AIM_CIRCLE_RADIUS / r;
  }

  return {
    kicker: { x: c.x + dx, y: c.y + dy },
    power: Math.min(1, Math.hypot(dx, dy) / AIM_CIRCLE_RADIUS),
  };
}

export interface Kick {
  v: Vec3;
  /** Spin lateral normalizado [-1, 1]; positivo curva para -x. */
  spinZ: number;
  /** Aceleração extra para baixo (topspin), m/s². */
  dip: number;
}

/**
 * Converte a mira em velocidade inicial: a bola sai na direção
 * batedor → bola (a linha tracejada), com módulo dado pela força.
 * Mirar fora da reta bola–gol abre o chute e gera spin que curva
 * a bola de volta para o centro do gol (a "folha seca").
 */
/**
 * Direção efetiva do chute no chão: o ângulo da mira (batedor→bola) em
 * relação à reta bola→gol, amortecido por AIM_SENSITIVITY.
 */
export function kickDirection(
  ball: { x: number; y: number },
  aim: AimState,
): { x: number; y: number; lateral: number } {
  const goalDist = Math.hypot(ball.x, ball.y);
  const ux = -ball.x / goalDist;
  const uy = -ball.y / goalDist;

  let dx = ball.x - aim.kicker.x;
  let dy = ball.y - aim.kicker.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return { x: ux, y: uy, lateral: 0 };
  }
  dx /= len;
  dy /= len;

  // Componente lateral da mira (seno do desvio, com sinal).
  const lateral = dx * -uy + dy * ux;
  const dev = Math.atan2(dy * ux - dx * uy, dx * ux + dy * uy);
  const ang = dev * AIM_SENSITIVITY;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return { x: ux * cos - uy * sin, y: ux * sin + uy * cos, lateral };
}

export function computeKick(ball: { x: number; y: number }, aim: AimState): Kick {
  const dir = kickDirection(ball, aim);
  const speed = MIN_SPEED + aim.power * (MAX_SPEED - MIN_SPEED);
  const vz = vzForPower(aim.power);
  // Spin oposto ao desvio da mira: chute aberto curva de volta ao centro.
  const spinZ = Math.max(-1, Math.min(1, -SPIN_AIM_K * dir.lateral));

  const goalDist = Math.hypot(ball.x, ball.y);
  const dipScale = Math.max(0.55, Math.min(1.3, DIP_REF_DIST / goalDist));
  const dipPower = Math.max(0, (aim.power - 0.5) / 0.5);

  return {
    v: vec3(dir.x * speed, dir.y * speed, vz),
    spinZ,
    dip: DIP_ACCEL_MAX * dipPower * dipScale,
  };
}

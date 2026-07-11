import type { Vec3 } from "./vec";
import { vec3 } from "./vec";

// Mapeamento do clique no semicírculo → velocidade inicial da bola.
// Todas as constantes de "game feel" vivem aqui para facilitar o tuning.

export const AIM_CIRCLE_BEHIND = 4.0; // centro do semicírculo, metros atrás da bola
export const AIM_CIRCLE_RADIUS = 4.2;

const MIN_SPEED = 15; // m/s no chute mais fraco
const MAX_SPEED = 27.5;

// Quanto do desvio lateral da mira vira spin (curva de volta para o centro).
// Calibrado junto com AIM_SENSITIVITY: a curva precisa ser vistosa, mas sem
// cancelar a abertura da mira — senão todo chute converge no goleiro.
const SPIN_AIM_K = 1.2;

// O ângulo batedor→bola é amortecido por este fator para virar a direção
// real do chute — sem isso, miras levemente abertas saem larguíssimas.
const AIM_SENSITIVITY = 0.65;

// Elevação + topspin ("folha seca"): chute forte sobe por cima da
// barreira e MERGULHA antes do travessão — o dip cresce com a força,
// então potência máxima continua cabendo no gol. Chute fraco demais
// não sobe o suficiente para passar a barreira.
const LOFT_VZ_MIN = 5.2;
const LOFT_VZ_MAX = 9.6;
const DIP_ACCEL_MAX = 9.2; // m/s² extras para baixo na força máxima

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
  const vz = LOFT_VZ_MIN + aim.power * (LOFT_VZ_MAX - LOFT_VZ_MIN);
  // Spin oposto ao desvio da mira: chute aberto curva de volta ao centro.
  const spinZ = Math.max(-1, Math.min(1, -SPIN_AIM_K * dir.lateral));

  return {
    v: vec3(dir.x * speed, dir.y * speed, vz),
    spinZ,
    dip: DIP_ACCEL_MAX * aim.power,
  };
}

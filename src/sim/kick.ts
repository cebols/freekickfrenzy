import type { Vec3 } from "./vec";
import { vec3 } from "./vec";

// Mapeamento do clique no semicírculo → velocidade inicial da bola.
// Todas as constantes de "game feel" vivem aqui para facilitar o tuning.

export const AIM_CIRCLE_BEHIND = 3.2; // centro do semicírculo, metros atrás da bola
export const AIM_CIRCLE_RADIUS = 2.6;

const MIN_SPEED = 15; // m/s no chute mais fraco
const MAX_SPEED = 27.5;

// Elevação: fração da velocidade horizontal que vira componente vertical.
// Chutes mais fortes sobem proporcionalmente mais.
const LOFT_MIN = 0.14;
const LOFT_MAX = 0.30;

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
 * dentro do raio e nunca à frente da bola (semiplano oposto ao gol).
 */
export function clampToAimCircle(
  ball: { x: number; y: number },
  point: { x: number; y: number },
): AimState {
  const c = aimCircleCenter(ball);
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

/**
 * Converte a mira em velocidade inicial: a bola sai na direção
 * batedor → bola (a linha tracejada), com módulo dado pela força.
 */
export function computeKick(ball: { x: number; y: number }, aim: AimState): Vec3 {
  let dx = ball.x - aim.kicker.x;
  let dy = ball.y - aim.kicker.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    // batedor exatamente sobre o centro: chuta reto no gol
    const d = Math.hypot(ball.x, ball.y);
    dx = -ball.x / d;
    dy = -ball.y / d;
  } else {
    dx /= len;
    dy /= len;
  }

  const speed = MIN_SPEED + aim.power * (MAX_SPEED - MIN_SPEED);
  const loft = LOFT_MIN + aim.power * (LOFT_MAX - LOFT_MIN);
  return vec3(dx * speed, dy * speed, speed * loft);
}

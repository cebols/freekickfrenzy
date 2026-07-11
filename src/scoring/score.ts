import { GOAL_HALF, GOAL_HEIGHT, GOAL_WIDTH } from "../sim/world";

// Distância do ponto de cruzamento ao canto superior mais distante possível
// (canto inferior oposto do gol) — normaliza o score.
const MAX_DIST = Math.hypot(GOAL_WIDTH, GOAL_HEIGHT);

/**
 * Pontua um gol de 1 a 100 pela proximidade do cruzamento da linha
 * ao ângulo superior mais próximo. 100 = exatamente no ângulo.
 */
export function scoreGoal(crossing: { x: number; z: number }): number {
  const d = Math.hypot(GOAL_HALF - Math.abs(crossing.x), GOAL_HEIGHT - crossing.z);
  const raw = 1 + 99 * (1 - d / MAX_DIST);
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export type Stars = 1 | 2 | 3 | 4; // 4 = platina

export function starsForScore(score: number): Stars {
  if (score >= 100) return 4;
  if (score >= 80) return 3;
  if (score >= 50) return 2;
  return 1;
}

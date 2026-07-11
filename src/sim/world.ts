// Constantes do mundo em metros / segundos.
// Eixos: x lateral (0 = centro do gol), y = distância à linha do gol
// (positivo campo adentro), z = altura.

export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;
export const GOAL_HALF = GOAL_WIDTH / 2;
export const POST_RADIUS = 0.06;
export const NET_DEPTH = 1.6;

export const BALL_RADIUS = 0.11;

export const GRAVITY = 9.81;
// Arrasto aerodinâmico: a = -DRAG_K * |v| * v
export const DRAG_K = 0.012;

// Barreira
export const WALL_DISTANCE = 9.15; // distância regulamentar da bola
export const WALL_PLAYER_WIDTH = 0.55;
export const WALL_HEIGHT = 1.85;

// Goleiro (estático na M1; skill/reação entram na etapa de física completa)
export const KEEPER_HALF_REACH = 0.75;
export const KEEPER_HEIGHT = 1.95;
export const KEEPER_DEPTH = 0.8; // distância dele à frente da linha do gol

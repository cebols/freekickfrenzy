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
// Arrasto aerodinâmico: a = -DRAG_K * |v_rel| * v_rel (relativo ao ar/vento)
export const DRAG_K = 0.012;

// Efeito (Magnus): aceleração lateral = MAGNUS_K * spin * perp(v_xy).
// O spin é normalizado em [-1, 1] pelo desvio lateral da mira.
// Alto de propósito: curvas exageradas são feature, não bug.
export const MAGNUS_K = 0.5;
export const SPIN_DECAY = 0.25; // por segundo
// Impulso tangencial que o spin dá ao quicar na trave (m/s por unidade de spin)
export const SPIN_SURFACE_KICK = 1.6;

// Vento: força 100 equivale a esta velocidade de ar (m/s)...
export const WIND_MAX_SPEED = 15;
// ...e além do arrasto relativo, empurra a bola diretamente — com
// vendaval a trajetória fica cômica de propósito.
export const WIND_PUSH_K = 1.5;

// Barreira
export const WALL_DISTANCE = 9.15; // distância regulamentar da bola
export const WALL_PLAYER_WIDTH = 0.55;
export const WALL_HEIGHT = 1.85;

// Goleiro
export const KEEPER_HALF_REACH = 0.8;
export const KEEPER_HEIGHT = 2.05; // acima disso (ângulo superior) ele não alcança
export const KEEPER_DEPTH = 0.8; // distância dele à frente da linha do gol

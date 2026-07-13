// Constantes do mundo em metros / segundos.
// Eixos: x lateral (0 = centro do gol), y = distância à linha do gol
// (positivo campo adentro), z = altura.

// Gol propositalmente maior que o real (7,32×2,44): escala arcade, como
// no jogo de referência em que o gol ocupa metade da tela.
export const GOAL_WIDTH = 11;
export const GOAL_HEIGHT = 3.2;
export const GOAL_HALF = GOAL_WIDTH / 2;
export const POST_RADIUS = 0.06;
export const NET_DEPTH = 1.6;

export const BALL_RADIUS = 0.11;

export const GRAVITY = 9.81;
// Arrasto aerodinâmico: a = -k * |v_rel| * v_rel (relativo ao ar/vento).
// "Crise de arrasto" real: acima de ~16 m/s o coeficiente cai — chutes
// fortes carregam mais longe do que a extrapolação do chute fraco.
export const DRAG_K_LOW = 0.012;
export const DRAG_K_HIGH = 0.008;
export const DRAG_CRISIS_START = 16;
export const DRAG_CRISIS_END = 24;

// Knuckleball: bola quase sem spin em alta velocidade oscila de leve
// para os lados (a "folha morta").
export const KNUCKLE_SPIN_MAX = 0.1;
export const KNUCKLE_MIN_SPEED = 23;
export const KNUCKLE_ACCEL = 3.6;
export const KNUCKLE_FREQ = 13;

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
// Reforço da componente do vento ALINHADA ao chute: vento a favor
// empurra, contra segura — um pouco além do empurrão base.
export const WIND_AXIAL_BOOST = 0.6;

// Barreira
export const WALL_DISTANCE = 9.15; // distância regulamentar da bola
export const WALL_PLAYER_WIDTH = 0.55;
export const WALL_HEIGHT = 1.85;

// Goleiro (redimensionado junto com o gol arcade)
export const KEEPER_HALF_REACH = 1.05;
export const KEEPER_HEIGHT = 2.5; // acima disso (ângulo superior) ele não alcança
export const KEEPER_DEPTH = 0.8; // distância dele à frente da linha do gol

// Vento abaixo desta força é tratado como calmaria (0)
export const WIND_MIN_FORCE = 25;

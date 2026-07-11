import { WALL_DISTANCE } from "../sim/world";

export interface LevelDef {
  name: string;
  /** Posição da bola em metros: x lateral, y distância da linha do gol. */
  ball: { x: number; y: number };
  wall: { count: number };
  /** x: deslocamento lateral inicial; skill 0..1: reação e velocidade. */
  keeper: { x: number; skill: number };
  /** Teto da força de vento sorteável nesta fase (0–100). */
  windMax: number;
}

export const LEVELS: LevelDef[] = [
  {
    name: "Frontal clássica",
    ball: { x: 0, y: 18 },
    wall: { count: 3 },
    keeper: { x: 0, skill: 0.3 },
    windMax: 25,
  },
  {
    name: "Meia distância pela esquerda",
    ball: { x: -5, y: 21 },
    wall: { count: 4 },
    keeper: { x: -0.6, skill: 0.45 },
    windMax: 45,
  },
  {
    name: "Ângulo aberto pela direita",
    ball: { x: 8, y: 16 },
    wall: { count: 2 },
    keeper: { x: 1.2, skill: 0.6 },
    windMax: 60,
  },
  {
    name: "Bomba de longe",
    ball: { x: 1.5, y: 25 },
    wall: { count: 5 },
    keeper: { x: 0, skill: 0.7 },
    windMax: 85,
  },
];

export interface WallPlacement {
  /** Centro da barreira no plano do chão. */
  x: number;
  y: number;
  halfWidth: number;
}

/**
 * A barreira fica na reta bola → centro do gol, à distância regulamentar
 * (ou na metade do caminho, se a cobrança for mais perto que isso).
 */
export function placeWall(level: LevelDef): WallPlacement {
  const { x: bx, y: by } = level.ball;
  const dist = Math.hypot(bx, by);
  const t = Math.min(WALL_DISTANCE, dist / 2) / dist;
  return {
    x: bx - bx * t,
    y: by - by * t,
    halfWidth: (level.wall.count * 0.55) / 2,
  };
}

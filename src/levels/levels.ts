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
    keeper: { x: 0, skill: 0.25 },
    windMax: 50,
  },
  {
    name: "Meia distância pela esquerda",
    ball: { x: -5, y: 21 },
    wall: { count: 3 },
    keeper: { x: -0.6, skill: 0.35 },
    windMax: 50,
  },
  {
    name: "Ângulo aberto pela direita",
    ball: { x: 8.5, y: 16 },
    wall: { count: 2 },
    keeper: { x: 1.2, skill: 0.45 },
    windMax: 50,
  },
  {
    name: "Muralha de perto",
    ball: { x: -1.5, y: 15 },
    wall: { count: 6 },
    keeper: { x: 0, skill: 0.5 },
    windMax: 50,
  },
  {
    name: "Bomba de longe",
    ball: { x: 1.5, y: 26 },
    wall: { count: 4 },
    keeper: { x: 0, skill: 0.55 },
    windMax: 75,
  },
  {
    name: "Quina da grande área",
    ball: { x: -9.5, y: 19 },
    wall: { count: 3 },
    keeper: { x: -1.4, skill: 0.6 },
    windMax: 75,
  },
  {
    name: "Vendaval frontal",
    ball: { x: 0.5, y: 22 },
    wall: { count: 4 },
    keeper: { x: 0, skill: 0.6 },
    windMax: 90,
  },
  {
    name: "Do meio da rua",
    ball: { x: 3, y: 31 },
    wall: { count: 3 },
    keeper: { x: 0.4, skill: 0.7 },
    windMax: 75,
  },
  {
    name: "A consagração",
    ball: { x: -6.5, y: 28 },
    wall: { count: 5 },
    keeper: { x: -0.8, skill: 0.8 },
    windMax: 100,
  },
];

export interface WallPlacement {
  /** Centro da barreira no plano do chão. */
  x: number;
  y: number;
  halfWidth: number;
  count: number;
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
    count: level.wall.count,
  };
}

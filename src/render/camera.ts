// Projeção do mundo (metros) para a tela (pixels).
// Vista vertical estilo top-down: o gol fica no alto, a bola embaixo.
// Um ponto com altura z é desenhado deslocado para cima; a sombra
// permanece na posição do chão — é isso que "vende" o 3D.

export const CANVAS_W = 480;
export const CANVAS_H = 600;

export const GOAL_LINE_Y = 165; // linha do gol em pixels
export const PX_PER_M_X = 21;
export const PX_PER_M_Y = 9.5; // compressão de profundidade da "câmera"
export const PX_PER_M_Z = 21;

export function toScreen(x: number, y: number, z = 0): { sx: number; sy: number } {
  return {
    sx: CANVAS_W / 2 + x * PX_PER_M_X,
    sy: GOAL_LINE_Y + y * PX_PER_M_Y - z * PX_PER_M_Z,
  };
}

/** Inverso da projeção para pontos no chão (z = 0). */
export function toWorldGround(sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - CANVAS_W / 2) / PX_PER_M_X,
    y: (sy - GOAL_LINE_Y) / PX_PER_M_Y,
  };
}

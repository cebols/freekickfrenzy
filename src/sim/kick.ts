import type { Vec3 } from "./vec";
import { vec3 } from "./vec";

// Mapeamento da mira → velocidade inicial da bola.
// A mira funciona como um "joystick" em COORDENADAS DE TELA: o
// semicírculo é um círculo perfeito na tela (nada de achatamento) e o
// desvio angular é medido em relação ao eixo centro→bola — simétrico
// em qualquer posição de falta, mesmo com o centro clampado no canto.

export const AIM_RADIUS_PX = 114; // raio do semicírculo na tela
export const AIM_BEHIND_PX = 5; // a meia-lua fica praticamente colada na bola

const MIN_SPEED = 14.5; // m/s no chute mais fraco
const MAX_SPEED = 34; // petardo de verdade na força máxima

// Quanto do desvio lateral da mira vira spin (curva de volta para o centro).
const SPIN_AIM_K = 1.2;

// O ângulo da mira é amortecido por este fator para virar a direção real
// do chute — sem isso, miras levemente abertas saem larguíssimas.
const AIM_SENSITIVITY = 0.65;

// Altura em "U" pela força:
// - fraco  = cavadinha: sobe por cima da barreira e cai dentro
// - médio  = chute firme e baixo — é o que corre risco de BARREIRA
// - forte  = sobe e MERGULHA antes do travessão (topspin/folha seca)
// O dip só entra acima de meia força e é escalado pela distância da
// falta para petardos de longe não caírem antes do gol.
const VZ_LOB = 9.0; // força 0: cavadinha bem alta — o EFEITO é que traz de volta
const VZ_DRIVE = 5.8; // força no vale (mais rasteira)
const VZ_SCREAMER = 10.8; // força máxima (passa até por barreira pulando)
const VZ_VALLEY = 0.45; // onde fica o vale do "U"
const DIP_ACCEL_MAX = 9.2; // m/s² extras para baixo na força máxima
const DIP_REF_DIST = 18; // distância em que o dip vale o nominal

function vzForPower(p: number): number {
  if (p < VZ_VALLEY) return VZ_LOB + (VZ_DRIVE - VZ_LOB) * (p / VZ_VALLEY);
  return VZ_DRIVE + (VZ_SCREAMER - VZ_DRIVE) * ((p - VZ_VALLEY) / (1 - VZ_VALLEY));
}

export interface AimState {
  /** Posição do batedor no chão, em metros (para desenhar/correr). */
  kicker: { x: number; y: number };
  /** Posição do batedor na tela (dentro do semicírculo). */
  screen: { sx: number; sy: number };
  /** Força normalizada 0..1 (distância ao centro do semicírculo). */
  power: number;
  /** Desvio angular da mira em relação ao eixo centro→bola (rad, com sinal). */
  dev: number;
}

/**
 * Joystick de mira em tela: restringe o ponteiro ao semicírculo (no lado
 * oposto à bola) e extrai força + desvio angular simétrico.
 */
export function screenAim(
  ballS: { sx: number; sy: number },
  centerS: { sx: number; sy: number },
  point: { sx: number; sy: number },
): { screen: { sx: number; sy: number }; power: number; dev: number } {
  const axLen = Math.hypot(ballS.sx - centerS.sx, ballS.sy - centerS.sy) || 1;
  const ax = (ballS.sx - centerS.sx) / axLen;
  const ay = (ballS.sy - centerS.sy) / axLen;

  let dx = point.sx - centerS.sx;
  let dy = point.sy - centerS.sy;
  // meia-lua: não passa do diâmetro (lado da bola)
  const forward = dx * ax + dy * ay;
  if (forward > 0) {
    dx -= forward * ax;
    dy -= forward * ay;
  }
  const r = Math.hypot(dx, dy);
  if (r > AIM_RADIUS_PX) {
    dx *= AIM_RADIUS_PX / r;
    dy *= AIM_RADIUS_PX / r;
  }
  const px = centerS.sx + dx;
  const py = centerS.sy + dy;

  // desvio angular da direção batedor→bola em relação ao eixo centro→bola
  const kLen = Math.hypot(ballS.sx - px, ballS.sy - py) || 1;
  const kx = (ballS.sx - px) / kLen;
  const ky = (ballS.sy - py) / kLen;
  const dev = Math.atan2(ky * ax - kx * ay, kx * ax + ky * ay);

  return {
    screen: { sx: px, sy: py },
    power: Math.min(1, Math.hypot(dx, dy) / AIM_RADIUS_PX),
    dev,
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
 * Converte a mira em velocidade inicial: o desvio angular (amortecido)
 * é aplicado simetricamente sobre a reta bola→centro do gol. Mirar
 * aberto abre o chute e gera spin que curva de volta (a "folha seca").
 */
export function computeKick(ball: { x: number; y: number }, aim: AimState): Kick {
  const goalDist = Math.hypot(ball.x, ball.y);
  const ux = -ball.x / goalDist;
  const uy = -ball.y / goalDist;
  const ang = aim.dev * AIM_SENSITIVITY;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const dirX = ux * cos - uy * sin;
  const dirY = ux * sin + uy * cos;
  const lateral = Math.sin(aim.dev);

  const speed = MIN_SPEED + aim.power * (MAX_SPEED - MIN_SPEED);
  const vz = vzForPower(aim.power);
  // Spin oposto ao desvio da mira: chute aberto curva de volta ao centro.
  const spinZ = Math.max(-1, Math.min(1, -SPIN_AIM_K * lateral));

  const dipScale = Math.max(0.55, Math.min(1.3, DIP_REF_DIST / goalDist));
  const dipPower = Math.max(0, (aim.power - 0.5) / 0.5);
  // Efeito também derruba a bola (Magnus com componente vertical):
  // a cavadinha alta só cai dentro do gol se tiver curva.
  const spinDip = Math.abs(spinZ) * 2.6;

  return {
    v: vec3(dirX * speed, dirY * speed, vz),
    spinZ,
    dip: DIP_ACCEL_MAX * dipPower * dipScale + spinDip,
  };
}

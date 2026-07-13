import { CANVAS_H, CANVAS_W, GOAL_LINE_Y, toScreen } from "./camera";
import { GOAL_HALF, GOAL_HEIGHT, KEEPER_DEPTH } from "../sim/world";
import { AIM_RADIUS_PX } from "../sim/kick";
import type { WallPlacement } from "../levels/levels";

const FIELD_TOP = GOAL_LINE_Y - 14;

export type Mood = "neutral" | "grit" | "happy" | "sad" | "worried";

/** Arquibancada + placas; a torcida pula de alegria quando `excite` > 0. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, time = 0, excite = 0): void {
  ctx.fillStyle = "#7ecfd4";
  ctx.fillRect(0, 0, CANVAS_W, FIELD_TOP - 22);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 24; i++) {
      const cx = i * 21 + (row % 2 ? 10 : 0);
      const bounce = excite > 0 ? Math.max(0, Math.sin(time * 11 + i * 1.3 + row)) * 6 * excite : 0;
      const cy = 14 + row * 26 - bounce;
      ctx.fillStyle = ["#f2c894", "#e8b07a", "#d99f66"][(i + row) % 3];
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ["#d44", "#46b", "#e90", "#7a3"][(i * 7 + row * 3) % 4];
      ctx.fillRect(cx - 8, cy + 6, 16, 12);
    }
  }
  // Placas de publicidade
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(0, FIELD_TOP - 22, CANVAS_W, 22);
  ctx.fillStyle = "#c9a400";
  ctx.font = "bold 14px Trebuchet MS, sans-serif";
  for (let i = 0; i < 8; i++) {
    ctx.fillText("FRENZY", i * 64 + 6, FIELD_TOP - 6);
  }
}

/** Tela de título: sunburst girando + batedor gigante comemorando. */
export function drawTitleScene(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = "#ffb300";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
  ctx.rotate(time * 0.12);
  ctx.fillStyle = "#ffe23d";
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 620, -0.13, 0.13);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // bola gigante quicando
  const by = 430 - Math.abs(Math.sin(time * 2.4)) * 55;
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(330, 448, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(330, by, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#222";
  for (let i = 0; i < 3; i++) {
    const a = time * 3 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(330 + Math.cos(a) * 17, by + Math.sin(a) * 17, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(330, by, 6, 0, Math.PI * 2);
  ctx.fill();
}

/** Selo "REPLAY" piscando. */
export function drawReplayBadge(ctx: CanvasRenderingContext2D, time: number): void {
  if (Math.sin(time * 6) < -0.3) return;
  ctx.save();
  ctx.font = "bold 18px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#e33";
  ctx.beginPath();
  ctx.arc(24, 195, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText("REPLAY", 36, 201);
  ctx.restore();
}

export function drawField(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, FIELD_TOP, 0, CANVAS_H);
  grad.addColorStop(0, "#3daa3d");
  grad.addColorStop(1, "#5ec44a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, FIELD_TOP, CANVAS_W, CANVAS_H - FIELD_TOP);

  // faixas de grama
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 6; i++) {
    const y1 = toScreen(0, i * 8).sy;
    const y2 = toScreen(0, i * 8 + 4).sy;
    ctx.fillRect(0, y1, CANVAS_W, y2 - y1);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;

  // Linha de fundo
  line(ctx, -14, 0, 14, 0);
  // Grande área (16,5 m × 40,32 m)
  rectWorld(ctx, -20.16, 0, 20.16, 16.5);
  // Pequena área (5,5 m × 18,32 m)
  rectWorld(ctx, -9.16, 0, 9.16, 5.5);
  // Marca do pênalti + meia-lua
  const pen = toScreen(0, 11);
  ctx.beginPath();
  ctx.arc(pen.sx, pen.sy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  arcWorld(ctx, 0, 11, 9.15, 16.5);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const a = toScreen(x1, y1);
  const b = toScreen(x2, y2);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
}

function rectWorld(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  line(ctx, x1, y1, x1, y2);
  line(ctx, x2, y1, x2, y2);
  line(ctx, x1, y2, x2, y2);
}

/** Arco no chão (círculo em metros), desenhado só onde y > minY. */
function arcWorld(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  minY: number,
): void {
  ctx.beginPath();
  let started = false;
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (y < minY) {
      started = false;
      continue;
    }
    const p = toScreen(x, y);
    if (!started) {
      ctx.moveTo(p.sx, p.sy);
      started = true;
    } else {
      ctx.lineTo(p.sx, p.sy);
    }
  }
  ctx.stroke();
}

/** Alvo de ¼ de círculo num ângulo superior (no plano do gol). */
function cornerTarget(
  ctx: CanvasRenderingContext2D,
  cornerX: number,
  rIn: number,
  rOut: number,
  color: string,
): void {
  // Quarto voltado para dentro do gol: do eixo horizontal (em direção
  // ao centro) até o eixo vertical (para baixo).
  const inward = cornerX > 0 ? -1 : 1;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (Math.PI / 2) * (i / 12);
    const x = cornerX + inward * rOut * Math.cos(a);
    const z = GOAL_HEIGHT - rOut * Math.sin(a);
    const p = toScreen(x, 0, z);
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  for (let i = 12; i >= 0; i--) {
    const a = (Math.PI / 2) * (i / 12);
    const x = cornerX + inward * rIn * Math.cos(a);
    const z = GOAL_HEIGHT - rIn * Math.sin(a);
    const p = toScreen(x, 0, z);
    ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawGoal(
  ctx: CanvasRenderingContext2D,
  netBall: { x: number; y: number; z: number } | null = null,
): void {
  const tl = toScreen(-GOAL_HALF, 0, GOAL_HEIGHT);
  const br = toScreen(GOAL_HALF, 0, 0);
  const w = br.sx - tl.sx;
  const h = br.sy - tl.sy;

  // Rede
  ctx.fillStyle = "rgba(230,255,230,0.25)";
  ctx.fillRect(tl.sx, tl.sy, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 20; i++) {
    const x = tl.sx + (w * i) / 20;
    ctx.beginPath();
    ctx.moveTo(x, tl.sy);
    ctx.lineTo(x, br.sy);
    ctx.stroke();
  }
  for (let i = 0; i <= 9; i++) {
    const y = tl.sy + (h * i) / 9;
    ctx.beginPath();
    ctx.moveTo(tl.sx, y);
    ctx.lineTo(br.sx, y);
    ctx.stroke();
  }

  // Rede estufando onde a bola está presa nela
  if (netBall) {
    const b = toScreen(netBall.x, netBall.y, netBall.z);
    const depth = Math.min(1, -netBall.y / 1.2);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * depth})`;
    ctx.lineWidth = 1.5;
    for (const rr of [9, 15]) {
      ctx.beginPath();
      ctx.ellipse(b.sx, b.sy, rr, rr * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Alvos dos ângulos: ¼ interno vermelho, ¼ externo azul, translúcidos
  for (const cx of [-GOAL_HALF, GOAL_HALF]) {
    cornerTarget(ctx, cx, 0, 0.85, "rgba(226,50,50,0.42)");
    cornerTarget(ctx, cx, 0.85, 1.6, "rgba(70,130,220,0.26)");
  }

  // Traves e travessão
  ctx.strokeStyle = "#f8f8f8";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tl.sx, br.sy);
  ctx.lineTo(tl.sx, tl.sy);
  ctx.lineTo(br.sx, tl.sy);
  ctx.lineTo(br.sx, br.sy);
  ctx.stroke();
  ctx.lineCap = "butt";
}

interface FigureOpts {
  shirt: string;
  shorts: string;
  scale?: number;
  mood?: Mood;
  armsUp?: boolean;
  /** Fase da passada (0..1) para animar as pernas correndo. */
  runPhase?: number;
  /** Elevação em pixels (pulo da barreira). */
  liftPx?: number;
  /** Inclinação do corpo em radianos (mergulho do goleiro). */
  tiltRad?: number;
}

/** Bonequinho flat com pernas, braços e carinha. Pés em (x, y) do chão. */
function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: FigureOpts,
): void {
  const feet = toScreen(x, y);
  const s = opts.scale ?? 1;
  const mood = opts.mood ?? "neutral";
  const skin = "#f2c894";
  ctx.save();
  ctx.translate(feet.sx, feet.sy);
  ctx.lineWidth = 1;

  // sombra (fica no chão mesmo se o corpo pular/inclinar)
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (opts.liftPx) ctx.translate(0, -opts.liftPx);
  if (opts.tiltRad) {
    // gira em torno do quadril para a pose de mergulho
    ctx.translate(0, -14 * s);
    ctx.rotate(opts.tiltRad);
    ctx.translate(0, 14 * s);
  }

  // pernas (com passada de corrida opcional)
  const stride = opts.runPhase != null ? Math.sin(opts.runPhase * Math.PI * 2) * 3.5 : 0;
  ctx.fillStyle = skin;
  ctx.fillRect(-4.5 * s + stride * s * 0.4, -11 * s, 3.2 * s, 11 * s);
  ctx.fillRect(1.3 * s - stride * s * 0.4, -11 * s, 3.2 * s, 11 * s);
  // chuteiras
  ctx.fillStyle = "#222";
  ctx.fillRect(-5 * s + stride * s * 0.4, -2.5 * s, 4.2 * s, 2.5 * s);
  ctx.fillRect(0.8 * s - stride * s * 0.4, -2.5 * s, 4.2 * s, 2.5 * s);

  // calção
  ctx.fillStyle = opts.shorts;
  ctx.fillRect(-6 * s, -16 * s, 12 * s, 6.5 * s);

  // braços
  ctx.fillStyle = skin;
  if (opts.armsUp) {
    ctx.fillRect(-9.5 * s, -38 * s, 3 * s, 13 * s);
    ctx.fillRect(6.5 * s, -38 * s, 3 * s, 13 * s);
  } else {
    ctx.fillRect(-9.5 * s, -27 * s, 3 * s, 11 * s);
    ctx.fillRect(6.5 * s, -27 * s, 3 * s, 11 * s);
  }

  // camisa
  ctx.fillStyle = opts.shirt;
  ctx.fillRect(-7 * s, -28 * s, 14 * s, 13 * s);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.strokeRect(-7 * s, -28 * s, 14 * s, 13 * s);

  // cabeça
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -34 * s, 6.5 * s, 0, Math.PI * 2);
  ctx.fill();
  // cabelo
  ctx.fillStyle = "#8a5a2b";
  ctx.beginPath();
  ctx.arc(0, -35.5 * s, 6.5 * s, Math.PI, Math.PI * 2);
  ctx.fill();

  // rosto
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(-2.2 * s, -34.5 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.arc(2.2 * s, -34.5 * s, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  switch (mood) {
    case "grit": {
      // careta de dentes cerrados (a clássica da barreira)
      ctx.fillStyle = "#fff";
      ctx.fillRect(-2.6 * s, -31.5 * s, 5.2 * s, 2.2 * s);
      ctx.strokeStyle = "#222";
      ctx.strokeRect(-2.6 * s, -31.5 * s, 5.2 * s, 2.2 * s);
      ctx.beginPath();
      ctx.moveTo(0, -31.5 * s);
      ctx.lineTo(0, -29.3 * s);
      ctx.stroke();
      break;
    }
    case "happy": {
      ctx.strokeStyle = "#222";
      ctx.beginPath();
      ctx.arc(0, -31.5 * s, 2.4 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }
    case "sad": {
      ctx.strokeStyle = "#222";
      ctx.beginPath();
      ctx.arc(0, -28.5 * s, 2.4 * s, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      break;
    }
    case "worried": {
      ctx.beginPath();
      ctx.arc(0, -30.5 * s, 1.3 * s, 0, Math.PI * 2);
      ctx.strokeStyle = "#222";
      ctx.stroke();
      break;
    }
    default: {
      ctx.strokeStyle = "#222";
      ctx.beginPath();
      ctx.moveTo(-1.8 * s, -30.8 * s);
      ctx.lineTo(1.8 * s, -30.8 * s);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: WallPlacement,
  jumpZ = 0,
): void {
  const spacing = (wall.halfWidth * 2) / wall.count;
  for (let i = 0; i < wall.count; i++) {
    const x = wall.x - wall.halfWidth + spacing * (i + 0.5);
    drawFigure(ctx, x, wall.y, {
      shirt: "#d42a2a",
      shorts: "#a51f1f",
      scale: 0.9,
      mood: "grit",
      liftPx: jumpZ * 21,
    });
  }
}

export function drawKeeper(
  ctx: CanvasRenderingContext2D,
  keeperX: number,
  mood: Mood,
  dive = 0,
): void {
  drawFigure(ctx, keeperX, KEEPER_DEPTH, {
    shirt: "#888",
    shorts: "#555",
    scale: 0.88,
    mood,
    armsUp: mood === "worried",
    tiltRad: dive * 0.9,
  });
}

export function drawKicker(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  runPhase?: number,
): void {
  drawFigure(ctx, pos.x, pos.y, {
    shirt: "#2a9fd4",
    shorts: "#1c7aa5",
    mood: runPhase != null ? "grit" : "neutral",
    runPhase,
  });
}

/** Meia-lua de mira: círculo perfeito em coordenadas de tela. */
export function drawAimZone(
  ctx: CanvasRenderingContext2D,
  ballS: { sx: number; sy: number },
  cS: { sx: number; sy: number },
): void {
  const base = Math.atan2(ballS.sy - cS.sy, ballS.sx - cS.sx);
  ctx.beginPath();
  ctx.arc(cS.sx, cS.sy, AIM_RADIUS_PX, base + Math.PI / 2, base + Math.PI * 1.5);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
}

export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  kicker: { x: number; y: number },
  ball: { x: number; y: number },
  dir: { x: number; y: number },
): void {
  // Do batedor até a bola, e da bola em diante na direção efetiva do
  // chute (o efeito ainda curva a partir dela — a linha é um guia).
  const reach = Math.hypot(ball.x, ball.y) + 2;
  const from = toScreen(kicker.x, kicker.y);
  const to = toScreen(ball.x + dir.x * reach, ball.y + dir.y * reach);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(from.sx, from.sy);
  ctx.lineTo(to.sx, to.sy);
  ctx.stroke();
  ctx.restore();
}

/** Rastro do voo: pontinhos translúcidos na posição projetada (com altura). */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: { x: number; y: number; z: number }[],
): void {
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  for (const p of trail) {
    const s = toScreen(p.x, p.y, p.z);
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Pentágono preenchido com rotação. */
function pentagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rot: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; z: number },
  rot = 0,
): void {
  const ground = toScreen(p.x, p.y);
  const ball = toScreen(p.x, p.y, p.z);
  // Menor e clássica: a leitura de altura vem da distância até a sombra.
  const r = Math.max(3, 4.2 - p.z * 0.12);

  // sombra
  const shadowScale = Math.max(0.35, 1 - p.z * 0.06);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, 4.2 * shadowScale, 2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // couro branco
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ball.sx, ball.sy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // padrão clássico: pentágono central + gomos na borda + costuras,
  // tudo girando junto (recortado pelo círculo do couro)
  ctx.save();
  ctx.beginPath();
  ctx.arc(ball.sx, ball.sy, r - 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#1a1a1a";
  pentagon(ctx, ball.sx, ball.sy, r * 0.42, rot);
  // gomos parciais na borda, alinhados aos vértices do pentágono
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
    const gx = ball.sx + Math.cos(a) * r * 1.05;
    const gy = ball.sy + Math.sin(a) * r * 1.05;
    pentagon(ctx, gx, gy, r * 0.42, rot + Math.PI / 5);
  }
  // costuras dos vértices até os gomos
  ctx.strokeStyle = "rgba(26,26,26,0.5)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2 + Math.PI / 5;
    ctx.beginPath();
    ctx.moveTo(ball.sx + Math.cos(a) * r * 0.42, ball.sy + Math.sin(a) * r * 0.42);
    ctx.lineTo(ball.sx + Math.cos(a) * r, ball.sy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

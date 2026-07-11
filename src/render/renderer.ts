import { CANVAS_H, CANVAS_W, GOAL_LINE_Y, toScreen } from "./camera";
import { GOAL_HALF, GOAL_HEIGHT, KEEPER_DEPTH } from "../sim/world";
import { AIM_CIRCLE_RADIUS, aimCircleCenter } from "../sim/kick";
import type { WallPlacement } from "../levels/levels";

const FIELD_TOP = GOAL_LINE_Y - 14;

export function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  // Arquibancada
  ctx.fillStyle = "#7ecfd4";
  ctx.fillRect(0, 0, CANVAS_W, FIELD_TOP - 22);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 24; i++) {
      const cx = i * 21 + (row % 2 ? 10 : 0);
      const cy = 14 + row * 26;
      ctx.fillStyle = ["#f2c894", "#e8b07a", "#d99f66"][(i + row) % 3];
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
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

export function drawField(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, FIELD_TOP, 0, CANVAS_H);
  grad.addColorStop(0, "#3daa3d");
  grad.addColorStop(1, "#5ec44a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, FIELD_TOP, CANVAS_W, CANVAS_H - FIELD_TOP);

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;

  // Linha de fundo
  line(ctx, -12, 0, 12, 0);
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

export function drawGoal(ctx: CanvasRenderingContext2D): void {
  const tl = toScreen(-GOAL_HALF, 0, GOAL_HEIGHT);
  const br = toScreen(GOAL_HALF, 0, 0);
  const w = br.sx - tl.sx;
  const h = br.sy - tl.sy;

  // Rede
  ctx.fillStyle = "rgba(230,255,230,0.25)";
  ctx.fillRect(tl.sx, tl.sy, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 14; i++) {
    const x = tl.sx + (w * i) / 14;
    ctx.beginPath();
    ctx.moveTo(x, tl.sy);
    ctx.lineTo(x, br.sy);
    ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const y = tl.sy + (h * i) / 6;
    ctx.beginPath();
    ctx.moveTo(tl.sx, y);
    ctx.lineTo(br.sx, y);
    ctx.stroke();
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

/** Bonequinho estilo flat: pés na posição (x, y) do chão. */
function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shirt: string,
  shorts: string,
  scale = 1,
): void {
  const feet = toScreen(x, y);
  const s = scale;
  ctx.save();
  ctx.translate(feet.sx, feet.sy);

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 11 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // pernas/calção
  ctx.fillStyle = shorts;
  ctx.fillRect(-6 * s, -14 * s, 12 * s, 9 * s);
  // camisa
  ctx.fillStyle = shirt;
  ctx.fillRect(-8 * s, -28 * s, 16 * s, 15 * s);
  // cabeça
  ctx.fillStyle = "#f2c894";
  ctx.beginPath();
  ctx.arc(0, -33 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  // cabelo
  ctx.fillStyle = "#8a5a2b";
  ctx.beginPath();
  ctx.arc(0, -35 * s, 7 * s, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawWall(ctx: CanvasRenderingContext2D, wall: WallPlacement, count: number): void {
  const spacing = (wall.halfWidth * 2) / count;
  for (let i = 0; i < count; i++) {
    const x = wall.x - wall.halfWidth + spacing * (i + 0.5);
    drawFigure(ctx, x, wall.y, "#d42a2a", "#a51f1f", 0.9);
  }
}

export function drawKeeper(ctx: CanvasRenderingContext2D, keeperX: number): void {
  drawFigure(ctx, keeperX, KEEPER_DEPTH, "#888", "#666", 0.85);
}

export function drawKicker(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }): void {
  drawFigure(ctx, pos.x, pos.y, "#2a9fd4", "#1c7aa5", 1);
}

export function drawAimZone(
  ctx: CanvasRenderingContext2D,
  ball: { x: number; y: number },
): void {
  const c = aimCircleCenter(ball);
  const dist = Math.hypot(ball.x, ball.y);
  const nx = -ball.x / dist;
  const ny = -ball.y / dist;
  // ângulo da direção ao gol; o semicírculo fica no lado oposto
  const base = Math.atan2(ny, nx);

  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = base + Math.PI / 2 + (Math.PI * i) / 32;
    const p = toScreen(
      c.x + AIM_CIRCLE_RADIUS * Math.cos(a),
      c.y + AIM_CIRCLE_RADIUS * Math.sin(a),
    );
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else ctx.lineTo(p.sx, p.sy);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
}

export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  kicker: { x: number; y: number },
  ball: { x: number; y: number },
): void {
  let dx = ball.x - kicker.x;
  let dy = ball.y - kicker.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const reach = Math.hypot(ball.x, ball.y) + 2;
  const from = toScreen(kicker.x, kicker.y);
  const to = toScreen(ball.x + dx * reach, ball.y + dy * reach);

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

export function drawBall(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; z: number },
): void {
  const ground = toScreen(p.x, p.y);
  const ball = toScreen(p.x, p.y, p.z);
  // A bola "encolhe" levemente quanto mais alta, para dar leitura de altura.
  const r = Math.max(4.5, 7 - p.z * 0.35);

  // sombra
  const shadowScale = Math.max(0.35, 1 - p.z * 0.06);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, 7 * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // bola
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ball.sx, ball.sy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // gomos
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(ball.sx, ball.sy, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

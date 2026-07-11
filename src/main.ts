import "./style.css";
import { Game, type ShotResult } from "./game/game";
import { CANVAS_H, CANVAS_W } from "./render/camera";
import { starsForScore } from "./scoring/score";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const screenTitle = $("#screen-title");
const screenResult = $("#screen-result");
const hud = $("#hud");
const toast = $("#toast");
const resultTitle = $("#result-title");
const resultDetail = $("#result-detail");
const btnNext = $<HTMLButtonElement>("#btn-next");

const MISS_LABEL: Record<string, string> = {
  wall: "Na barreira!",
  keeper: "Defendeu o goleiro!",
  post: "Na trave!",
  crossbar: "No travessão!",
  out: "Pra fora!",
};

let toastTimer: number | undefined;

function showToast(text: string): void {
  toast.textContent = text;
  toast.classList.remove("hidden");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 1200);
}

function starLabel(score: number): string {
  const stars = starsForScore(score);
  if (stars === 4) return "🏆 PLATINA!";
  return "⭐".repeat(stars);
}

const game = new Game({
  onGoal(result: ShotResult, _levelIdx: number, isLast: boolean) {
    resultTitle.textContent = "GOL!";
    resultDetail.textContent = `Score ${result.score}/100 — ${starLabel(result.score)}`;
    btnNext.textContent = isLast ? "Jogar de novo" : "Próxima fase";
    screenResult.classList.remove("hidden");
  },
  onMiss(result: ShotResult) {
    showToast(MISS_LABEL[result.reason ?? "out"]);
  },
  onHudChange(levelIdx: number, total: number) {
    $("#hud-level").textContent = `${levelIdx + 1}/${total}`;
  },
});

$("#btn-play").addEventListener("click", () => {
  screenTitle.classList.add("hidden");
  hud.classList.remove("hidden");
  game.start();
});

$("#btn-retry").addEventListener("click", () => {
  screenResult.classList.add("hidden");
  game.retryLevel();
});

btnNext.addEventListener("click", () => {
  screenResult.classList.add("hidden");
  game.nextLevel();
});

// Mouse em coordenadas do canvas (o CSS pode escalar o elemento).
function canvasPos(e: MouseEvent): { sx: number; sy: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    sx: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
    sy: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
  };
}

canvas.addEventListener("mousemove", (e) => {
  const { sx, sy } = canvasPos(e);
  game.pointerMove(sx, sy);
});

canvas.addEventListener("click", (e) => {
  const { sx, sy } = canvasPos(e);
  game.pointerClick(sx, sy);
});

// Game loop: física em timestep fixo, render por frame.
const SIM_DT = 1 / 120;
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= SIM_DT) {
    game.update(SIM_DT);
    acc -= SIM_DT;
  }
  game.render(ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

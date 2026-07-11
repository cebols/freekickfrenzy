import "./style.css";
import { Game, type ShotResult, type Wind } from "./game/game";
import { LEVELS } from "./levels/levels";
import { CANVAS_H, CANVAS_W } from "./render/camera";
import { starsForScore } from "./scoring/score";
import { loadProgress, saveGoal, type Progress } from "./persist/storage";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const screenTitle = $("#screen-title");
const screenLevels = $("#screen-levels");
const screenResult = $("#screen-result");
const hud = $("#hud");
const toast = $("#toast");
const resultTitle = $("#result-title");
const resultStars = $("#result-stars");
const resultDetail = $("#result-detail");
const btnNext = $<HTMLButtonElement>("#btn-next");
const levelsGrid = $("#levels-grid");

let progress: Progress = loadProgress();

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
  return stars === 4 ? "🏆" : "⭐".repeat(stars);
}

function showLevels(): void {
  levelsGrid.innerHTML = "";
  LEVELS.forEach((level, i) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    const locked = i > progress.unlocked;
    btn.disabled = locked;
    const best = progress.best[i];
    btn.innerHTML = `<span>${locked ? "🔒" : i + 1}</span><span class="stars">${
      best ? starLabel(best) + ` ${best}` : ""
    }</span>`;
    btn.title = level.name;
    btn.addEventListener("click", () => {
      screenLevels.classList.add("hidden");
      hud.classList.remove("hidden");
      game.loadLevel(i);
    });
    levelsGrid.appendChild(btn);
  });
  screenLevels.classList.remove("hidden");
}

const game = new Game({
  onGoal(result: ShotResult, levelIdx: number, isLast: boolean) {
    progress = saveGoal(levelIdx, result.score);
    resultTitle.textContent = "GOL!";
    resultStars.textContent = starLabel(result.score);
    resultDetail.textContent = `Score ${result.score}/100${
      result.score >= 100 ? " — PLATINA!" : ""
    }`;
    btnNext.textContent = isLast ? "Fases" : "Próxima";
    screenResult.classList.remove("hidden");
  },
  onMiss(result: ShotResult) {
    showToast(MISS_LABEL[result.reason ?? "out"]);
  },
  onHudChange(levelIdx: number, total: number) {
    $("#hud-level").textContent = `${levelIdx + 1}/${total}`;
  },
  onWind(wind: Wind) {
    // A seta aponta para onde o vento sopra, no referencial da tela
    // (mundo +y aponta para baixo na tela, igual ao ângulo CSS).
    $("#wind-arrow").style.transform = `rotate(${wind.dir}rad)`;
    $("#wind-force").textContent = String(wind.force);
    const strength = wind.force / 100;
    $("#wind-arrow").style.color = strength > 0.6 ? "#f26d6d" : strength > 0.3 ? "#f2c94c" : "#6db3f2";
  },
});

// Exposto para testes automatizados e depuração no console.
(window as unknown as { __game: Game }).__game = game;

$("#btn-play").addEventListener("click", () => {
  screenTitle.classList.add("hidden");
  showLevels();
});

$("#btn-retry").addEventListener("click", () => {
  screenResult.classList.add("hidden");
  game.retryLevel();
});

$("#btn-levels").addEventListener("click", () => {
  screenResult.classList.add("hidden");
  hud.classList.add("hidden");
  showLevels();
});

btnNext.addEventListener("click", () => {
  screenResult.classList.add("hidden");
  if (game.levelIdx === LEVELS.length - 1) {
    hud.classList.add("hidden");
    showLevels();
  } else {
    game.nextLevel();
  }
});

// Posição do ponteiro em coordenadas do canvas (o CSS escala o elemento).
function canvasPos(e: PointerEvent): { sx: number; sy: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    sx: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
    sy: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
  };
}

// Mouse: hover mira, clique chuta. Touch: arrastar mira (a linha
// acompanha o dedo), soltar chuta — sem depender de hover.
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const { sx, sy } = canvasPos(e);
  game.pointerMove(sx, sy);
});

canvas.addEventListener("pointermove", (e) => {
  const { sx, sy } = canvasPos(e);
  game.pointerMove(sx, sy);
});

canvas.addEventListener("pointerup", (e) => {
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

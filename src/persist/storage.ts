// Progresso do jogador em localStorage: melhor score por fase e até
// onde ele desbloqueou.

const KEY = "freekickfrenzy.progress.v1";

export interface Progress {
  /** Melhor score (1-100) por índice de fase. */
  best: Record<number, number>;
  /** Maior índice de fase desbloqueado. */
  unlocked: number;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (p && typeof p.unlocked === "number" && p.best) return p;
    }
  } catch {
    // storage indisponível/corrompido: recomeça
  }
  return { best: {}, unlocked: 0 };
}

export function saveGoal(levelIdx: number, score: number): Progress {
  const p = loadProgress();
  p.best[levelIdx] = Math.max(p.best[levelIdx] ?? 0, score);
  p.unlocked = Math.max(p.unlocked, levelIdx + 1);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // sem storage (modo anônimo etc.): progresso só na sessão
  }
  return p;
}

// Efeitos sonoros sintetizados com WebAudio — sem assets externos.
// O AudioContext só é criado no primeiro gesto do usuário (política dos
// navegadores); antes disso as chamadas são no-ops silenciosos.

let ctx: AudioContext | null = null;
let muted = false;

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }
  void ctx?.resume();
}

function now(): number {
  return ctx!.currentTime;
}

function noiseBuffer(seconds: number): AudioBuffer {
  const buf = ctx!.createBuffer(1, Math.ceil(ctx!.sampleRate * seconds), ctx!.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(
  seconds: number,
  filterType: BiquadFilterType,
  freqFrom: number,
  freqTo: number,
  gainPeak: number,
  attack = 0.01,
): void {
  if (!ctx || muted) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(seconds);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freqFrom, now());
  filter.frequency.linearRampToValueAtTime(freqTo, now() + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now());
  gain.gain.linearRampToValueAtTime(gainPeak, now() + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now() + seconds);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

function playTone(
  type: OscillatorType,
  freqFrom: number,
  freqTo: number,
  seconds: number,
  gainPeak: number,
): void {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, now());
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), now() + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, now());
  gain.gain.exponentialRampToValueAtTime(0.001, now() + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(now() + seconds);
}

export const sfx = {
  /** Thump do chute. */
  kick(): void {
    playNoise(0.12, "lowpass", 400, 80, 0.5, 0.005);
    playTone("sine", 120, 45, 0.12, 0.4);
  },
  /** Toing metálico da trave. */
  post(): void {
    playTone("triangle", 1250, 1180, 0.4, 0.35);
    playTone("sine", 2500, 2380, 0.25, 0.12);
  },
  /** Baque surdo na barreira / no goleiro. */
  thud(): void {
    playNoise(0.15, "lowpass", 300, 60, 0.55, 0.005);
  },
  /** Chuá da rede + torcida vibrando. */
  goal(): void {
    playNoise(0.25, "highpass", 2500, 1500, 0.25, 0.01);
    playNoise(1.6, "bandpass", 900, 1400, 0.55, 0.25);
  },
  /** "Ohhh" da torcida no erro. */
  miss(): void {
    playNoise(0.9, "bandpass", 700, 300, 0.3, 0.15);
  },
  /** Apito de início de fase. */
  whistle(): void {
    playTone("square", 2200, 2100, 0.28, 0.12);
  },
};

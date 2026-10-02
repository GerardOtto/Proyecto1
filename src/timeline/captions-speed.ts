// Velocidad de exportacion (ADR 0015): reescala los tiempos de un SRT cuando el MP4 se acelera. Pura.

const toMs = (t: string): number => {
  const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/.exec(t.trim());
  if (!m) throw new Error(`Tiempo SRT invalido: ${t}`);
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]);
};

const fromMs = (ms: number): string => {
  const v = Math.max(0, Math.round(ms));
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(v / 3600000))}:${p(Math.floor(v / 60000) % 60)}:${p(Math.floor(v / 1000) % 60)},${p(v % 1000, 3)}`;
};

/** Divide cada marca de tiempo entre `speed` (1.1 -> los subtitulos llegan un 10 % antes). */
export const scaleSrt = (srt: string, speed: number): string =>
  speed === 1 ? srt : srt.replace(/(\d+:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d+:\d{2}:\d{2}[,.]\d{3})/g, (_, a: string, b: string) => `${fromMs(toMs(a) / speed)} --> ${fromMs(toMs(b) / speed)}`);

// Conversion ms <-> frames. Regla: siempre redondeo al frame mas cercano para inicios/fines,
// asi dos escenas contiguas (endMs == startMs) nunca dejan huecos ni se solapan.

export const msToFrame = (ms: number, fps: number): number => Math.round((ms * fps) / 1000);

export const frameToMs = (frame: number, fps: number): number => Math.round((frame * 1000) / fps);

/** Numero de frames necesarios para cubrir `ms` (al menos 1). */
export const msToDurationInFrames = (ms: number, fps: number): number =>
  Math.max(1, Math.ceil((ms * fps) / 1000 - 1e-9));

/** Rango [from, to) en frames para un intervalo en ms. Garantiza to > from. */
export const msRangeToFrames = (
  startMs: number,
  endMs: number,
  fps: number,
): { from: number; to: number } => {
  const from = msToFrame(startMs, fps);
  const to = Math.max(from + 1, msToFrame(endMs, fps));
  return { from, to };
};

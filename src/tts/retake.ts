// Retoma automatica (ADR 0015): algunas voces de Fish a veces "cantan" o arrastran una linea; esas tomas
// salen mucho mas lentas (p. ej. 1,6 pal/s frente a 3 pal/s). Se pide otra toma mientras el ritmo quede
// por debajo del minimo y se conserva la mas fluida. Sin dependencias de proveedor: testeable con fakes.

export interface Take {
  file: string;
  wps: number;
}

export const countWords = (text: string): number => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export const synthesizeWithRetakes = async (opts: {
  /** Pide la toma n (1, 2, ...) y devuelve su archivo. */
  synth: (take: number) => Promise<string>;
  /** Palabras por segundo de un archivo. */
  rate: (file: string) => Promise<number>;
  minWps?: number;
  maxTakes: number;
  /** Toma previa (p. ej. la del cache) que ya se sabe lenta. */
  initial?: Take;
  onSlow?: (take: number, wps: number, last: boolean) => void;
}): Promise<{ best: Take; takes: string[] }> => {
  let best: Take | null = opts.initial ?? null;
  const takes: string[] = [];
  const max = opts.minWps ? Math.max(1, opts.maxTakes) : 1;
  for (let take = 1; take <= max; take++) {
    const file = await opts.synth(take);
    takes.push(file);
    const wps = opts.minWps ? await opts.rate(file) : Infinity;
    if (!best || wps > best.wps) best = { file, wps };
    if (!opts.minWps || wps >= opts.minWps) break;
    opts.onSlow?.(take, wps, take === max);
  }
  return { best: best!, takes };
};

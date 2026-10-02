// ADR 0015: retoma automatica de tomas lentas ("cantadas" o arrastradas) por ritmo de habla.
import { describe, expect, it } from "vitest";
import { countWords, synthesizeWithRetakes } from "../src/tts/retake";

const fake = (rates: number[]) => {
  const calls: number[] = [];
  return {
    calls,
    synth: async (take: number) => {
      calls.push(take);
      return `take${take}.wav`;
    },
    rate: async (file: string) => rates[Number(/take(\d+)/.exec(file)![1]) - 1]!,
  };
};

describe("retoma por ritmo de habla", () => {
  it("cuenta palabras sin signos sueltos", () => {
    expect(countWords("¿Eh? ¿Neru intentó hablar? — Ah, no.")).toBe(6);
  });

  it("sin minimo: una sola toma", async () => {
    const f = fake([1.0]);
    const r = await synthesizeWithRetakes({ ...f, maxTakes: 3 });
    expect(f.calls).toEqual([1]);
    expect(r.best.file).toBe("take1.wav");
  });

  it("una toma lenta se vuelve a pedir hasta que llega una fluida", async () => {
    const f = fake([1.6, 3.1, 3.5]);
    const slow: number[] = [];
    const r = await synthesizeWithRetakes({ ...f, minWps: 2.3, maxTakes: 3, onSlow: (t) => slow.push(t) });
    expect(f.calls).toEqual([1, 2]);
    expect(slow).toEqual([1]);
    expect(r.best).toEqual({ file: "take2.wav", wps: 3.1 });
    expect(r.takes).toEqual(["take1.wav", "take2.wav"]);
  });

  it("si todas salen lentas, se queda la mas fluida (incluida la del cache)", async () => {
    const f = fake([1.5, 2.0, 1.7]);
    const r = await synthesizeWithRetakes({ ...f, minWps: 2.3, maxTakes: 3, initial: { file: "cache.wav", wps: 1.9 } });
    expect(f.calls).toEqual([1, 2, 3]);
    expect(r.best.file).toBe("take2.wav");
    const g = fake([1.5, 1.6, 1.7]);
    expect((await synthesizeWithRetakes({ ...g, minWps: 2.3, maxTakes: 3, initial: { file: "cache.wav", wps: 1.9 } })).best.file).toBe("cache.wav");
  });
});

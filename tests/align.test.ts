import { describe, expect, it } from "vitest";
import { alignWords } from "../src/transcribe/align";
import { distributeWords } from "../src/transcribe/estimate";

describe("alineado guion <-> transcripcion", () => {
  it("usa el texto del guion y los tiempos de whisper", () => {
    const rec = [
      { text: "China", startMs: 100, endMs: 400 },
      { text: "destruyo", startMs: 400, endMs: 900 },
      { text: "a", startMs: 900, endMs: 950 },
      { text: "chat", startMs: 950, endMs: 1300 },
      { text: "GPT", startMs: 1300, endMs: 1600 },
    ];
    const r = alignWords("¿China destruyó a ChatGPT?", rec, 2000);
    expect(r.words.map((w) => w.text)).toEqual(["¿China", "destruyó", "a", "ChatGPT?"]);
    expect(r.words[0]).toMatchObject({ startMs: 100, endMs: 400 });
    expect(r.words[1]).toMatchObject({ startMs: 400, endMs: 900 });
    // "ChatGPT" casa aproximadamente con "chat" (similitud >= 0.5)
    expect(r.matched).toBe(4);
    expect(r.words[3]!.startMs).toBe(950);
  });

  it("interpola palabras omitidas por el reconocedor y mantiene monotonia", () => {
    const rec = [
      { text: "uno", startMs: 0, endMs: 300 },
      { text: "cuatro", startMs: 1200, endMs: 1500 },
    ];
    const r = alignWords("uno dos tres cuatro", rec, 1600);
    expect(r.words.map((w) => w.text)).toEqual(["uno", "dos", "tres", "cuatro"]);
    expect(r.words[1]!.startMs).toBeGreaterThanOrEqual(300);
    expect(r.words[2]!.endMs).toBeLessThanOrEqual(1200);
    for (let i = 1; i < 4; i++) expect(r.words[i]!.startMs).toBeGreaterThanOrEqual(r.words[i - 1]!.startMs);
  });

  it("sin reconocimiento reparte todo el bloque", () => {
    const r = alignWords("a b c", [], 900);
    expect(r.matched).toBe(0);
    expect(r.words[0]!.startMs).toBe(0);
    expect(r.words[2]!.endMs).toBeLessThanOrEqual(900);
  });

  it("distributeWords reparte proporcionalmente", () => {
    const w = distributeWords("hola mundo", 100, 1100);
    expect(w[0]!.startMs).toBe(100);
    expect(w[1]!.endMs).toBe(1100);
  });
});

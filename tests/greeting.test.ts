import { describe, expect, it } from "vitest";
import { buildCaptionPages, gluedWords } from "../src/timeline/captions";
import type { CaptionWord, Timeline } from "../src/timeline/types";
import { splitGreeting } from "../src/tts/greeting";
import { engine } from "./helpers";

describe("saludo recurrente", () => {
  it("separa el saludo del resto de la linea", () => {
    expect(splitGreeting("¡Papu papu! ¿China destruyó a ChatGPT y Claude?", "¡Papu papu!")).toEqual({
      rest: "¿China destruyó a ChatGPT y Claude?",
    });
    expect(splitGreeting("papu, PAPU! Si te sirvió, déjanos tu Me gusta.", "¡Papu papu!")).toEqual({
      rest: "Si te sirvió, déjanos tu Me gusta.",
    });
  });

  it("linea que es solo el saludo: resto vacio", () => {
    expect(splitGreeting("¡Papu papu!", "¡Papu papu!")).toEqual({ rest: "" });
  });

  it("sin saludo al inicio: null (el saludo en medio de la frase no cuenta)", () => {
    expect(splitGreeting("Hola, ¡papu papu!", "¡Papu papu!")).toBeNull();
    expect(splitGreeting("Papu, escucha", "¡Papu papu!")).toBeNull();
  });
});

describe("subtitulos: expresiones que no se parten", () => {
  const w = (text: string, i: number, sceneId = "s1"): CaptionWord => ({ text, startMs: i * 300, endMs: i * 300 + 250, character: "miku", sceneId });

  it("marca las palabras pegadas de cada aparicion", () => {
    const words = ["déjanos", "tu", "Me", "gusta.", "me", "gusta"].map((t, i) => w(t, i));
    expect(gluedWords(words, ["Me gusta"])).toEqual([false, false, false, true, false, true]);
    expect(gluedWords(words, [])).toEqual(words.map(() => false));
  });

  it("'Me gusta' pasa completo a la pagina siguiente en vez de partirse", async () => {
    const { cfg } = await engine();
    const style = { ...cfg.render.captions, maxWordsPerPage: 6, keepTogether: ["Me gusta"] };
    const words = ["Si", "te", "sirvió,", "déjanos", "tu", "Me", "gusta."].map((t, i) => w(t, i));
    const tl = { meta: {}, scenes: [] } as unknown as Timeline;
    const pages = buildCaptionPages(words, tl, style).map((p) => p.tokens.map((t) => t.text).join(" "));
    expect(pages).toEqual(["Si te sirvió, déjanos tu", "Me gusta."]);
    const sinRegla = buildCaptionPages(words, tl, { ...style, keepTogether: [] }).map((p) => p.tokens.map((t) => t.text).join(" "));
    expect(sinRegla).toEqual(["Si te sirvió, déjanos tu Me", "gusta."]);
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadProject } from "../src/catalog/catalog";
import { buildDirectorSchema, directorOutputToBeats, llmDirector, type DirectorOutput } from "../src/director/llm/director";
import { MockLLMProvider } from "../src/director/llm/mock";
import { fromRepo } from "../src/utils/paths";
import { engine } from "./helpers";

const scene = (over: Partial<DirectorOutput["scenes"][number]>): DirectorOutput["scenes"][number] => ({
  id: "x", section: "development", kind: "dialogue", character: "teto", avatar: "neutral", dialogue: "", listeners: [], visuals: [], events: [], ...over,
});

const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

const validOutput: DirectorOutput = {
  title: "Prueba",
  scenes: [
    scene({ id: "hook", section: "hook", avatar: "sorprendido", dialogue: "¿Sabias que esto es un hook?", visuals: ["chatgpt_logo"] }),
    scene({ id: "meme", section: "reaction", kind: "meme", character: "", avatar: "", events: [{ type: "meme_explosion", atWord: -1, character: "", avatar: "", target: "", words: [] }] }),
    scene({ id: "dev", section: "development", character: "miku", avatar: "nerd", dialogue: words(60), events: [{ type: "character_reaction", atWord: 3, character: "teto", avatar: "shocked", target: "", words: [] }], listeners: [{ character: "teto", avatar: "neutral" }] }),
    scene({ id: "dev2", section: "development", character: "teto", avatar: "nerd", dialogue: words(60) }),
    scene({ id: "dev3", section: "visual", character: "miku", avatar: "neutral", dialogue: words(50), visuals: ["chart_benchmarks"] }),
    scene({ id: "close", section: "closing", avatar: "feliz", dialogue: "Y eso es todo por hoy." }),
  ],
};

describe("director LLM (proveedor simulado)", async () => {
  const { cfg, catalog } = await engine();
  const tmp = fs.mkdtempSync(path.join(fromRepo(".cache"), "llm-"));
  fs.writeFileSync(path.join(tmp, "script.md"), "Un guion libre sobre IA.");
  const project = loadProject(tmp);

  it("el schema de salida usa enums del catalogo y es compatible con structured outputs", () => {
    const s = JSON.stringify(buildDirectorSchema(catalog));
    expect(s).toContain('"teto"');
    expect(s).toContain('"chatgpt_logo"');
    for (const banned of ["oneOf", "minimum", "maximum", "maxItems", "minLength"]) expect(s).not.toContain(banned);
    expect(s).not.toContain('"additionalProperties":true');
  });

  it("convierte la salida a beats (\"\" -> ausente, atWord -1 -> inicio)", () => {
    const beats = directorOutputToBeats(validOutput);
    expect(beats[1]).toMatchObject({ kind: "meme", events: [{ type: "meme_explosion" }] });
    expect(beats[1]!.character).toBeUndefined();
    expect(beats[2]!.events[0]).toEqual({ type: "character_reaction", character: "teto", avatar: "shocked", atWord: 3 });
  });

  it("genera un timeline valido al primer intento", async () => {
    const provider = new MockLLMProvider([validOutput]);
    const res = await llmDirector(project, catalog, cfg, { provider });
    expect(res.attempts).toBe(1);
    expect(res.timeline.meta.timingSource).toBe("estimated");
    expect(res.timeline.scenes).toHaveLength(6);
  });

  it("reintenta con los errores del validador como feedback", async () => {
    const bad: DirectorOutput = { ...validOutput, scenes: validOutput.scenes.filter((s) => s.section !== "closing") };
    const provider = new MockLLMProvider([bad, validOutput]);
    const res = await llmDirector(project, catalog, cfg, { provider });
    expect(res.attempts).toBe(2);
    const feedback = provider.requests[1]!.messages.at(-1)!.content;
    expect(feedback).toContain("NO_CLOSING");
    expect(provider.requests[1]!.messages.at(-2)!.role).toBe("assistant");
  });

  it("falla tras agotar los intentos", async () => {
    const bad: DirectorOutput = { ...validOutput, scenes: [] };
    const provider = new MockLLMProvider([bad, bad]);
    await expect(llmDirector(project, catalog, cfg, { provider, maxAttempts: 2 })).rejects.toThrow(/2 intentos/);
  });

  it("incluye presupuesto de palabras y la instruccion de ajuste", async () => {
    const provider = new MockLLMProvider([validOutput]);
    await llmDirector(project, catalog, cfg, { provider, adjust: "compress", previousEstimateMs: 140000 });
    const user = provider.requests[0]!.messages[0]!.content;
    expect(user).toMatch(/Presupuesto aproximado: \d+ palabras/);
    expect(user).toContain("COMPRIME");
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { beatsToDraftTimeline, inferSections } from "../src/director/beats";
import { parseScript } from "../src/director/script-parser";
import { fromRepo } from "../src/utils/paths";
import { validateTimeline } from "../src/validation/timeline";
import { engine } from "./helpers";

// Guion de referencia de la seccion 11 del plan (tal cual).
const PDF_SCRIPT = `[TETO:surprised]
¿China destruyo a ChatGPT y Claude?

[MIKU:confused]
¿Pero de donde sacaste eso?

[SFX:meme_explosion]

[TETO:nerd]
Bueno... el titular exagera bastante.
El punto real es otro: la competencia en modelos de IA
esta cambiando muy rapido.

[MIKU:shocked]
Eso suena mucho menos dramatico.

[TETO:happy]
Si, pero es bastante mas interesante.`;

describe("parser de guion", async () => {
  const { cfg, catalog } = await engine();

  it("parsea el guion de referencia del plan", () => {
    const p = parseScript(PDF_SCRIPT, catalog);
    expect(p.errors).toEqual([]);
    expect(p.beats.map((b) => b.kind)).toEqual(["dialogue", "dialogue", "meme", "dialogue", "dialogue", "dialogue"]);
    expect(p.beats[3]!.dialogue).toBe("Bueno... el titular exagera bastante. El punto real es otro: la competencia en modelos de IA esta cambiando muy rapido.");
    expect(p.beats[2]!.events[0]).toEqual({ type: "meme_explosion" });
  });

  it("infiere hook / reaction / context / closing", () => {
    const beats = inferSections(parseScript(PDF_SCRIPT, catalog).beats);
    expect(beats.map((b) => b.section)).toEqual(["hook", "context", "reaction", "development", "punchline", "closing"]);
  });

  it("el borrador del guion de referencia es valido (salvo duracion: es corto)", () => {
    const p = parseScript(PDF_SCRIPT, catalog);
    const t = beatsToDraftTimeline(p.beats, { title: "x", durationTargetSec: 85, language: "es", generator: "test" }, cfg);
    const res = validateTimeline(t, catalog, cfg.render, { stage: "draft" });
    expect(res.errors).toBe(0);
    expect(res.issues.some((i) => i.code === "DURATION_TOO_SHORT")).toBe(true);
  });

  it("escenas del borrador contiguas y empezando en 0", () => {
    const p = parseScript(PDF_SCRIPT, catalog);
    const t = beatsToDraftTimeline(p.beats, { title: "x", durationTargetSec: 85, language: "es", generator: "test" }, cfg);
    expect(t.scenes[0]!.startMs).toBe(0);
    for (let i = 1; i < t.scenes.length; i++) expect(t.scenes[i]!.startMs).toBe(t.scenes[i - 1]!.endMs);
  });

  it("soporta secciones, directivas, tags inline y *enfasis*", () => {
    const src = `---
title: Prueba
target: 70
---
## gancho
[TETO:sorprendida]
[VISUAL: chatgpt_logo, claude_logo]
[LISTEN: miku:neutral]
Hola {REACT:miku:shocked}mundo *increible* hoy. {PAUSE:600}

## cierre
[MIKU:feliz]
{ZOOM}Chao.`;
    const p = parseScript(src, catalog);
    expect(p.errors).toEqual([]);
    expect(p.title).toBe("Prueba");
    expect(p.frontMatter.target).toBe("70");
    const [a, b] = p.beats;
    expect(a!.section).toBe("hook");
    expect(a!.visuals).toEqual(["chatgpt_logo", "claude_logo"]);
    expect(a!.listeners).toEqual([{ character: "miku", avatar: "neutral" }]);
    expect(a!.dialogue).toBe("Hola mundo increible hoy.");
    expect(a!.events).toContainEqual({ type: "character_reaction", character: "miku", avatar: "shocked", atWord: 1 });
    expect(a!.events).toContainEqual({ type: "pause", durationMs: 600 });
    expect(a!.events).toContainEqual({ type: "subtitle_emphasis", words: ["increible"] });
    expect(b!.section).toBe("closing");
    expect(b!.events).toContainEqual({ type: "camera_zoom", atWord: 0 });
  });

  it("reporta errores con numero de linea: reaccion, asset y personaje desconocidos", () => {
    const p = parseScript(`[TETO:sorpresa2]\nHola\n\n[VISUAL: logo_inventado]\n[NADIE:feliz]\nTexto`, catalog);
    const msgs = p.errors.map((e) => `${e.line}:${e.message}`).join("\n");
    expect(msgs).toContain("1:Reaccion desconocida");
    expect(msgs).toContain("4:Asset desconocido");
    expect(msgs).toContain("Etiqueta desconocida [NADIE:feliz]");
  });

  it("parrafo sin etiqueta continua con el ultimo personaje como nuevo bloque", () => {
    const p = parseScript(`[TETO:nerd]\nPrimera parte.\n\nSegunda parte.`, catalog);
    expect(p.beats).toHaveLength(2);
    expect(p.beats[1]).toMatchObject({ character: "teto", avatar: "nerd", dialogue: "Segunda parte." });
    expect(p.warnings).toHaveLength(1);
  });

  it("el guion del proyecto piloto demo_001 parsea sin errores", () => {
    const p = parseScript(fs.readFileSync(fromRepo("projects/demo_001/script.md"), "utf8"), catalog);
    expect(p.errors).toEqual([]);
    expect(p.beats.filter((b) => b.kind === "dialogue").length).toBeGreaterThanOrEqual(10);
  });
});

import { describe, expect, it } from "vitest";
import { buildCaptionPages, estimateSceneWords, layoutCaption, timelineWords } from "../src/timeline/captions";
import { buildRenderPlan } from "../src/timeline/plan";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, fixture, longTimeline } from "./helpers";

describe("subtitulos", async () => {
  const { cfg, catalog } = await engine();

  it("color de subtitulo por personaje = characters.json", () => {
    const plan = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    expect(plan.captions.length).toBeGreaterThan(0);
    for (const page of plan.captions) {
      expect(page.color).toBe(cfg.characters.characters[page.character]!.subtitleColor.toUpperCase());
    }
    expect(plan.captions.find((p) => p.character === "teto")?.color).toBe("#E58FB5");
    expect(plan.captions.find((p) => p.character === "miku")?.color).toBe("#39C5BB");
  });

  it("el timeline no puede cambiar colores (no hay campo de color de personaje en el schema)", () => {
    const t = clone(fixture<Record<string, any>>("smoke.timeline.json"));
    t.scenes[0].subtitleColor = "#000000";
    expect(validateTimeline(t as never, catalog, cfg.render, { stage: "final", durationPolicy: "ignore" }).ok).toBe(false);
  });

  it("estima palabras dentro de la escena, ordenadas y sin solaparse", () => {
    const words = estimateSceneWords({ id: "a", startMs: 1000, endMs: 4000, character: "teto", dialogue: "Hola a todos, esto es una prueba." });
    expect(words).toHaveLength(7);
    expect(words[0]!.startMs).toBe(1000);
    for (let i = 1; i < words.length; i++) expect(words[i]!.startMs).toBeGreaterThanOrEqual(words[i - 1]!.endMs - 1);
    expect(words[words.length - 1]!.endMs).toBeLessThanOrEqual(4000);
  });

  it("las paginas nunca mezclan personajes y respetan maxWordsPerPage", () => {
    const t = longTimeline();
    const pages = buildCaptionPages(timelineWords(t), t, cfg.render.captions);
    for (const p of pages) {
      expect(p.tokens.length).toBeLessThanOrEqual(cfg.render.captions.maxWordsPerPage);
      expect(new Set([p.character]).size).toBe(1);
    }
    for (let i = 1; i < pages.length; i++) expect(pages[i]!.startMs).toBeGreaterThanOrEqual(pages[i - 1]!.endMs);
  });

  it("layout: el texto cabe en maxLines y maxWidth", () => {
    const l = layoutCaption(["¿China", "destruyó", "a", "ChatGPT", "y", "Claude?"], cfg.render.captions);
    expect(l.lines.length).toBeLessThanOrEqual(cfg.render.captions.maxLines);
    expect(l.width).toBeLessThanOrEqual(cfg.render.captions.maxWidth);
  });

  it("palabras gigantes reducen la fuente y el validador lo reporta si baja de 70%", () => {
    const l = layoutCaption(["Supercalifragilisticoespialidosamente"], cfg.render.captions);
    expect(l.fontScale).toBeLessThan(0.7);
    const t = clone(longTimeline());
    t.scenes[0]!.dialogue = "Supercalifragilisticoespialidosamente";
    const res = validateTimeline(t, catalog, cfg.render, { stage: "draft" });
    expect(res.issues.some((i) => i.code === "CAPTION_WORD_TOO_LONG")).toBe(true);
  });

  it("subtitle_emphasis marca solo las palabras pedidas", () => {
    const plan = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    const tokens = plan.captions.flatMap((p) => p.tokens);
    expect(tokens.filter((t) => t.emphasis).map((t) => t.text)).toEqual(["destruyó"]);
  });

  it("la caja de subtitulos de la config esta dentro de la safe area", () => {
    const res = validateTimeline(longTimeline(), catalog, cfg.render, { stage: "draft" });
    expect(res.issues.filter((i) => i.check === "subtitles" && i.level === "error")).toEqual([]);
  });
});

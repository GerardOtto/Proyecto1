import { describe, expect, it } from "vitest";
import { buildRenderPlan } from "../src/timeline/plan";
import { layoutTitle, parseTitle } from "../src/timeline/titlecard";
import { hashJson } from "../src/utils/hash";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, fixture, longTimeline } from "./helpers";

describe("rotulo del gancho (ADR 0006)", async () => {
  const { cfg, catalog } = await engine();
  const codes = (tl: ReturnType<typeof longTimeline>, stage: "draft" | "final" = "draft", render = cfg.render) =>
    validateTimeline(tl, catalog, render, { stage, checkAudioFiles: false }).issues.map((i) => i.code);

  it("parsea *resaltado* (una o varias palabras) y quita los asteriscos", () => {
    expect(parseTitle("¿*DeepSeek* destruyo a *ChatGPT*?")).toEqual([
      { text: "¿DeepSeek", emphasis: true },
      { text: "destruyo", emphasis: false },
      { text: "a", emphasis: false },
      { text: "ChatGPT?", emphasis: true },
    ]);
    expect(parseTitle("*IA muy* barata").map((t) => t.emphasis)).toEqual([true, true, false]);
  });

  it("plan: from 0, to = fin del hook acotado a [minMs, maxMs], resaltado y caja centrada", () => {
    const tl = longTimeline(); // hook 0-4000 ms
    tl.meta.hookTitle = "¿*DeepSeek* destruyo a ChatGPT?";
    const p = buildRenderPlan(tl, catalog.resolved, cfg.render);
    const tc = p.titleCard!;
    expect(tc.from).toBe(0);
    expect(tc.to).toBe(120); // 4000 ms @30
    expect(tc.tokens.filter((t) => t.emphasis).map((t) => t.text)).toEqual(["¿DeepSeek"]);
    expect(Math.abs(tc.box.x + tc.box.width / 2 - p.style.captionCenterX)).toBeLessThanOrEqual(1);
    // hook muy corto -> minMs; muy largo -> maxMs
    tl.scenes[0]!.endMs = 500;
    expect(buildRenderPlan(tl, catalog.resolved, cfg.render).titleCard!.to).toBe(45); // 1500 ms
    tl.scenes[0]!.endMs = 9000;
    tl.scenes[1]!.startMs = 9000;
    expect(buildRenderPlan(tl, catalog.resolved, cfg.render).titleCard!.to).toBe(180); // 6000 ms
  });

  it("plan: los visuales del gancho bajan a un area libre bajo el rotulo (reserveVisualArea)", () => {
    const tl = longTimeline();
    tl.meta.hookTitle = "¿*DeepSeek* destruyo a ChatGPT?";
    tl.scenes[0]!.visuals = ["chatgpt_logo"];
    const p = buildRenderPlan(tl, catalog.resolved, cfg.render);
    const v = p.visuals.find((x) => x.id === "chatgpt_logo")!;
    const box = p.titleCard!.box;
    expect(v.area!.y).toBeGreaterThanOrEqual(box.y + box.height);
    expect(v.area!.y + v.area!.height).toBe(cfg.render.layout.visualArea.y + cfg.render.layout.visualArea.height);
    const render = clone(cfg.render);
    render.titleCard!.reserveVisualArea = false;
    expect(buildRenderPlan(tl, catalog.resolved, render).visuals.find((x) => x.id === "chatgpt_logo")!.area).toBeUndefined();
  });

  it("plan: sin hookTitle no hay rotulo, y el plan es determinista", () => {
    expect(buildRenderPlan(longTimeline(), catalog.resolved, cfg.render).titleCard).toBeNull();
    const a = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    const b = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    expect(a.titleCard).not.toBeNull();
    expect(hashJson(a)).toBe(hashJson(b));
  });

  it("layout: un titulo largo reduce la fuente; si no cabe ni al 50 %, overflow", () => {
    const ok = layoutTitle("¿*DeepSeek* destruyo a ChatGPT y Claude esta semana?", cfg.render)!;
    expect(ok.lines.length).toBeLessThanOrEqual(cfg.render.titleCard!.maxLines);
    const huge = layoutTitle(Array.from({ length: 30 }, () => "palabra").join(" "), cfg.render)!;
    expect(huge.overflow || huge.fontScale < 0.7).toBe(true);
  });

  it("validacion: HOOK_TITLE_MISSING (warning, solo en final)", () => {
    expect(codes(longTimeline(), "final")).toContain("HOOK_TITLE_MISSING");
    expect(codes(longTimeline(), "draft")).not.toContain("HOOK_TITLE_MISSING");
  });

  it("validacion: HOOK_TITLE_TOO_LONG (error)", () => {
    const tl = longTimeline();
    // <= 60 caracteres (pasa el schema) pero 3 palabras largas: para caber en 2 lineas la fuente
    // tendria que bajar a ~50 %, por debajo del minimo del 70 %.
    tl.meta.hookTitle = "abcdefghijklmnopqrs abcdefghijklmnopqrs abcdefghijklmnopqrs";
    expect(codes(tl)).toContain("HOOK_TITLE_TOO_LONG");
  });

  it("validacion: HOOK_TITLE_OUTSIDE_SAFE_AREA y HOOK_TITLE_OVERLAPS_CAPTIONS (errores)", () => {
    const tl = longTimeline();
    tl.meta.hookTitle = "¿*Hook* corto?";
    const render = clone(cfg.render);
    render.titleCard!.y = 100; // sobre la franja superior que tapa la UI
    expect(codes(tl, "draft", render)).toContain("HOOK_TITLE_OUTSIDE_SAFE_AREA");
    render.titleCard!.y = render.captions.centerY - 20; // encima de los subtitulos
    expect(codes(tl, "draft", render)).toContain("HOOK_TITLE_OVERLAPS_CAPTIONS");
    expect(codes(tl)).not.toContain("HOOK_TITLE_OUTSIDE_SAFE_AREA");
  });

  it("validacion: HOOK_KEYWORD_LATE si ninguna palabra clave se dice en los primeros 3 s", () => {
    const tl = longTimeline(); // el hook dice "¿Esto es un hook?"
    tl.meta.hookTitle = "¿*DeepSeek* destruyo a ChatGPT?";
    expect(codes(tl)).toContain("HOOK_KEYWORD_LATE");
    tl.meta.hookTitle = "¿Esto es un *hook*?";
    expect(codes(tl)).not.toContain("HOOK_KEYWORD_LATE");
  });
});

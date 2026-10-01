import { describe, expect, it } from "vitest";
import { parseScript } from "../src/director/script-parser";
import { autoPopFrames, buildRenderPlan } from "../src/timeline/plan";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

describe("efectos de sonido", async () => {
  const { cfg, catalog } = await engine();

  it("pop automatico: espaciado minimo, no pisa otros SFX y calla durante memes", () => {
    const frames = autoPopFrames([0, 10, 100, 200, 205, 400], [190], [{ from: 390, to: 450 }], 30);
    expect(frames).toEqual([0, 100]); // 10: muy cerca de 0; 200/205: SFX en 190; 400: meme
  });

  it("el plan agrega un pop al aparecer cada visual y respeta el volumen configurado", () => {
    const tl = longTimeline();
    tl.scenes.find((s) => s.id === "dev")!.visuals = ["chatgpt_logo"];
    const p = buildRenderPlan(tl, catalog.resolved, cfg.render);
    const pops = p.audio.sfx.filter((s) => s.src.endsWith("sfx_pop.wav"));
    expect(pops.length).toBeGreaterThan(0);
    expect(pops.every((s) => s.volume === cfg.render.events.visual.sfx!.volume)).toBe(true);
    const render = clone(cfg.render);
    delete render.events.visual.sfx;
    expect(buildRenderPlan(tl, catalog.resolved, render).audio.sfx.some((s) => s.src.endsWith("sfx_pop.wav"))).toBe(false);
  });

  it("{SFX:id:volumen} fija el volumen; volumen fuera de 0-1 es error", () => {
    const ok = parseScript("[TETO:feliz]\n{SFX:sfx_vine_boom:0.4}Hola papus.\n", catalog);
    expect(ok.errors).toEqual([]);
    expect(ok.beats[0]!.events).toContainEqual({ type: "sfx", sfx: "sfx_vine_boom", volume: 0.4, atWord: 0 });
    expect(parseScript("[TETO:feliz]\n{SFX:sfx_vine_boom:3}Hola.\n", catalog).errors.length).toBeGreaterThan(0);
  });

  it("usar un asset reservado (telefono de NERU) genera un aviso", () => {
    const tl = clone(longTimeline());
    tl.scenes[0]!.events = [{ type: "sfx", sfx: "sfx_neru_phone" }];
    const v = validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false });
    expect(v.issues.some((i) => i.code === "ASSET_RESERVED")).toBe(true);
  });
});

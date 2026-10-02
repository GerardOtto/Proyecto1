import { describe, expect, it } from "vitest";
import { parseScript } from "../src/director/script-parser";
import { buildRenderPlan, stickerBox, trimStickers, type PlanSticker } from "../src/timeline/plan";
import { validateTimeline } from "../src/validation/timeline";
import { validateSchema } from "../src/validation/schemas";
import { clone, engine, longTimeline } from "./helpers";

describe("stickers de reaccion (ADR 0010)", async () => {
  const { cfg, catalog } = await engine();
  const area = { x: 90, y: 260, width: 850, height: 640 };

  it("stickerBox: esquina inferior del area de visuales del lado dado", () => {
    expect(stickerBox("left", area, 300, 10)).toEqual({ x: 100, y: 590, width: 300, height: 300 });
    expect(stickerBox("right", area, 300, 10)).toEqual({ x: 630, y: 590, width: 300, height: 300 });
    expect(stickerBox("center", area, 300, 10).x).toBe(365);
  });

  it("trimStickers: uno nuevo en la misma esquina corta al anterior; en otra esquina conviven", () => {
    const s = (from: number, to: number, x: number): PlanSticker => ({
      from, to, src: "a.png", kind: "image", box: { x, y: 0, width: 10, height: 10 }, popInFrames: 5, popOutFrames: 4, tiltDeg: 0, seed: `${from}`,
    });
    const out = trimStickers([s(30, 70, 0), s(10, 50, 0), s(20, 60, 500)]);
    expect(out.map((x) => [x.from, x.to])).toEqual([[10, 30], [20, 60], [30, 70]]);
  });

  it("el plan coloca el sticker del lado del personaje y agrega su SFX", () => {
    const tl = clone(longTimeline());
    const dev = tl.scenes.find((s) => s.id === "dev")!;
    dev.events = [
      { type: "sticker", sticker: "meme_gato_sorprendido", sfx: "sfx_oohh", volume: 0.7, atMs: 1000 },
      { type: "sticker", sticker: "meme_gato_pulgar", character: "teto", atMs: 5000 },
    ];
    const p = buildRenderPlan(tl, catalog.resolved, cfg.render);
    const sideOf = (ch: string) => p.stage.find((seg) => seg.sceneId === "dev")!.actors.find((a) => a.character === ch)!.side;
    const st = cfg.render.events.sticker!;
    const [first, second] = p.stickers;
    expect(first!.box).toEqual(stickerBox(sideOf("miku"), cfg.render.layout.visualArea, st.size, st.inset));
    expect(second!.box).toEqual(stickerBox(sideOf("teto"), cfg.render.layout.visualArea, st.size, st.inset));
    expect(first!.from).toBe(180 + 30);
    expect(first!.to - first!.from).toBe(Math.round((st.durationMs / 1000) * 30));
    expect(p.audio.sfx).toContainEqual({ src: "assets/sfx/sfx_oohh.wav", from: 210, volume: 0.7 });
  });

  it("parser: {STICKER:id[:sfx][:volumen][:personaje]} en cualquier orden; errores claros", () => {
    const ok = parseScript("[MIKU:feliz]\n[LISTEN: luka:neutral]\nHola {STICKER:meme_gato_nerd:luka:sfx_oohh:0.6}papus.\n", catalog);
    expect(ok.errors).toEqual([]);
    expect(ok.beats[0]!.events).toContainEqual({ type: "sticker", sticker: "meme_gato_nerd", character: "luka", sfx: "sfx_oohh", volume: 0.6, atWord: 1 });
    expect(parseScript("[MIKU:feliz]\n{STICKER:no_existe}Hola.\n", catalog).errors.length).toBeGreaterThan(0);
    expect(parseScript("[MIKU:feliz]\n{STICKER:sfx_oohh}Hola.\n", catalog).errors.length).toBeGreaterThan(0); // un sfx no es sticker
    expect(parseScript("[MIKU:feliz]\n{STICKER:meme_gato_nerd:3}Hola.\n", catalog).errors.length).toBeGreaterThan(0);
  });

  it("schema y validacion: tipo valido, asset de tipo meme y personaje en pantalla", () => {
    const tl = clone(longTimeline());
    const dev = tl.scenes.find((s) => s.id === "dev")!;
    dev.listeners = [{ character: "teto", avatar: "neutral" }];
    dev.events = [{ type: "sticker", sticker: "meme_gato_pulgar", character: "luka" }];
    expect(validateSchema("timeline", tl)).toEqual([]);
    const v = validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false });
    expect(v.issues.some((i) => i.code === "STICKER_CHARACTER_OFFSCREEN")).toBe(true);
    dev.events = [{ type: "sticker", sticker: "sfx_oohh" }];
    const bad = validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false });
    expect(bad.issues.some((i) => i.code === "ASSET_WRONG_TYPE")).toBe(true);
  });
});

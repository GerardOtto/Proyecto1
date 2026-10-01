import { describe, expect, it } from "vitest";
import { buildRenderPlan, PlanError, withAvatarVariants } from "../src/timeline/plan";
import { hashJson } from "../src/utils/hash";
import { clone, engine, fixture, longTimeline } from "./helpers";

describe("compilador timeline -> RenderPlan", async () => {
  const { cfg, catalog } = await engine();

  it("es determinista: mismo timeline + catalogo -> mismo plan (hash)", () => {
    const a = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    const b = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    expect(hashJson(a)).toBe(hashJson(b));
  });

  it("duracion y formato 1080x1920 @30", () => {
    const p = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    expect(p).toMatchObject({ width: 1080, height: 1920, fps: 30, durationInFrames: 240 });
  });

  it("speaker con escala mayor que listener y lados estables", () => {
    const p = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    const reply = p.stage.find((s) => s.sceneId === "reply")!;
    const miku = reply.actors.find((a) => a.character === "miku")!;
    const teto = reply.actors.find((a) => a.character === "teto")!;
    expect(miku.role).toBe("speaker");
    expect(teto.role).toBe("listener");
    expect(miku.scale).toBeGreaterThan(teto.scale);
    const sides = new Map<string, string>();
    for (const seg of p.stage) for (const a of seg.actors) {
      if (sides.has(a.character)) expect(a.side).toBe(sides.get(a.character));
      sides.set(a.character, a.side);
    }
    expect(sides.get("teto")).not.toBe(sides.get("miku"));
  });

  it("character_reaction cambia el avatar en el frame indicado", () => {
    const p = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    const reply = p.stage.find((s) => s.sceneId === "reply")!;
    const teto = reply.actors.find((a) => a.character === "teto")!;
    expect(teto.avatars.map((a) => a.reaction)).toEqual(["neutral", "nerd"]);
    expect(teto.avatars[1]!.from).toBe(reply.from + 21);
  });

  it("escena meme mantiene a los personajes previos y genera flash + sfx + shake", () => {
    const p = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, cfg.render);
    const meme = p.stage.find((s) => s.sceneId === "meme")!;
    expect(meme.actors.map((a) => a.character)).toEqual(["teto"]);
    expect(p.memes).toHaveLength(1);
    expect(p.memes[0]!.src).toBe("assets/memes/meme_boom.gif");
    expect(p.audio.sfx[0]!.src).toBe("assets/sfx/sfx_boom.wav");
    expect(p.camera.some((c) => c.type === "shake")).toBe(true);
  });

  it("meme estilo corte: imagen, sacudida y SFX terminan en seco en el mismo frame", () => {
    const render = clone(cfg.render);
    render.events.memeExplosion.cutAtMs = 700; // 21 frames @30
    const p = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, render);
    const m = p.memes[0]!;
    expect(m.cut).toBe(true);
    expect(m.to - m.from).toBe(21);
    expect(p.audio.sfx[0]!.durationFrames).toBe(21);
    const shake = p.camera.find((c) => c.type === "shake" && c.from === m.from)!;
    expect(shake.to).toBeLessThanOrEqual(m.to);
  });

  it("meme sin cutAtMs (config actual): dura durationMs completo, se desvanece y el SFX suena entero", () => {
    const render = clone(cfg.render);
    delete render.events.memeExplosion.cutAtMs;
    render.events.memeExplosion.durationMs = 1700;
    const p = buildRenderPlan(fixture("smoke.timeline.json"), catalog.resolved, render);
    expect(p.memes[0]!.cut).toBe(false);
    expect(p.memes[0]!.to - p.memes[0]!.from).toBe(51); // 1700 ms
    expect(p.audio.sfx[0]!.durationFrames).toBeUndefined();
  });

  it("variantes: el que habla alterna imagenes de la misma reaccion cada intervalo; el que escucha no", () => {
    const changes = [{ from: 0, src: "a.png", reaction: "nerd" }];
    const variants = { nerd: ["a.png", "b.png", "c.png"] };
    const out = withAvatarVariants(changes, 100, variants, 30);
    expect(out.map((x) => [x.from, x.src])).toEqual([
      [0, "a.png"],
      [30, "b.png"],
      [60, "c.png"],
    ]); // a 90 no cabe un intervalo completo antes de 100
    expect(out.slice(1).every((x) => x.variant && x.reaction === "nerd")).toBe(true);
  });

  it("variantes: respetan los cambios semanticos y no tocan reacciones sin variantes", () => {
    const changes = [
      { from: 0, src: "a.png", reaction: "nerd" },
      { from: 50, src: "f.png", reaction: "feliz" },
    ];
    // intervalo 30: una variante en 30 solo duraria 20 frames antes del cambio a feliz -> no se agrega
    expect(withAvatarVariants(changes, 200, { nerd: ["a.png", "b.png"] }, 30).map((x) => x.from)).toEqual([0, 50]);
    // intervalo 20: variante en 20 (dura 20); en 40 ya no cabe; feliz no tiene variantes
    const out = withAvatarVariants(changes, 200, { nerd: ["a.png", "b.png"] }, 20);
    expect(out.map((x) => x.from)).toEqual([0, 20, 50]);
    expect(withAvatarVariants(changes, 200, { nerd: ["a.png", "b.png"] }, 0)).toEqual(changes);
  });

  it("variantes en el plan: solo para el speaker", () => {
    const render = clone(cfg.render);
    render.timing.avatarVariantIntervalMs = 1000;
    const cat = clone(catalog.resolved);
    const m = cat.characters.miku!;
    m.variants = { nerd: [m.avatars.nerd!, m.avatars.feliz!], neutral: [m.avatars.neutral!, m.avatars.feliz!] };
    const p = buildRenderPlan(longTimeline(), cat, render);
    const dev = p.stage.find((s) => s.sceneId === "dev")!; // miku habla 54 s en "nerd"
    const speaker = dev.actors.find((a) => a.character === "miku")!;
    expect(speaker.role).toBe("speaker");
    expect(speaker.avatars.length).toBeGreaterThan(40); // ~1 cambio por segundo
    expect(speaker.avatars[1]).toMatchObject({ from: speaker.avatars[0]!.from + 30, src: m.avatars.feliz, variant: true });
    const close = p.stage.find((s) => s.sceneId === "close")!; // teto habla; miku escucha en "neutral"
    const listener = close.actors.find((a) => a.character === "miku")!;
    expect(listener.role).toBe("listener");
    expect(listener.avatars).toHaveLength(1);
  });

  it("visuales de escenas contiguas se fusionan (no re-animan)", () => {
    const t = clone(longTimeline());
    t.scenes[2]!.visuals = ["chart_benchmarks"];
    t.scenes[3]!.visuals = ["chart_benchmarks"];
    const p = buildRenderPlan(t, catalog.resolved, cfg.render);
    expect(p.visuals.filter((v) => v.id === "chart_benchmarks")).toHaveLength(1);
  });

  it("atWord se resuelve a atMs usando las palabras", () => {
    const t = clone(longTimeline());
    t.scenes[2]!.events = [{ type: "visual_show", visual: "chart_benchmarks", atWord: 3 }];
    const p = buildRenderPlan(t, catalog.resolved, cfg.render);
    const v = p.visuals.find((x) => x.id === "chart_benchmarks")!;
    expect(v.from).toBeGreaterThan(Math.round((6000 * 30) / 1000));
  });

  it("listener automatico = ultimo speaker distinto", () => {
    const p = buildRenderPlan(longTimeline(), catalog.resolved, cfg.render);
    const dev = p.stage.find((s) => s.sceneId === "dev")!;
    expect(dev.actors.map((a) => `${a.character}:${a.role}`).sort()).toEqual(["miku:speaker", "teto:listener"]);
  });

  it("falla con PlanError ante reacciones de personajes fuera de pantalla", () => {
    const t = clone(longTimeline());
    t.scenes[0]!.events = [{ type: "character_reaction", character: "len", avatar: "shocked" }];
    expect(() => buildRenderPlan(t, catalog.resolved, cfg.render)).toThrow(PlanError);
  });
});

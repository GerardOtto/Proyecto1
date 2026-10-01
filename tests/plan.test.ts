import { describe, expect, it } from "vitest";
import { buildRenderPlan, PlanError } from "../src/timeline/plan";
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
    expect(p.memes[0]!.src).toBe("assets/memes/meme_boom.png");
    expect(p.audio.sfx[0]!.src).toBe("assets/sfx/sfx_boom.wav");
    expect(p.camera.some((c) => c.type === "shake")).toBe(true);
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

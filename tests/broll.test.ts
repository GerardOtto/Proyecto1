import { describe, expect, it } from "vitest";
import { resolveBrollIds, type Catalog, type ProjectContext } from "../src/catalog/catalog";
import { brollGaps, buildRenderPlan, fillBroll } from "../src/timeline/plan";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

describe("b-roll: huecos y relleno (puro)", () => {
  it("encuentra los huecos sin visuales ni memes, ignorando los demasiado cortos", () => {
    const busy = [
      { from: 0, to: 90 },
      { from: 80, to: 120 }, // solapado
      { from: 140, to: 200 }, // hueco 120-140 (20 frames) < min
      { from: 300, to: 330 },
    ];
    expect(brollGaps(busy, 400, 30)).toEqual([
      { from: 200, to: 300 },
      { from: 330, to: 400 },
    ]);
    expect(brollGaps([], 100, 30)).toEqual([{ from: 0, to: 100 }]);
  });

  it("rellena por tramos rotando clips; un resto corto se suma al tramo anterior", () => {
    const clips = [
      { src: "a.mp4", kind: "video" as const, frames: 300 },
      { src: "b.mp4", kind: "video" as const, frames: 300 },
    ];
    const out = fillBroll([{ from: 0, to: 230 }], clips, 100, 40);
    expect(out.map((b) => [b.from, b.to, b.src])).toEqual([
      [0, 100, "a.mp4"],
      [100, 230, "b.mp4"], // 200-230 (30) < 40 -> se une al tramo anterior
    ]);
  });

  it("cada reutilizacion del mismo clip empieza en otro punto; clips cortos van en loop", () => {
    const out = fillBroll([{ from: 0, to: 300 }], [{ src: "a.mp4", kind: "video", frames: 250 }], 100, 30);
    expect(out.map((b) => b.startFrom)).toEqual([0, 100, 49]); // (2*100) % (250-100+1)
    const short = fillBroll([{ from: 0, to: 100 }], [{ src: "s.mp4", kind: "video", frames: 60 }], 100, 30);
    expect(short[0]).toMatchObject({ startFrom: 0, loopFrames: 60 });
  });

  it("sin clips no hay b-roll", () => {
    expect(fillBroll([{ from: 0, to: 100 }], [], 50, 10)).toEqual([]);
  });
});

describe("b-roll en el plan y el catalogo", async () => {
  const { cfg, catalog } = await engine();
  const ids = Object.values(catalog.entries)
    .filter((e) => e.type === "broll")
    .map((e) => e.id)
    .sort();

  it("el plan rellena todo lo que no cubren visuales ni memes", () => {
    const tl = longTimeline();
    tl.meta.broll = ids.slice(0, 2);
    const p = buildRenderPlan(tl, catalog.resolved, cfg.render);
    expect(p.broll.length).toBeGreaterThan(5);
    const busy = [...p.visuals, ...p.memes];
    for (const b of p.broll) {
      expect(busy.some((v) => b.from < v.to && v.from < b.to)).toBe(false); // nunca encima de un visual/meme
    }
    expect(new Set(p.broll.map((b) => b.src)).size).toBe(2);
  });

  it("sin meta.broll no hay relleno", () => {
    const p = buildRenderPlan(longTimeline(), catalog.resolved, cfg.render);
    expect(p.broll).toEqual([]);
  });

  it("resolveBrollIds: front matter > project.json > todos; 'none' desactiva; valida IDs y tipo", () => {
    const project = (broll?: string[] | "none") => ({ config: broll ? { broll } : {} }) as ProjectContext;
    expect(resolveBrollIds(undefined, project(), catalog)).toEqual(ids);
    expect(resolveBrollIds(`${ids[1]}, ${ids[0]}`, project(), catalog)).toEqual([ids[1], ids[0]]);
    expect(resolveBrollIds(undefined, project([ids[0]!]), catalog)).toEqual([ids[0]]);
    expect(resolveBrollIds("none", project([ids[0]!]), catalog)).toEqual([]);
    expect(() => resolveBrollIds("nope", project(), catalog as Catalog)).toThrow(/no existe/);
    expect(() => resolveBrollIds("bg_tech_loop", project(), catalog)).toThrow(/no broll/);
  });

  it("la validacion rechaza un broll que no es de tipo broll", () => {
    const tl = clone(longTimeline());
    tl.meta.broll = ["chatgpt_logo"];
    const v = validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false });
    expect(v.issues.some((i) => i.code === "ASSET_WRONG_TYPE")).toBe(true);
  });
});

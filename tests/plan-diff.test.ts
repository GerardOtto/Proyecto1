// ADR 0015: render parcial. Que fotogramas hay que volver a renderizar entre dos versiones del plan.
import { describe, expect, it } from "vitest";
import type { RenderPlan } from "../src/timeline/plan";
import { alignToKeyframes, diffPlans, mergeRanges, spliceSegments } from "../src/timeline/plan-diff";

const base = (): RenderPlan =>
  ({
    version: 1,
    title: "t",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
    background: { kind: "palette", segments: [{ from: 0, to: 900, colors: ["#000"] }] },
    audio: { master: "a.wav", clips: [], sfx: [{ src: "boom.mp3", from: 10, volume: 1 }] },
    stage: [
      { sceneId: "s01", from: 0, to: 300, actors: [] },
      { sceneId: "s02", from: 300, to: 600, actors: [] },
      { sceneId: "s03", from: 600, to: 900, actors: [] },
    ],
    visuals: [{ id: "logo", src: "logo.png", from: 0, to: 120, slot: "top" }],
    captions: [],
    camera: [],
    memes: [],
    stickers: [{ from: 400, to: 440, src: "gato.gif", kind: "gif", box: { x: 0, y: 0, w: 1, h: 1 }, popInFrames: 5, popOutFrames: 5, tiltDeg: 0, seed: "x" }],
    broll: [],
    watermark: null,
    titleCard: null,
    colors: {},
    names: {},
  }) as unknown as RenderPlan;

const hashes = { prev: { "logo.png": "h1", "gato.gif": "g1", "gato2.gif": "g2" }, next: { "logo.png": "h1", "gato.gif": "g1", "gato2.gif": "g2" } };

describe("render parcial: diff de planes (ADR 0015)", () => {
  it("sin cambios no hay nada que renderizar (y el audio no cuenta)", () => {
    const next = base();
    next.audio.sfx = [{ src: "otro.mp3", from: 50, volume: 0.5 }] as RenderPlan["audio"]["sfx"];
    expect(diffPlans(base(), next, hashes)).toMatchObject({ eligible: true, ranges: [], dirtyFrames: 0 });
  });

  it("cambiar un sticker ensucia solo su tramo (con margen)", () => {
    const next = base();
    next.stickers = [{ ...next.stickers[0]!, src: "gato2.gif" }];
    const d = diffPlans(base(), next, hashes, 15);
    expect(d.eligible).toBe(true);
    expect(d.ranges).toEqual([[385, 454]]);
  });

  it("un archivo con la misma ruta pero otro contenido cuenta como cambio", () => {
    const d = diffPlans(base(), base(), { prev: hashes.prev, next: { ...hashes.next, "logo.png": "h2" } }, 0);
    expect(d.ranges).toEqual([[0, 119]]);
  });

  it("cambio de duracion o de algo global -> render completo", () => {
    const longer = { ...base(), durationInFrames: 930 };
    expect(diffPlans(base(), longer, hashes)).toMatchObject({ eligible: false });
    const bg = base();
    (bg.background as unknown as { segments: unknown[] }).segments = [{ from: 0, to: 900, colors: ["#fff"] }];
    expect(diffPlans(base(), bg, hashes).reason).toMatch(/global/);
    const small = { ...base(), width: 540, height: 960 };
    expect(diffPlans(base(), small, hashes).reason).toMatch(/dimensiones/);
  });

  it("une rangos solapados o contiguos", () => {
    expect(mergeRanges([[10, 20], [21, 30], [50, 60], [55, 70]])).toEqual([[10, 30], [50, 70]]);
  });

  it("alinea a fotogramas clave: el inicio baja al clave anterior y el final llega hasta antes del siguiente", () => {
    const keys = [0, 30, 60, 90, 120];
    expect(alignToKeyframes([[35, 70]], keys, 150)).toEqual([[30, 89]]);
    expect(alignToKeyframes([[125, 140]], keys, 150)).toEqual([[120, 149]]);
    expect(alignToKeyframes([[5, 10], [40, 45]], keys, 150)).toEqual([[0, 59]]);
  });

  it("particiona el video completo en tramos nuevos y reutilizados, sin huecos", () => {
    const segs = spliceSegments([[30, 89]], 150);
    expect(segs).toEqual([
      { kind: "reuse", range: [0, 29] },
      { kind: "render", range: [30, 89] },
      { kind: "reuse", range: [90, 149] },
    ]);
    expect(spliceSegments([], 10)).toEqual([{ kind: "reuse", range: [0, 9] }]);
    expect(spliceSegments([[0, 9]], 10)).toEqual([{ kind: "render", range: [0, 9] }]);
  });
});

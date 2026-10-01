import { describe, expect, it } from "vitest";
import { masterFilterGraph } from "../src/audio/ffmpeg";
import { resolveMusicId, type Catalog, type ProjectContext } from "../src/catalog/catalog";
import { DEFAULT_MUSIC_MIX } from "../src/pipeline/build-timeline";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

const base = { pieces: [{ file: "a.wav", offsetMs: 250 }, { file: "b.wav", offsetMs: 4000 }], totalMs: 70000, sampleRate: 48000, loudnessLufs: -14, truePeakDb: -1.5 };

describe("pista maestra con musica", () => {
  it("sin musica: solo voces -> loudnorm", () => {
    const g = masterFilterGraph(base);
    expect(g).toContain("amix=inputs=3");
    expect(g).toContain("[mix]loudnorm=I=-14");
    expect(g).not.toContain("sidechaincompress");
  });

  it("con musica: recorte, ganancia, fades y ducking con la voz como sidechain", () => {
    const g = masterFilterGraph({ ...base, music: { file: "m.mp3", gainDb: -11.13, startMs: 500, mix: DEFAULT_MUSIC_MIX } });
    expect(g).toContain("[3:a]"); // la musica es la entrada siguiente a los bloques de voz
    expect(g).toContain("atrim=start=0.500:duration=70.000");
    expect(g).toContain("volume=-11.13dB");
    expect(g).toContain("afade=t=out:st=67.500:d=2.500");
    expect(g).toContain("[voices]asplit=2[vmain][vkey]");
    expect(g).toContain("[music][vkey]sidechaincompress=threshold=0.02:ratio=6");
    expect(g).toContain("[vmain][ducked]amix=inputs=2");
    expect(g.indexOf("sidechaincompress")).toBeLessThan(g.indexOf("loudnorm"));
  });

  it("video mas corto que el fade: el fade no empieza antes de 0", () => {
    const g = masterFilterGraph({ ...base, totalMs: 1000, music: { file: "m.mp3", gainDb: 0, startMs: 0, mix: DEFAULT_MUSIC_MIX } });
    expect(g).toContain("afade=t=out:st=0.000:d=1.000");
  });
});

describe("resolveMusicId", () => {
  const catalog = {
    entries: {
      tema: { id: "tema", type: "music" },
      bg: { id: "bg", type: "background_video" },
    },
  } as unknown as Catalog;
  const project = (music?: string) => ({ config: music ? { music } : {} }) as ProjectContext;

  it("front matter > project.json > ninguna", () => {
    expect(resolveMusicId("tema", project("otro"), catalog)).toBe("tema");
    expect(resolveMusicId(undefined, project("tema"), catalog)).toBe("tema");
    expect(resolveMusicId(undefined, project(), catalog)).toBeUndefined();
  });

  it('"none" desactiva la musica', () => {
    expect(resolveMusicId("none", project("tema"), catalog)).toBeUndefined();
  });

  it("falla con ids inexistentes o de otro tipo", () => {
    expect(() => resolveMusicId("nope", project(), catalog)).toThrow(/no existe/);
    expect(() => resolveMusicId("bg", project(), catalog)).toThrow(/no music/);
  });
});

describe("validacion de meta.music", () => {
  it("rechaza un asset que no es music", async () => {
    const { cfg, catalog } = await engine();
    const tl = clone(longTimeline());
    tl.meta.music = "bg_tech_loop";
    const v = validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false });
    expect(v.issues.some((i) => i.code === "ASSET_WRONG_TYPE")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadProject } from "../src/catalog/catalog";
import { beatsToDraftTimeline } from "../src/director/beats";
import { buildFinalTimeline, DurationError, type AudioIndex, type WordsFile } from "../src/pipeline/build-timeline";
import { distributeWords } from "../src/transcribe/estimate";
import { fromRepo } from "../src/utils/paths";
import { validateTimeline } from "../src/validation/timeline";
import { engine } from "./helpers";

describe("reajuste con audio real (build-timeline)", async () => {
  const { cfg, catalog } = await engine();
  const dir = fs.mkdtempSync(path.join(fromRepo(".cache"), "bt-"));
  const project = loadProject(dir);
  const long = Array.from({ length: 40 }, (_, i) => `palabra${i}`).join(" ");
  const draft = beatsToDraftTimeline(
    [
      { kind: "dialogue", section: "hook", character: "teto", avatar: "sorprendido", dialogue: "¿Hola, esto funciona?", events: [] },
      { kind: "meme", section: "reaction", events: [{ type: "meme_explosion" }] },
      { kind: "dialogue", section: "development", character: "miku", avatar: "nerd", dialogue: long, events: [{ type: "visual_show", visual: "chart_benchmarks", atWord: 20 }, { type: "pause", atWord: 10, durationMs: 500 }] },
      { kind: "dialogue", section: "closing", character: "teto", avatar: "feliz", dialogue: "Fin del video.", events: [] },
    ],
    { title: "t", durationTargetSec: 70, language: "es", background: "bg_tech_loop", generator: "test" },
    cfg,
  );
  const ids = draft.scenes.map((s) => s.id);
  const mk = (blockDurations: number[]): { index: AudioIndex; words: WordsFile } => {
    const dialog = draft.scenes.filter((s) => s.dialogue);
    const index: AudioIndex = {
      provider: "test",
      sampleRate: 48000,
      blocks: dialog.map((s, i) => ({ blockId: s.id, sceneId: s.id, character: s.character!, text: s.dialogue!, file: `fake/${s.id}.wav`, durationMs: blockDurations[i]!, cacheKey: "k" })),
    };
    const words: WordsFile = { transcriber: "test", blocks: {} };
    for (const b of index.blocks) words.blocks[b.blockId] = { words: distributeWords(b.text, 100, b.durationMs - 100), matched: 0, total: 0, recognized: 0 };
    return { index, words };
  };

  it("usa la duracion real del audio y deja escenas contiguas", async () => {
    const { index, words } = mk([3000, 55_000, 4000]);
    const { timeline, duration } = await buildFinalTimeline({ draft, index, words, project, cfg, writeAudio: false });
    expect(timeline.meta.timingSource).toBe("audio");
    expect(timeline.scenes[0]!.startMs).toBe(0);
    for (let i = 1; i < timeline.scenes.length; i++) expect(timeline.scenes[i]!.startMs).toBe(timeline.scenes[i - 1]!.endMs);
    expect(timeline.meta.audio!.durationMs).toBe(duration.totalMs);
    expect(timeline.scenes.at(-1)!.endMs).toBe(duration.totalMs);
    // la pausa interna (500 ms) alarga la escena de miku
    const dev = timeline.scenes.find((s) => s.id === ids[2])!;
    expect(dev.endMs - dev.startMs).toBeGreaterThanOrEqual(55_500);
  });

  it("captions absolutos, ordenados y dentro de su escena; atWord resuelto a atMs", async () => {
    const { index, words } = mk([3000, 55_000, 4000]);
    const { timeline } = await buildFinalTimeline({ draft, index, words, project, cfg, writeAudio: false });
    const caps = timeline.captions!;
    for (let i = 1; i < caps.length; i++) expect(caps[i]!.startMs).toBeGreaterThanOrEqual(caps[i - 1]!.startMs);
    for (const c of caps) {
      const s = timeline.scenes.find((x) => x.id === c.sceneId)!;
      expect(c.startMs).toBeGreaterThanOrEqual(s.startMs);
      expect(c.endMs).toBeLessThanOrEqual(s.endMs);
    }
    const ev = timeline.scenes.find((s) => s.id === ids[2])!.events!.find((e) => typeof e !== "string" && e.type === "visual_show") as { atMs?: number; atWord?: number };
    expect(ev.atWord).toBeUndefined();
    expect(ev.atMs).toBeGreaterThan(0);
    const v = validateTimeline({ ...timeline, meta: { ...timeline.meta, audio: undefined } }, catalog, cfg.render, { stage: "final", checkAudioFiles: false });
    expect(v.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("lanza DurationError con la accion requerida si el audio es demasiado corto", async () => {
    const { index, words } = mk([2000, 8000, 2000]);
    await expect(buildFinalTimeline({ draft, index, words, project, cfg, writeAudio: false })).rejects.toBeInstanceOf(DurationError);
    try {
      await buildFinalTimeline({ draft, index, words, project, cfg, writeAudio: false });
    } catch (err) {
      expect((err as DurationError).plan.action).toBe("extend_scene_or_add_explanation");
    }
  });
});

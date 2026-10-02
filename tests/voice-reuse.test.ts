// ADR 0013: pronunciacion, cortes de pausa al silencio real, beat de personaje mudo y reutilizacion
// de audio por contenido (no se vuelve a pagar al proveedor por una linea que no cambio).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { capInternalSilences, FFMPEG, parseSilenceDetect, probeDurationMs, snapToSilence } from "../src/audio/ffmpeg";
import { run } from "../src/utils/exec";
import { loadProject } from "../src/catalog/catalog";
import { beatsToDraftTimeline, type Beat } from "../src/director/beats";
import { MUTE_BEAT_MS, parseScript } from "../src/director/script-parser";
import { stepVoices } from "../src/pipeline/steps";
import { applyPronunciations } from "../src/tts/pronounce";
import { readJson, writeJson } from "../src/utils/fs";
import { fromRepo } from "../src/utils/paths";
import { clone, engine } from "./helpers";

describe("orquestacion: pronunciacion, pausas, beat mudo y reutilizacion de audio (ADR 0013)", async () => {
  const { cfg, catalog } = await engine();

  it("la pronunciacion cambia solo terminos completos, sin distinguir mayusculas, el mas largo primero", () => {
    const rules = [
      { term: "Log4j", say: "Log four jay" },
      { term: "Log4Shell", say: "Log four shell" },
    ];
    expect(applyPronunciations("Log4Shell rompió log4j.", rules)).toBe("Log four shell rompió Log four jay.");
    expect(applyPronunciations("Log4jx y xLog4j quedan igual", rules)).toBe("Log4jx y xLog4j quedan igual");
    expect(cfg.pronunciations?.map((r) => r.term)).toContain("Log4Shell");
  });

  it("parsea silencedetect y lleva el corte al silencio mas cercano (o deja la estimacion)", () => {
    const stderr = "[silencedetect @ 0x1] silence_start: 0.51\n[silencedetect @ 0x1] silence_end: 0.63 | silence_duration: 0.12\nsilence_start: 1.9\nsilence_end: 2.05";
    const s = parseSilenceDetect(stderr);
    expect(s).toEqual([
      { startMs: 510, endMs: 630 },
      { startMs: 1900, endMs: 2050 },
    ]);
    expect(snapToSilence(700, s)).toBe(570);
    expect(snapToSilence(1700, s)).toBe(1975);
    expect(snapToSilence(1200, s, 300)).toBe(1200);
  });

  it("un bloque de personaje mudo sin texto es su propio beat; uno con voz sin texto sigue siendo error", () => {
    const src = ["[TETO:feliz]", "Hola.", "", "[NERU:feliz]", "[LISTEN: teto:riendo]", "[SFX:sfx_neru_phone]", "", "[NERU:nerd]", "[PAUSE:800]", "", "[MIKU:feliz]", ""].join("\n");
    const p = parseScript(src, catalog);
    const neru = p.beats.filter((b) => b.character === "neru");
    expect(neru).toHaveLength(2);
    expect(neru[0]).toMatchObject({ kind: "pause", durationMs: MUTE_BEAT_MS, listeners: [{ character: "teto", avatar: "riendo" }] });
    expect(neru[0]!.events).toEqual([{ type: "sfx", sfx: "sfx_neru_phone", atMs: 0 }]);
    expect(neru[1]).toMatchObject({ kind: "pause", durationMs: 800, events: [] });
    expect(p.errors.map((e) => e.message)).toEqual(["Bloque de miku sin dialogo"]);
  });

  it("acorta las pausas largas DENTRO de una linea (idempotente) y respeta inicio y final", async () => {
    const dir = fs.mkdtempSync(path.join(fromRepo(".cache"), "cap-"));
    const f = path.join(dir, "v.wav");
    // tono 0.5 s + silencio 1.6 s + tono 0.5 s (como el "¿En Minecraft? ... Ahora si es personal" de Len)
    await run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=0.5", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-f", "lavfi", "-i", "sine=f=440:d=0.5",
      "-filter_complex", "[0]aresample=48000,aformat=channel_layouts=mono[a];[1]atrim=0:1.6[s];[2]aresample=48000,aformat=channel_layouts=mono[b];[a][s][b]concat=n=3:v=0:a=1", "-c:a", "pcm_s16le", f]);
    const before = await probeDurationMs(f);
    const cut = await capInternalSilences(f, 600, 250);
    const after = await probeDurationMs(f);
    expect(cut).toBeGreaterThan(1200);
    expect(before - after).toBeGreaterThan(1200);
    expect(after).toBeGreaterThan(1100);
    expect(await capInternalSilences(f, 600, 250)).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("[TEMPO:x] acelera solo esa linea", () => {
    const p = parseScript(["[LUKA:nerd]", "[TEMPO:1.5]", "Cada paso tira a la basura la mitad.", "", "[LUKA:feliz]", "Otra linea.", "", "[MIKU:feliz]", "[TEMPO:3]", "Demasiado."].join("\n"), catalog);
    expect(p.beats[0]!.voiceTempo).toBe(1.5);
    expect(p.beats[1]!.voiceTempo).toBeUndefined();
    expect(p.errors.map((e) => e.message)).toEqual(["TEMPO espera un factor entre 0.7 y 1.8 (p. ej. [TEMPO:1.5])"]);
    const draft = beatsToDraftTimeline(p.beats.slice(0, 2), { title: "t", durationTargetSec: 70, language: "es", generator: "test" }, cfg);
    expect(draft.scenes[0]!.voiceTempo).toBe(1.5);
  });

  it("reutiliza el audio por contenido al reordenar escenas y reajusta el ritmo sin volver a sintetizar", async () => {
    const dir = fs.mkdtempSync(path.join(fromRepo(".cache"), "vr-"));
    const project = loadProject(dir);
    const ctx = { cfg, project, catalog };
    const meta = { title: "t", durationTargetSec: 70, language: "es", generator: "test" };
    const a: Beat = { kind: "dialogue", section: "hook", character: "teto", avatar: "feliz", dialogue: "Primera linea del guion.", events: [] };
    const b: Beat = { kind: "dialogue", section: "closing", character: "miku", avatar: "feliz", dialogue: "Ultima linea del guion.", events: [] };
    const nuevo: Beat = { kind: "dialogue", section: "development", character: "miku", avatar: "nerd", dialogue: "Una linea nueva en medio.", events: [] };
    writeJson(project.paths.draft, beatsToDraftTimeline([a, b], meta, cfg));
    const first = await stepVoices(ctx, { tts: "silent" });
    expect(first.blocks.map((x) => x.sceneId)).toEqual(["s01-hook", "s02-closing"]);
    const closingAudio = fs.readFileSync(fromRepo(first.blocks[1]!.file));

    // Se inserta una escena: "Ultima linea" pasa de s02 a s03 y conserva su audio (s02 es nuevo).
    writeJson(project.paths.draft, beatsToDraftTimeline([a, nuevo, b], meta, cfg));
    const second = await stepVoices(ctx, { tts: "silent" });
    const report = readJson<{ steps: { voices: { generated: number; reused: number } } }>(project.paths.report);
    expect(report.steps.voices).toMatchObject({ generated: 1, reused: 2 });
    expect(second.blocks.map((x) => x.sceneId)).toEqual(["s01-hook", "s02-development", "s03-closing"]);
    expect(fs.readFileSync(fromRepo(second.blocks[2]!.file)).equals(closingAudio)).toBe(true);

    // Ritmo propio de miku: mismo audio acelerado en local; teto queda igual.
    const fast = clone(cfg);
    fast.characters.characters.miku!.voice = { ...fast.characters.characters.miku!.voice, tempo: 1.25 };
    const third = await stepVoices({ ...ctx, cfg: fast }, { tts: "silent" });
    const r3 = readJson<{ steps: { voices: { generated: number; reused: number } } }>(project.paths.report);
    expect(r3.steps.voices).toMatchObject({ generated: 0, reused: 3 });
    expect(third.blocks[0]!.durationMs).toBe(second.blocks[0]!.durationMs);
    expect(third.blocks[2]!.durationMs).toBeLessThan(second.blocks[2]!.durationMs * 0.85);

    // [TEMPO:1.5] en una sola linea: se reacelera en local, el resto queda igual.
    writeJson(project.paths.draft, beatsToDraftTimeline([a, { ...nuevo, voiceTempo: 1.5 }, b], meta, cfg));
    const fourth = await stepVoices(ctx, { tts: "silent" });
    const r4 = readJson<{ steps: { voices: { generated: number; reused: number } } }>(project.paths.report);
    expect(r4.steps.voices).toMatchObject({ generated: 0, reused: 3 });
    expect(fourth.blocks[1]!.durationMs).toBeLessThan(second.blocks[1]!.durationMs * 0.75);
    expect(fourth.blocks[0]!.durationMs).toBe(second.blocks[0]!.durationMs);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

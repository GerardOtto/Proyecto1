// Prototipos (ADR 0013): voz de borrador en espanol (espeak-ng) y render de baja resolucion.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FFMPEG, probeDurationMs } from "../src/audio/ffmpeg";
import { scaledSize } from "../src/pipeline/render";
import { buildQaTable } from "../src/pipeline/report";
import { greetingAudioApplies } from "../src/pipeline/steps";
import { resolveVoice } from "../src/tts";
import { EspeakProvider, espeakArgs, espeakText, fallbackVoice } from "../src/tts/espeak";
import { FliteProvider } from "../src/tts/flite";
import { SilentProvider } from "../src/tts/silent";
import type { ProjectContext } from "../src/catalog/catalog";
import { run } from "../src/utils/exec";
import { validateOutput } from "../src/validation/output";
import { engine } from "./helpers";

const espeakAvailable = spawnSync(process.env.ESPEAK_NG_PATH || "espeak-ng", ["--version"]).status === 0;

describe("voz de borrador espeak", () => {
  it("quita las marcas que espeak leeria en voz alta", () => {
    expect(espeakText('¡En *GitHub* hay #13.000 "capturas" {SFX} [x]!')).toBe("¡En GitHub hay 13.000 capturas SFX x !");
  });

  it("argumentos: voz, tono y velocidad acotados; texto por archivo", () => {
    expect(espeakArgs({ voice: "mb-es3", pitch: 140, speed: 20 }, "in.txt", "out.wav")).toEqual(["-v", "mb-es3", "-p", "99", "-s", "80", "-w", "out.wav", "-f", "in.txt"]);
  });

  it("respaldo sin MBROLA: formante latinoamericano del mismo genero, mas rapido", () => {
    expect(fallbackVoice({ voice: "mb-es3", pitch: 62, speed: 138 })).toEqual({ voice: "es-419+f3", pitch: 62, speed: 173 });
    expect(fallbackVoice({ voice: "mb-mx2", pitch: 40, speed: 134 })?.voice).toBe("es-419+m3");
    expect(fallbackVoice({ voice: "es-419+f3", pitch: 50, speed: 170 })).toBeNull();
  });

  it("cada personaje con voz tiene su voz de prototipo; la cache depende de voz, tono y velocidad", async () => {
    const { cfg } = await engine();
    const project = { voices: {} } as ProjectContext;
    const p = new EspeakProvider();
    const tags = new Set<string>();
    for (const id of ["teto", "miku", "luka", "rin", "len", "kaito"]) {
      const voice = resolveVoice(id, cfg.characters.characters[id], project);
      expect(voice.espeak, id).toBeDefined();
      tags.add(p.cacheTag({ blockId: "b", character: id, text: "hola", language: "es", voice, outBase: "x" }));
    }
    expect(tags.size).toBe(6);
  });

  it("saludo: las voces finales exigen el audio grabado; las de borrador dicen la linea completa", () => {
    const split = { rest: "¿China destruyó a ChatGPT?" };
    expect(greetingAudioApplies(split, true, false)).toBe(true);
    expect(greetingAudioApplies(split, false, false)).toBe(true); // fish/files: sigue exigiendo el saludo
    expect(greetingAudioApplies(split, true, true)).toBe(true); // borrador con saludo grabado: se usa
    expect(greetingAudioApplies(split, false, true)).toBe(false); // borrador sin saludo: linea completa
    expect(greetingAudioApplies(null, false, true)).toBe(false);
    expect([new EspeakProvider().draft, new FliteProvider().draft, new SilentProvider(2.6).draft]).toEqual([true, true, true]);
  });

  it.skipIf(!espeakAvailable)("sintetiza espanol a WAV", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "espeak-"));
    const res = await new EspeakProvider().synthesize({
      blockId: "s01",
      character: "teto",
      text: "¡Papu papu! *CrowdStrike*: el fallo que tumbó aeropuertos.",
      language: "es",
      voice: { espeak: { voice: "mb-es3", pitch: 62, speed: 138 } },
      outBase: path.join(dir, "s01.raw"),
    });
    expect(await probeDurationMs(res.file)).toBeGreaterThan(1500);
    expect(fs.existsSync(path.join(dir, "s01.raw.txt"))).toBe(false);
  });
});

describe("render de prototipo en baja resolucion", () => {
  it("tamano escalado con dimensiones pares (como Remotion)", () => {
    expect(scaledSize(1080, 1920, 0.5)).toEqual({ width: 540, height: 960 });
    expect(scaledSize(1080, 1920, 1 / 3)).toEqual({ width: 360, height: 640 });
    expect(scaledSize(1080, 1920, 0.45)).toEqual({ width: 486, height: 864 });
    expect(scaledSize(1080, 1920, 1)).toEqual({ width: 1080, height: 1920 });
  });

  it("la validacion del MP4 acepta el tamano del prototipo solo si se pide; la tabla de QA lo dice", async () => {
    const { cfg } = await engine();
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "preview-")), "preview.mp4");
    await run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=s=540x960:r=30:d=1", "-f", "lavfi", "-i", "sine=f=440:r=48000:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
    const asFinal = await validateOutput(file, cfg.render, { durationPolicy: "ignore", fullDecode: false });
    expect(asFinal.issues.map((i) => i.code)).toContain("RESOLUTION");
    const asPreview = await validateOutput(file, cfg.render, { durationPolicy: "ignore", fullDecode: false, expectedSize: { width: 540, height: 960 } });
    expect(asPreview.issues.map((i) => i.code)).not.toContain("RESOLUTION");
    const qa = buildQaTable({ output: asPreview, previewSize: { width: 540, height: 960 } });
    expect(qa.find((r) => r.check === "format")).toMatchObject({ condition: "540x960 (prototipo), 9:16, H.264/AAC", status: "pass" });
    expect(cfg.render.preview).toEqual({ scale: 0.5, crf: 28 });
  });
});

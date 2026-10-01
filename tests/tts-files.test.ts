import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FilesProvider } from "../src/tts/files";
import type { TTSProvider, TTSRequest } from "../src/tts/provider";
import { fromRepo } from "../src/utils/paths";

const req = (blockId: string): TTSRequest => ({ blockId, character: "teto", text: "hola papus", language: "es", voice: {}, outBase: "x" });

describe("FilesProvider", () => {
  const dir = fs.mkdtempSync(path.join(fromRepo(".cache"), "files-"));
  fs.writeFileSync(path.join(dir, "s01-hook.mp3"), "fake");

  it("usa el archivo del bloque si existe", async () => {
    const p = new FilesProvider(dir);
    expect((await p.synthesize(req("s01-hook"))).file).toBe(path.join(dir, "s01-hook.mp3"));
  });

  it("sin respaldo, un bloque sin archivo es un error", async () => {
    await expect(new FilesProvider(dir).synthesize(req("s99-closing"))).rejects.toThrow(/No hay audio/);
  });

  it("con respaldo (--allow-missing-audio): delega y registra el bloque como faltante", async () => {
    const fallback: TTSProvider = {
      name: "silent",
      check: async () => ({ ok: true }),
      cacheTag: () => "silent|2.6",
      synthesize: async () => ({ file: "silencio.wav" }),
    };
    const p = new FilesProvider(dir, fallback);
    expect((await p.synthesize(req("s99-closing"))).file).toBe("silencio.wav");
    expect(p.missing).toEqual(["s99-closing"]);
    // la clave de cache cambia cuando el archivo aparece -> el bloque se regenera con la voz real
    const before = p.cacheTag(req("s99-closing"));
    fs.writeFileSync(path.join(dir, "s99-closing.wav"), "fake");
    expect(p.cacheTag(req("s99-closing"))).not.toBe(before);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

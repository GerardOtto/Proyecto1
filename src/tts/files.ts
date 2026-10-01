// Audio ya generado (WAV/MP3) por bloque: projects/<id>/audio/input/<blockId>.(wav|mp3|m4a|ogg)
// Permite usar voces grabadas o generadas fuera del pipeline.
// Con `fallback` (opcion --allow-missing-audio) un bloque sin archivo se genera en silencio con su
// duracion estimada y queda registrado en `missing`: sirve para previsualizar antes de grabar.
import fs from "node:fs";
import path from "node:path";
import { log } from "../utils/log";
import { TTSError, type TTSProvider, type TTSRequest } from "./provider";

const EXTS = [".wav", ".mp3", ".m4a", ".ogg", ".flac"];

export class FilesProvider implements TTSProvider {
  readonly name = "files";
  /** Bloques que se rellenaron con silencio por falta de archivo. */
  readonly missing: string[] = [];

  constructor(
    private readonly inputDir: string,
    private readonly fallback?: TTSProvider,
  ) {}

  async check() {
    return fs.existsSync(this.inputDir)
      ? { ok: true }
      : { ok: false, reason: `No existe ${this.inputDir} (coloca ahi <blockId>.wav|mp3)` };
  }

  private find(blockId: string): string | null {
    for (const ext of EXTS) {
      const f = path.join(this.inputDir, blockId + ext);
      if (fs.existsSync(f)) return f;
    }
    return null;
  }

  cacheTag(req: TTSRequest): string {
    const f = this.find(req.blockId);
    if (!f) return `files|missing${this.fallback ? `|${this.fallback.cacheTag(req)}` : ""}`;
    const st = fs.statSync(f);
    return `files|${path.basename(f)}|${st.size}|${st.mtimeMs}`;
  }

  async synthesize(req: TTSRequest) {
    const f = this.find(req.blockId);
    if (f) return { file: f };
    if (!this.fallback) throw new TTSError(`No hay audio para el bloque ${req.blockId} en ${this.inputDir} (${EXTS.join(", ")})`);
    this.missing.push(req.blockId);
    log.warn(`${req.blockId}: sin archivo de audio -> silencio con duracion estimada (graba ${req.blockId}.mp3)`);
    return this.fallback.synthesize(req);
  }
}

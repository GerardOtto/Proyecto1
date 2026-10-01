// Interfaz de transcripcion con timestamps por palabra.
import type { TimedWord } from "./align";

export interface Transcriber {
  readonly name: string;
  check(): Promise<{ ok: boolean; reason?: string }>;
  /** Palabras reconocidas con tiempos relativos al inicio del archivo. */
  transcribe(file: string, opts: { language: string; text: string; durationMs: number }): Promise<TimedWord[]>;
}

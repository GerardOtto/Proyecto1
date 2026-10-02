// Interfaz abstracta de TTS. El motor NO depende de Fish Audio: cualquier proveedor que genere
// un archivo de audio por bloque de dialogo sirve (fish, files, espeak, flite, silent).
export interface EspeakVoice {
  /** Voz de espeak-ng (p. ej. "mb-es3" con MBROLA, o "es-419+f3"). */
  voice: string;
  /** Tono 0-99 (50 = normal). */
  pitch: number;
  /** Velocidad en palabras por minuto de espeak-ng (antes del voiceTempo del motor). */
  speed: number;
}

export interface VoiceSettings {
  /** Fish Audio: id del modelo de voz (reference_id). */
  fishReferenceId?: string;
  speed?: number;
  /** flite (solo desarrollo): nombre de voz (slt, kal, awb, rms...). */
  fliteVoice?: string;
  /** espeak-ng (solo prototipos): voz en espanol por personaje. */
  espeak?: EspeakVoice;
}

export interface TTSRequest {
  blockId: string;
  character: string;
  text: string;
  language: string;
  voice: VoiceSettings;
  /** Ruta de salida SIN extension; el proveedor decide la extension. */
  outBase: string;
}

export interface TTSResult {
  file: string;
}

export interface TTSProvider {
  readonly name: string;
  /**
   * Voz de borrador (espeak, flite, silent): no representa la voz final. Si falta el audio grabado
   * del saludo recurrente, el proveedor dice la linea completa en lugar de fallar (ADR 0013).
   */
  readonly draft?: boolean;
  /** Comprueba credenciales/binarios. */
  check(): Promise<{ ok: boolean; reason?: string }>;
  /** Parte de la clave de cache que identifica la salida (proveedor + voz + modelo). */
  cacheTag(req: TTSRequest): string;
  synthesize(req: TTSRequest): Promise<TTSResult>;
}

export class TTSError extends Error {}

// Interfaz abstracta de TTS. El motor NO depende de Fish Audio: cualquier proveedor que genere
// un archivo de audio por bloque de dialogo sirve (fish, files, flite, silent).
export interface VoiceSettings {
  /** Fish Audio: id del modelo de voz (reference_id). */
  fishReferenceId?: string;
  speed?: number;
  /** flite (solo desarrollo): nombre de voz (slt, kal, awb, rms...). */
  fliteVoice?: string;
  /** Ritmo propio (atempo local, no se envia al proveedor; ADR 0013). */
  tempo?: number;
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
  /** Comprueba credenciales/binarios. */
  check(): Promise<{ ok: boolean; reason?: string }>;
  /** Parte de la clave de cache que identifica la salida (proveedor + voz + modelo). */
  cacheTag(req: TTSRequest): string;
  synthesize(req: TTSRequest): Promise<TTSResult>;
}

export class TTSError extends Error {}

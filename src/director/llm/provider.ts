// Interfaz minima de LLM para el director. El motor no depende de un proveedor concreto:
// cualquier implementacion que devuelva JSON conforme a un schema sirve (Anthropic, mock, otro).
export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMJsonRequest {
  system: string;
  messages: LLMMessage[];
  /** JSON Schema (subconjunto compatible con structured outputs). */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface LLMJsonResponse {
  /** JSON parseado (sin validar). */
  json: unknown;
  /** Texto crudo devuelto (para agregarlo al historial en reintentos). */
  raw: string;
  model: string;
  /** inputTokens excluye los tokens leidos/escritos en cache (se reportan aparte). */
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number };
}

export interface LLMProvider {
  readonly name: string;
  check(): Promise<{ ok: boolean; reason?: string }>;
  generateJson(req: LLMJsonRequest): Promise<LLMJsonResponse>;
}

export class LLMError extends Error {}

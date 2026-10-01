// Proveedor Anthropic (Claude) con structured outputs (output_config.format json_schema).
// Requiere ANTHROPIC_API_KEY (o un perfil de `ant auth login`). Modelo: DIRECTOR_MODEL o claude-opus-5-5;
// esfuerzo: DIRECTOR_EFFORT o high.
//
// Usa el fallback del lado del servidor ("fallbacks": "default", beta server-side-fallback-2026-07-01):
// si el modelo rechaza la peticion por una politica, la API la reintenta en un modelo de respaldo.
import Anthropic from "@anthropic-ai/sdk";
import { LLMError, type LLMJsonRequest, type LLMJsonResponse, type LLMProvider } from "./provider";

export const DEFAULT_DIRECTOR_MODEL = "claude-opus-5-5";
export const DEFAULT_DIRECTOR_EFFORT = "high";
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly model: string;
  readonly effort: Effort;
  private client: Anthropic | null = null;

  /** Modelo: opts > DIRECTOR_MODEL > claude-opus-5-5. Esfuerzo: opts > DIRECTOR_EFFORT > high. */
  constructor(opts: { model?: string; effort?: Effort } = {}) {
    this.model = opts.model || process.env.DIRECTOR_MODEL || DEFAULT_DIRECTOR_MODEL;
    const effort = opts.effort ?? (process.env.DIRECTOR_EFFORT as Effort | undefined) ?? DEFAULT_DIRECTOR_EFFORT;
    if (!EFFORTS.includes(effort)) throw new LLMError(`Esfuerzo invalido: ${effort} (${EFFORTS.join("|")})`);
    this.effort = effort;
  }

  async check() {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) {
      // El SDK tambien puede usar un perfil de `ant auth login`; si no existe fallara al llamar.
      return { ok: true, reason: "ANTHROPIC_API_KEY no definido: se intentara el perfil de `ant auth login`" };
    }
    return { ok: true };
  }

  private getClient(): Anthropic {
    this.client ??= new Anthropic();
    return this.client;
  }

  async generateJson(req: LLMJsonRequest): Promise<LLMJsonResponse> {
    const client = this.getClient();
    let message;
    try {
      // Streaming + finalMessage: evita timeouts HTTP con salidas largas.
      const stream = client.beta.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens ?? 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: {
          effort: this.effort,
          format: { type: "json_schema", schema: req.schema },
        },
        // El system (prompt + especificacion + ejemplo) es identico entre llamadas: se cachea para
        // abaratar reintentos y lotes. Si es mas corto que el minimo cacheable, la API lo ignora.
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new LLMError("Anthropic: credenciales invalidas (ANTHROPIC_API_KEY)");
      if (err instanceof Anthropic.RateLimitError) throw new LLMError("Anthropic: rate limit; reintenta mas tarde");
      if (err instanceof Anthropic.BadRequestError) throw new LLMError(`Anthropic 400: ${err.message}`);
      if (err instanceof Anthropic.APIError) throw new LLMError(`Anthropic ${err.status ?? ""}: ${err.message}`);
      throw err;
    }
    if (message.stop_reason === "refusal") throw new LLMError("El modelo rechazo la solicitud (stop_reason=refusal)");
    if (message.stop_reason === "max_tokens") throw new LLMError("Salida truncada (max_tokens): reduce el guion o sube maxTokens");
    const raw = message.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new LLMError(`La respuesta no es JSON valido: ${raw.slice(0, 300)}`);
    }
    return {
      json,
      raw,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}

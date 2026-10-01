// Proveedor simulado para tests: devuelve respuestas predefinidas en orden.
import type { LLMJsonRequest, LLMJsonResponse, LLMProvider } from "./provider";

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";
  readonly requests: LLMJsonRequest[] = [];
  constructor(private readonly responses: unknown[]) {}

  async check() {
    return { ok: true };
  }

  async generateJson(req: LLMJsonRequest): Promise<LLMJsonResponse> {
    this.requests.push(req);
    const next = this.responses.shift();
    if (next === undefined) throw new Error("MockLLMProvider sin respuestas");
    return { json: next, raw: JSON.stringify(next), model: "mock" };
  }
}

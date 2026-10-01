# ADR 0003 — Proveedores intercambiables (TTS, transcripcion, LLM)

- Estado: aceptado (2026-10-01)

## Decision
- `TTSProvider` (fish, files, flite, silent), `Transcriber` (whisper-cpp, estimate) y `LLMProvider`
  (anthropic, mock) son interfaces minimas en `src/tts`, `src/transcribe`, `src/director/llm`.
- El director LLM usa structured outputs con un schema generado desde el catalogo (enums de IDs, todo
  requerido, sin oneOf/min/max), y luego valida con el validador del motor y reintenta con feedback.
- El director `rules` es el default: determinista, sin red, cubre guiones etiquetados.

## Consecuencias
- Se puede desarrollar y testear todo el pipeline sin claves ni red (silent/estimate/rules/mock).
- Agregar un proveedor = implementar la interfaz y registrarlo en el factory.

# Changelog

## 0.1.0 — 2026-10-01 — MVP tecnico (fases 0-7 del plan)
- Fase 0: proyecto TypeScript + Remotion 4, `doctor`, `smoke`, CLAUDE.md, schemas.
- Fase 1: catalogo (`config/characters.json`, `reactions.json`, `assets.json`), validacion de assets
  (rutas, vacios, tipos, duplicados), assets de proyecto, placeholders deterministas.
- Fase 2: composicion `ShortVideo` (Background, Stage, Captions, Visuals, Camera, MemeLayer, Audio),
  compilador `RenderPlan`, timeline manual `projects/manual_001`.
- Fase 3: `TTSProvider` (fish, files, flite, silent) con cache por bloque.
- Fase 4: whisper.cpp + estimate, alineado guion<->transcripcion, color por personaje, SRT.
- Fase 5: eventos (reaction, visual show/hide, zoom, shake, meme, emphasis, pause, sfx), validadores.
- Fase 6: parser de guion + director `rules`; director LLM (Anthropic, structured outputs, reintentos).
- Fase 7: QA hard/soft, reporte, prueba de reproducibilidad, demo_001 (75 s) y tests (80).
- ADRs 0001-0003.

# Changelog

## Sin publicar
- Avatares reales de Teto, Miku y Luka (renders MMD aportados por el usuario, `license_status: unknown`);
  fondo eliminado con `scripts/remove-bg.py`; origen de cada reaccion en `assets/characters/SOURCES.md`.
- Voces de Fish Audio registradas por personaje (`voice.fish.referenceId`).
- Fix: un `fishReferenceId` vacio en `requested_voices.json` ya no tapa el id global del personaje.
- Audio: nivelado por bloque de voz a `audio.voiceBlockLufs` (-20 LUFS, ganancia estatica) antes de la
  mezcla, para que voces de distinto origen suenen igual de fuertes.
- Fix (Windows): `bg_tech_loop.mp4` regenerado con GOP corto y sin B-frames; el compositor de Remotion
  fallaba con "No frame found at position".

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

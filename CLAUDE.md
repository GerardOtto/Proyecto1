# CLAUDE.md — short-video-engine

## Objetivo
Construir un motor local que transforme un guion en un video vertical educativo de 60-120 s
(1080x1920, 30 fps, H.264/AAC) usando personajes Vocaloid (Teto, Miku, Luka, Rin, Len) representados
por imagenes estaticas por emocion, subtitulos por color de personaje, recursos visuales y un fondo.
Especificacion completa: `docs/01_PRODUCT_SPEC.md` (plan original en `docs/plan/`).
Estado actual y pendientes: `docs/STATUS.md`.
Distribucion (horarios, descripciones, etiqueta de IA): `docs/10_DISTRIBUCION.md`.
Rotulo de palabra clave en el gancho: implementado (`meta.hookTitle`, ADR 0006; `docs/10_DISTRIBUCION.md` §8).
Autopiloto de produccion: `docs/11_AUTOPILOT.md` (ADR 0007; revision humana obligatoria antes de producir/publicar).
Planilla de produccion, prototipos y subida con Selenium: `docs/12_PUBLICACION.md` (ADR 0013, 0014).

## Reglas (no negociables)
1. No inventar paths de assets: todo se referencia por ID contra `config/*.json` (catalogo).
2. No aceptar timeline invalido: `schemas/timeline.schema.json` + `src/validation/timeline.ts`.
3. No permitir duracion < 60 s ni > 120 s en el timeline final ni en el MP4.
4. No acoplar el motor a Fish Audio: TTS via `TTSProvider` (`src/tts/`).
5. No acoplar el motor a un proveedor concreto de LLM: `LLMProvider` (`src/director/llm/`).
6. Todo componente importante debe tener prueba o fixture (`tests/`, `tests/fixtures/`).
7. Preferir determinismo a comportamiento magico (sin Math.random/Date en render; `random(seed)` de Remotion).
8. Antes de cambiar arquitectura, revisar schemas y tests (y escribir un ADR en `docs/adr/`).
9. Ejecutar lint/test/render-smoke despues de cambios relevantes.
10. Mantener separacion clara entre narrativa (director -> timeline) y rendering (plan -> Remotion).

Principio: la IA decide QUE ocurre (timeline.json); el motor decide COMO (src/timeline/plan.ts).
El LLM no tiene libertad pixel a pixel. El AUDIO es la autoridad temporal (build-timeline reajusta).

## Comandos
```bash
npm run doctor                     # entorno (node, ffmpeg, git, whisper, claves)
npm run catalog                    # valida config/*.json y que cada asset exista y no este vacio
npm run graphics                   # assets/visuals/src/*.html -> PNG (logos, titulares, graficos)
npm run smoke                      # render de humo 8 s (tests/fixtures/smoke.timeline.json)
npm test                           # vitest (rapido, sin render)
npm run test:render                # smoke render via vitest (lento)
npm run lint                       # eslint + tsc --noEmit
npm run generate -- --project projects/demo_001 [--tts fish|files|espeak|flite|silent] [--director rules|anthropic]
npm run generate -- --project projects/<ep> --tts espeak --preview     # prototipo 540x960 con voz de borrador (ADR 0013)
npm run render   -- --project projects/demo_001 [--repro] [--safe-area] [--preview]
npm run validate -- --project projects/demo_001 [--draft] [--output]   # valida SIN renderizar
npm run studio   -- --project projects/demo_001                        # preview en Remotion Studio
npm run review   [-- --episode ep_a,ep_b]                              # carpeta de revision simple (REVIEW_DIR)
npm run autopilot [-- --batch 3 | --produce | --episode <id> --produce]  # produccion automatica (docs/11)
npm run avatars:ingest -- --character <id> --from <carpeta>           # renders -> avatares
npm run planilla [-- --desde 2026-10-05 --semanas 4]                   # planilla .xlsx: calendario, plazos, seguimiento
npm run upload -- --login | --episode <id> [--simular] | --due [--publicar]  # Selenium + Chromium (ADR 0014)
npm run test:upload                                                    # flujos de subida vs paginas simuladas (chromedriver)
```
Pasos sueltos: `analyze`, `voices`, `transcribe`, `build-timeline` (ver `docs/07_PIPELINE.md`).

## Mapa del codigo
- `src/timeline/` — PURO (corre en Node y en el navegador): tipos, frames, captions, plan, duracion.
- `src/compositions/`, `src/components/` — Remotion/React. Solo leen el `RenderPlan`; sin logica de decision.
- `src/catalog/` — carga config + catalogo resuelto (personajes, reacciones, assets, assets del proyecto).
- `src/validation/` — ajv (schemas), validacion semantica del timeline, validacion del MP4.
- `src/director/` — parser de guion, director `rules`, director LLM (`llm/`).
- `src/tts/`, `src/transcribe/`, `src/audio/` — voz, timestamps (whisper.cpp / estimate), ffmpeg.
- `src/pipeline/` — pasos, render (bundle+renderMedia), reporte/QA.
- `src/autopilot/` — autopiloto: noticias/evergreen, plan, escritores, SFX, graficos, publicacion (ADR 0007);
  `schedule.ts` + `planilla*.ts`: planilla de produccion (ADR 0014).
- `src/upload/` — subida con Selenium: kit/validacion del video final, `--due` desde la planilla, flujos por
  plataforma (`platforms.ts > SITES`: selectores en un solo lugar).
- `config/autopilot/` — fuentes, banco evergreen, formatos, casting, temas visuales, reglas SFX, humor.
- `scripts/` — CLIs finos que llaman a `src/pipeline/steps.ts`.

## Modo de trabajo
1. Inspeccionar el repo y escribir un plan antes de crear archivos importantes.
2. Implementar en incrementos pequenos y ejecutables.
3. Tras cada fase: `npm run lint && npm test && npm run smoke`.
4. Defecto visual -> corregir el componente responsable, no hackear el timeline.
5. Registrar decisiones estructurales en `CHANGELOG.md` y `docs/adr/`.
6. Nunca eliminar ni desactivar tests para conseguir un render verde.

## Gotchas
- Codigo en `src/timeline/**`, `src/components/**`, `src/compositions/**` no puede importar modulos de Node.
- Constantes compartidas Node/bundle en `src/compositions/constants.ts` (sin efectos secundarios).
- El render copia SOLO los archivos del plan a `.cache/public/<proyecto>` (publicDir de Remotion).
- `REMOTION_BROWSER_EXECUTABLE` permite usar un Chromium ya instalado (si no, Remotion descarga uno).
- whisper.cpp 1.5.5 via `@remotion/install-whisper-cpp`; el modelo se valida por magic bytes.
- Licencias: placeholder/unknown => `commercialUse: blocked` en report.json (ver docs/09_LICENSING.md).
- `preview.mp4` (prototipo) nunca se publica: `npm run upload` solo acepta el `video.mp4` final de 1080x1920.
- Las funciones que empiezan con `use` son hooks para ESLint (react-hooks): no nombrar asi helpers de Node.

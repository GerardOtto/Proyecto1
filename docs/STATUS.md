# Estado del proyecto — MVP tecnico v0.1.0 (2026-10-01)

Reporte del checklist de arranque (seccion 14 del plan): que funciona, que falta y como ejecutar.

## Resumen
Todas las fases 0-7 del plan estan implementadas. El pipeline completo corre de punta a punta en
local y fue verificado en un contenedor Linux (Node 22, FFmpeg 6.1, 4 vCPU):

- `npm run generate -- --project projects/demo_001 --tts flite` -> MP4 de **75.3 s**, 1080x1920,
  H.264/AAC, **todos los checks de QA en PASS** (incluida reproducibilidad con `--repro`).
  Render: ~300 s (~7.4 fps).
- `npm run render -- --project projects/manual_001` -> timeline escrito a mano (64 s) a MP4.
- `npm run smoke` -> fixture de 8 s.
- `npm test` -> 80 tests en verde; `npm run lint` (ESLint + tsc) limpio.

## Fases
| Fase | Definition of done | Estado | Evidencia |
|---|---|---|---|
| 0 Preparacion | Repo ejecuta hello-world y renderiza un clip de 3-5 s | Hecho | `npm run doctor`, `npm run smoke` |
| 1 Catalogo | Resolver cualquier personaje/reaccion por ID | Hecho | `npm run catalog`, tests/catalog.test.ts |
| 2 Render minimo | Timeline manual -> MP4 9:16 correcto | Hecho | projects/manual_001, tests/plan.test.ts |
| 3 Audio | Voces por bloque via TTSProvider | Hecho* | fish/files/flite/silent; *Fish Audio sin probar contra la API real (sin clave) |
| 4 Subtitulos | Sincronizados, legibles, color por personaje | Hecho* | alineado + paginado + SRT; *whisper.cpp compila, pero el modelo no pudo descargarse en el entorno de desarrollo (red) |
| 5 Motor de timeline | timeline.json completo se renderiza sin edicion manual | Hecho | 9 tipos de evento, validadores |
| 6 Director LLM | Guion nuevo -> timeline valido | Hecho* | director `rules` (determinista) + `anthropic` (structured outputs); *anthropic probado con proveedor simulado, no contra la API real |
| 7 Validacion y demo | Tests automaticos, demo 60-90 s, reporte | Hecho | demo_001 75 s, report.json, docs/08_QA.md |

## Verificado vs. pendiente de verificar localmente
| Componente | Verificado aqui | Pendiente (requiere claves/red) |
|---|---|---|
| Director rules + parser | si | — |
| Director Anthropic | con mock (schema, conversion, reintentos) | 1 corrida real con `ANTHROPIC_API_KEY` (`--director anthropic`) |
| TTS silent / flite / files | silent y flite si; files por tests de codigo | — |
| TTS Fish Audio | — | completar `voice.fish.referenceId` por personaje y `FISH_AUDIO_API_KEY`; confirmar header `model` (`FISH_AUDIO_MODEL`) |
| whisper.cpp | compila (1.5.5) | `npm run whisper:install` (descarga desde huggingface.co) y `--transcriber whisper-cpp` |
| Render Remotion | si (chromium headless del sistema) | en local Remotion descarga Chrome Headless Shell la primera vez |
| Remotion Studio | arranca y sirve la UI | revisar la preview interactiva |

## Como ejecutar (local)
```bash
npm install && cp .env.example .env
npm run doctor
npm run smoke                                         # 8 s
npm run generate -- --project projects/demo_001 --tts silent    # sin claves (voz muda, tiempos estimados)
npm run generate -- --project projects/demo_001 --tts flite     # voz robotica offline (si ffmpeg tiene flite)
# Con voces reales:
#   1) en config/characters.json (o projects/demo_001/requested_voices.json) poner fishReferenceId
#   2) FISH_AUDIO_API_KEY en .env
npm run whisper:install                               # opcional, recomendado
npm run generate -- --project projects/demo_001 --tts fish --repro
```

## Publicacion y prototipos (2026-10-02, ADR 0013 y 0014)
- **Prototipos**: los 5 episodios pendientes tienen `preview.mp4` (540x960, voz de borrador espeak) para
  revision; todos los checks hard en PASS. Falta la revision humana y luego voces Fish Audio + render final.
- **Planilla**: `projects/_autopilot/planillas/planilla_produccion_2026-10-05.xlsx` (4 semanas, 12
  episodios: 6 existentes + 6 temas sugeridos; 36 publicaciones sin avisos de separacion).
- **Subida** (`npm run upload`): probada contra paginas simuladas de TikTok, Instagram y YouTube con
  Chromium 141 + chromedriver. **Pendiente**: primera corrida real con `--login` y el modo con
  confirmacion; ajustar `src/upload/platforms.ts > SITES` si alguna pantalla no coincide.

## Que falta / siguientes pasos sugeridos
- **Autopiloto (v0.3.0)**: implementado y testeado offline (docs/11_AUTOPILOT.md). Pendiente en local:
  verificar feeds (`npm run autopilot -- --check-feeds`), primera corrida del escritor LLM con noticias,
  saludo pregrabado y voz de cada personaje del casting. Informe: docs/Informe_Autopiloto.pdf.
0. **[HECHO] Rotulo de palabra clave en el gancho** (`meta.hookTitle` + `TitleCard`): especificacion
   completa, tests y criterios de aceptacion en `docs/10_DISTRIBUCION.md` §8. Requiere ADR 0006.
1. **Assets reales**: [HECHO para avatares, ADR 0008] 7 personajes con imagenes reales desde Pinterest
   (`assets/characters/SOURCES.md`), todos `license_status: unknown`. Pendiente: documentar autores y
   licencias de avatares, memes, logos y visuales.
2. **Voces**: elegir/registrar un `reference_id` de Fish Audio por personaje y verificar sus derechos.
   Faltan Rin, Len y Kaito (sin voz no entran al casting automatico). Neru es muda por diseno: su
   "voz" es `sfx_neru_phone` y entra como cameo (ADR 0011).
3. **Primera corrida real** con Fish Audio + whisper.cpp (`--transcriber whisper-cpp`) y revisar la
   coincidencia de alineado en `transcript/words.json` (warning si < 60%).
4. **Primera corrida real del director LLM** (`--director anthropic`) con un guion libre; ajustar
   `prompts/director.system.md` segun resultados.
5. **Calibrar layout con arte real**: `defaultScale`, `layout.visualArea`, `captions.centerY` y
   `avgCharWidthEm` (estimacion de ancho del texto) usando `npm run render -- --safe-area`.
6. **Rendimiento**: probar `concurrency`, `x264Preset` y cache del bundle si los tiempos de render
   molestan (hoy se empaqueta en cada render).
7. Validacion visual manual del piloto (docs/08_QA.md) en un telefono.

## Notas tecnicas relevantes
- Remotion fijado en **4.0.530**: el paquete publicado `@remotion/cli@4.0.531` trae
  `dist/render-queue/queue.js` vacio y rompe Remotion Studio (`getRenderQueue is not a function`).
  Antes de actualizar, verificar `npm run studio`.
- Los avatares placeholder son SVG rasterizados con el decodificador librsvg de ffmpeg
  (`npm run assets:placeholders`); si tu ffmpeg no lo tiene, quedan como `.svg` y el catalogo los
  resuelve por extension.
- El alineado convierte `atWord` -> `atMs` con el audio real; los textos de subtitulos son los del guion.

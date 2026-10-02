# 07 — Pipeline de generacion

`npm run generate -- --project projects/<id>` ejecuta los 10 pasos del plan. Cada paso tiene su
script (para depurar por partes) y escribe en `projects/<id>/report.json > steps`.

| # | Paso | Script | Entrada | Salida |
|---|---|---|---|---|
| 1 | Ingreso | (generate) | script.md, project.json, requested_voices.json, assets | contexto + catalogo |
| 2 | Analisis narrativo | `analyze` | script.md + catalogo | `timeline.draft.json` (timingSource=estimated) |
| 3 | Validacion | `analyze` / `validate --draft` | borrador | errores bloquean |
| 4 | Generacion de voz | `voices` | escenas con dialogo | `audio/blocks/<sceneId>.wav`, `audio/index.json` |
| 5 | Concatenacion | `build-timeline` | bloques + offsets | `audio/master.wav` (amix + loudnorm -14 LUFS, TP -1.5 dB) |
| 6 | Transcripcion | `transcribe` | bloques | `transcript/words.json` (palabras del guion con tiempos) |
| 7 | Reajuste | `build-timeline` | borrador + audio + palabras | `timeline.json` (timingSource=audio), `transcript/subtitles.srt` |
| 8 | Render | `render` | timeline.json | `render-plan.json`, `output/<id>/video.mp4` |
| 9 | Validacion final | `render` / `validate --output` | MP4 | QA (ver 08_QA.md) |
| 10 | Salida | `render` | — | `output/<id>/{video.mp4, timeline.json, subtitles.srt, report.json}` |

## Proveedores
- **Director**: `rules` (determinista, sin red; requiere guion etiquetado) | `anthropic` (Claude,
  structured outputs con enums del catalogo; reintenta con los errores del validador; si la duracion
  real queda fuera de 60-120 s, `generate` hace una segunda ronda pidiendo extender/comprimir).
  Seleccion: `--director` > `project.json > director` > `rules`.
- **TTS** (`TTSProvider`): `fish` (Fish Audio, `FISH_AUDIO_API_KEY`, `reference_id` por personaje en
  characters.json o requested_voices.json) | `files` (WAV/MP3 ya generados en
  `audio/input/<sceneId>.wav`; `npm run voices -- --list` muestra los ids; con
  `generate --allow-missing-audio` los que falten salen en silencio provisional y se listan en
  report.json > steps.voices.missingAudio) | `espeak` (voz offline en **espanol** con espeak-ng y
  MBROLA, una voz por personaje en `characters.json > voice.espeak`; solo prototipos, ADR 0013) |
  `flite` (voz offline de ffmpeg en ingles, solo desarrollo) | `silent` (silencio con duracion
  estimada, mock). Las voces de borrador (`espeak`, `flite`, `silent`) dicen el saludo "¡Papu papu!"
  ellas mismas si falta su audio grabado; `fish` y `files` lo siguen exigiendo.
- **Transcripcion**: `whisper-cpp` (local) | `estimate` (reparte el texto en la parte con voz) |
  `auto` (whisper si esta instalado; `estimate` con TTS `silent`).

## Prototipos de baja resolucion (ADR 0013)
`npm run generate -- --project P --tts espeak --preview` produce `output/<id>/preview.mp4`: mismo
timeline, voz de borrador y render a `render.json > preview.scale` (0.5 -> 540x960) con `preview.crf`.
La validacion del MP4 espera ese tamano, la tabla de QA lo indica y `report.json > summary.preview` queda
en `true`. No se exporta portada ni se prueba reproducibilidad. Nunca se publica: `npm run upload`
rechaza cualquier archivo que no sea el `video.mp4` final de 1080x1920. `npm run review` lo copia como
`Prototipo.mp4` en la carpeta de revision.

## Autoridad temporal
El LLM/director propone estructura y tiempos estimados; **el audio real manda**:
1. Duracion de cada escena de dialogo = duracion del audio del bloque + pausas.
2. Escenas meme/pausa conservan su duracion fija.
3. Lead-in 250 ms, gap entre escenas 280 ms, cola 1500 ms. Si el total queda fuera de 60-120 s, se
   ajustan gaps (120-900 ms) y cola (hasta 6 s); si no alcanza: `DURATION_TOO_SHORT`
   (`extend_scene_or_add_explanation`) o `DURATION_TOO_LONG` (`request_recompression_of_timeline`).
4. Las escenas quedan contiguas (el silencio posterior pertenece a la escena).
5. `atWord` -> `atMs` con los tiempos reales de cada palabra.

## Alineado de palabras
Whisper aporta tiempos; el guion aporta el texto correcto. Alineado global (Needleman-Wunsch con
similitud Levenshtein >= 0.5). Palabras sin pareja se interpolan entre anclas. Una coincidencia < 60%
genera warning (voz ininteligible o texto distinto).

## Cache e idempotencia
- Voces: clave = proveedor + voz + modelo + personaje + texto. Cambiar una linea solo regenera ese bloque.
  `--force-voices` regenera todo.
- Transcripcion: clave = transcriptor + clave del bloque.
- `.cache/probe.json`: duraciones ffprobe. `.cache/public/<id>`: publicDir de Remotion por render.

## Archivos por proyecto
```
projects/<id>/
  script.md  project.json  requested_voices.json  [visuals/] [background.mp4] [audio/input/]
  timeline.draft.json  timeline.json  render-plan.json  report.json       (generados)
  audio/blocks/*.wav  audio/parts/*.wav  audio/master.wav  audio/index.json
  transcript/words.json  transcript/subtitles.srt
```

# 01 — Especificacion de producto (resumen del plan v1.0)

## Objetivo
Motor local que, dado un **guion + audio (o TTS) + avatares JPG/PNG + recursos visuales + video de
fondo**, produce automaticamente un video vertical educativo de **60-120 s** con dialogo, cambios de
avatar, subtitulos por color de personaje, recursos visuales y una secuencia narrativa coherente.
No es un editor ni una plataforma web: es un generador reproducible y configurable por archivos.

## Alcance del MVP
| Incluido | Fuera del MVP |
|---|---|
| Video 1080x1920, 30 fps | Clips generados por IA |
| Audio TTS (Fish Audio) o WAV/MP3 ya generado | Lip-sync facial (avatar estatico) |
| Avatares JPG/PNG por emocion | Personajes 3D |
| Subtitulos por palabra / grupos de palabras | Editor drag-and-drop |
| Video MP4 de fondo | Backend cloud (todo es local) |
| Imagenes / logos / diagramas insertables | Generacion automatica de imagenes |
| SFX simples y eventos meme | Recomendacion automatica de memes |
| Validacion estricta 60-120 s | Publicacion directa / autopublicacion |
| Preview en Remotion Studio | |

**Definicion de exito**: dado un proyecto con guion + audio + catalogo de assets, el sistema produce
automaticamente un MP4 vertical de al menos 60 s, con dialogo, cambios de avatar, subtitulos con color
por personaje, recursos visuales y una secuencia narrativa coherente.

## Decision clave: banco de reacciones a mano
8 estados por personaje (neutral, feliz, sorprendido, confundido, enojado, riendo, nerd, shocked).
Cubren explicar/preguntar/reaccionar/corregir/rematar, permiten cambios visibles sin animacion y una
taxonomia simple. Se amplia solo cuando un guion real lo necesite. Ver `02_CHARACTER_RULES.md`.

## Arquitectura
```
GUION (.md) -> Director (rules | LLM) -> timeline.draft.json
   -> TTS por bloque (TTSProvider: fish | files | flite | silent) -> audio/blocks/*.wav
   -> transcripcion (whisper.cpp | estimate) + alineado con el guion -> transcript/words.json
   -> reajuste (el audio manda) + pista maestra (ffmpeg) -> timeline.json + subtitles.srt
   -> compilador de plan (src/timeline/plan.ts) -> RenderPlan
   -> Remotion + React (Background, Stage/Characters, Captions, Visuals, Meme/SFX, Camera)
   -> MP4 H.264/AAC -> validacion final -> report.json
```

| Capa | Responsabilidad | Regla |
|---|---|---|
| Claude Code | Construir, probar, depurar y mantener el motor | No renderiza por su cuenta; implementa el pipeline |
| Director (LLM o reglas) | Guion -> eventos estructurados | Salida estrictamente JSON validable |
| TTS (Fish Audio) | Voz por personaje | Un archivo por intervencion |
| Whisper.cpp | Timestamps por palabra | Local, reproducible, sin API |
| Remotion | Componer el video | La logica visual vive en React/TS |
| FFmpeg | Codificacion, mezcla, normalizacion, chequeos | No sustituye la logica de escenas |

**Principio**: la IA decide QUE debe ocurrir; el motor determina COMO. El LLM no tiene libertad pixel
a pixel. Esto hace el sistema estable, testeable y reutilizable.

## Lenguaje audiovisual del canal
- El que habla tiene prioridad de escala y posicion; el que escucha aparece mas pequeno/atenuado.
- No mostrar a los cinco personajes a la vez salvo que el evento lo justifique (`crowd: true`).
- Un cambio de avatar coincide con un cambio semantico, una reaccion o un punchline (no cada palabra).
- Estructura base: hook (2-5 s) -> reaccion/meme (1-4 s) -> contexto -> interrupciones/storyline ->
  visuales al introducir cada concepto -> remate -> cierre con ultima reaccion.
- Duracion: `MIN=60_000`, `MAX=120_000`, `TARGET=85_000` ms (config/render.json).

## Definition of Done del MVP
Un usuario coloca un guion y assets en un proyecto, ejecuta **un comando**
(`npm run generate -- --project projects/<id>`) y recibe un MP4 vertical de 60-120 s con voces,
subtitulos por color, cambios de avatar, visuales, fondo y al menos un evento de humor; ademas quedan
`timeline.json`, `subtitles.srt` y `report.json`.

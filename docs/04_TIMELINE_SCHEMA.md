# 04 — Contrato `timeline.json`

`timeline.json` es el contrato entre la inteligencia narrativa (director) y el renderizador. Es JSON
puro (sin funciones), validado por **`schemas/timeline.schema.json`** (JSON Schema draft-07, ajv) y
por la validacion semantica de `src/validation/timeline.ts`.

## Ejemplo (el del plan, valido tal cual: `tests/fixtures/pdf-example.timeline.json`)
```json
{
  "meta": { "title": "China no destruyo a ChatGPT", "durationTargetSec": 85, "aspect": "9:16", "fps": 30 },
  "scenes": [
    { "id": "hook", "startMs": 0, "endMs": 4200, "character": "teto", "avatar": "sorprendida",
      "dialogue": "¿China destruyo a ChatGPT y Claude?", "visuals": ["chatgpt_logo", "claude_logo"],
      "events": ["subtitle_emphasis"] },
    { "id": "meme", "startMs": 4200, "endMs": 6500, "events": ["meme_explosion"] }
  ]
}
```

## `meta`
| Campo | Tipo | Notas |
|---|---|---|
| title | string | requerido |
| durationTargetSec | number | requerido (objetivo; el limite real es 60-120 s) |
| aspect | "9:16" | requerido |
| fps | 24/25/30/60 | requerido (config: 30) |
| language | "es" | idioma del guion / TTS / whisper |
| background | id de asset | background_video o background_image |
| timingSource | estimated / audio / manual | `audio` = reajustado con el audio real |
| audio | {master, durationMs} | pista maestra (ruta relativa al repo) |
| project, generator | string | trazabilidad |

## `scenes[]`
| Campo | Notas |
|---|---|
| id | `^[a-z0-9][a-z0-9_-]*$`, unico |
| section | hook, reaction, context, development, visual, punchline, closing |
| startMs, endMs | ms absolutos; sin solapes; contiguas en timelines generados |
| character, avatar | hablante + reaccion (canonica o alias) |
| dialogue | texto (max 600 caracteres por bloque = un audio TTS) |
| listeners | `[{character, avatar}]`; `[]` = nadie; ausente = listener automatico |
| crowd | permite superar el maximo de personajes en pantalla |
| visuals | ids mostrados durante toda la escena (max 3) |
| events | lista de eventos (objeto o forma corta) |
| audio | `{src, offsetMs, durationMs}` del bloque (informativo si hay master) |

## `captions[]` (opcional)
Palabras con tiempos absolutos: `{text, startMs, endMs, character, sceneId, confidence}`. Las genera
`build-timeline` (whisper + alineado). Si faltan, el render estima los tiempos desde `dialogue`.

## Eventos
Todos aceptan un ancla: `atMs` (relativo al inicio de la escena) o `atWord` (indice 0-based de palabra
del dialogo; `build-timeline` lo convierte a `atMs` con el audio real). Sin ancla = inicio de escena.

| Tipo | Parametros | Efecto |
|---|---|---|
| character_reaction | character, avatar | Cambia el avatar de un personaje en pantalla |
| visual_show | visual, durationMs?, slot? (auto/full/left/right/top/bottom) | Muestra un recurso (hasta su visual_hide o fin de escena) |
| visual_hide | visual | Retira un recurso antes del fin de la escena |
| camera_zoom | durationMs?, scale? (1-1.5) | Zoom suave para enfatizar (vuelve al cerrar la escena) |
| camera_shake | durationMs?, intensity? | Sacudida breve para meme o shock |
| meme_explosion | meme?, sfx?, durationMs? | Preset: flash + SFX + golpe de escala + imagen meme + sacudida |
| subtitle_emphasis | words?, color? | Resalta palabras (sin `words`: todo el dialogo desde el ancla) |
| pause | durationMs? | Micro-pausa comica: inserta silencio en el audio (antes de `atWord` o al final) |
| sfx | sfx, volume? | Efecto de sonido (extension del MVP) |

Formas cortas validas: `"camera_zoom"`, `"camera_shake"`, `"meme_explosion"`, `"subtitle_emphasis"`, `"pause"`.

## Regla de consistencia
El timeline debe poder renderizarse dos veces y producir el mismo resultado visual, salvo cambios
explicitos de assets o parametros. `npm run render -- --repro` lo verifica (fotogramas identicos);
`report.json > reproducibility` guarda hashes de timeline, plan e insumos.

## Cambiar el contrato
1. Editar `schemas/timeline.schema.json` y `src/timeline/types.ts` a la vez.
2. Actualizar `src/validation/timeline.ts`, `src/timeline/plan.ts` y el schema del director
   (`src/director/llm/director.ts`) si aplica.
3. Agregar/ajustar fixtures y tests. Registrar la decision en `docs/adr/`.

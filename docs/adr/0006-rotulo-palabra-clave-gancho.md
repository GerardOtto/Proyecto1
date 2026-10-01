# ADR 0006 — Rotulo de palabra clave en el gancho

- Estado: aceptado (2026-10-01). Especificacion: `docs/10_DISTRIBUCION.md` §8.

## Contexto
La busqueda de TikTok (y el OCR de Instagram) indexa lo que se dice y lo que aparece escrito en los
primeros ~3 s. El gancho arranca con el saludo pregrabado "¡Papu papu!" (`audio.greeting`) y la
palabra clave tarda ~1 s en oirse; ningun texto fijo mostraba el tema, asi que el primer fotograma
(miniatura/portada) no comunicaba de que trata el video.

## Decision
- **Contrato (QUE):** `meta.hookTitle` (1-60 caracteres; `*palabra*` resalta la palabra clave). En
  el guion: `hook_title:` / `titulo_gancho:` (`none` lo desactiva). El director LLM devuelve
  `hookTitle` ("" = sin rotulo); el del guion tiene prioridad.
- **Configuracion (COMO):** `render.json > titleCard` (posicion, tamano, colores, tiempos).
- **Compilador puro:** `src/timeline/titlecard.ts` interpreta el resaltado, ajusta la fuente para
  caber en `maxLines` (y en el ancho util) y calcula la caja centrada en la safe area. El plan crea
  `PlanTitleCard` desde el fotograma 0 hasta el fin de la escena `hook`, acotado a `[minMs, maxMs]`.
  Con `reserveVisualArea`, los visuales y el b-roll del gancho bajan a un area libre bajo el rotulo.
- **Render:** `TitleCard.tsx` fuera de la camara, encima de la marca de agua y debajo de los
  subtitulos; `SafeAreaGuide` dibuja su caja. `generate` exporta `cover.jpg` con el fotograma del
  gancho (portada para Reels/Shorts).
- **Validacion:** `HOOK_TITLE_MISSING` (warning, timeline final), `HOOK_TITLE_TOO_LONG`,
  `HOOK_TITLE_OUTSIDE_SAFE_AREA`, `HOOK_TITLE_OVERLAPS_CAPTIONS` (errores) y `HOOK_KEYWORD_LATE`
  (warning si ninguna palabra clave se dice antes de 3 s).
- `captionCenterX` se movio a `src/timeline/layout.ts` (sin dependencias) para evitar un import
  circular plan <-> titlecard; `plan.ts` lo reexporta.

## Consecuencias
- Los guiones sin `hook_title` no cambian (sin rotulo + warning en el timeline final).
- Los planes antiguos sin `titleCard` se siguen dibujando (`plan.titleCard ?? null`).
- El saludo "¡Papu papu!" se mantiene: el rotulo da la palabra clave escrita desde el fotograma 0.

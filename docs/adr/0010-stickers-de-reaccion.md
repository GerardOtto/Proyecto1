# ADR 0010 — Stickers de reaccion

- Estado: aceptado (2026-10-01).

## Contexto
El catalogo tiene 18 stickers (gatos, peras, nugget, mini Miku: `assets/memes/`, tag `sticker`) pero
la unica forma de mostrar un meme era `meme_explosion`: flash blanco, golpe de escala, sacudida y la
imagen centrada a 760 px, que tapa los subtitulos. Sirve para el beat de reaccion tras el gancho, no
para salpicar reacciones a lo largo del dialogo (con 4-6 por video seria agotador y se perderia texto).
El usuario pidio usar los stickers como parte de las reacciones durante todo el video.

## Decision
- Evento nuevo `sticker` en el contrato (`schemas/timeline.schema.json`, `types.ts`):
  `{ type, sticker, sfx?, volume?, character?, durationMs?, atMs|atWord }`. `sticker` = asset
  `meme`/`image`.
- El motor decide el COMO (`render.json > events.sticker`): caja cuadrada de `size` px en la **esquina
  inferior del area de visuales del lado del personaje** que reacciona (`character`; por defecto el que
  habla; sin personaje, al centro). Asi queda junto a su avatar, encima del relleno/visual, y nunca
  invade los subtitulos (y 950-1130) ni las caras (y > 1110).
- Animacion (`src/components/Stickers.tsx`): pop elastico, inclinacion determinista por semilla,
  balanceo leve y salida encogiendose; fuera de la camara (el zoom no lo empuja). Las fotos JPG llevan
  borde blanco de sticker; PNG/GIF transparentes, solo sombra. GIF via `@remotion/gif`.
- Sonido: el `sfx` del evento (p. ej. `sfx_oohh`) o el de config (`sfx_pop`); cuenta como SFX ya
  programado, asi que el pop automatico de visuales no se le encima.
- Un sticker nuevo en la misma esquina corta al anterior (`trimStickers`): nunca se apilan.
- Guion: `{STICKER:id}` con opcionales en cualquier orden: sfx, volumen 0-1 y personaje
  (`{STICKER:meme_gato_sorprendido:sfx_oohh:0.7}`, `{STICKER:meme_nugget:luka}`).
- Validacion: asset de tipo correcto, personaje existente y aviso `STICKER_CHARACTER_OFFSCREEN` si el
  personaje indicado no esta en pantalla.
- Director LLM y escritor del autopiloto: conocen el evento y la lista de stickers (2-5 por video).

## Consecuencias
- `meme_explosion` queda para el beat de reaccion fuerte; los stickers dan pulso al dialogo sin cortar
  el ritmo ni alargar el video (no ocupan tiempo de escena).
- El director de SFX y de stickers por reglas del autopiloto no coloca stickers solo (pendiente si hace
  falta); por ahora los pone el escritor (LLM o manual).

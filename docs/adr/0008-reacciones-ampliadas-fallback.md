# ADR 0008 — Reacciones ampliadas con fallback por reaccion

- Estado: aceptado (2026-10-01).

## Contexto
La taxonomia tenia 8 reacciones (neutral, feliz, sorprendido, confundido, enojado, riendo, nerd,
shocked). El set nuevo de avatares (tableros de Pinterest, ~200 imagenes para 7 personajes) trae
expresiones que no encajan en esas 8 sin forzarlas: gritando (ojos ><), decepcionado (-_-), triste,
timido/sonrojado, saludando, pensando, presumido, aburrido, nervioso y gags visuales (bigote, gato,
peluche...). Mapearlas como variantes de las 8 mezclaria emociones distintas en la rotacion de
variantes. Pero ampliar la taxonomia rompe un supuesto: hasta ahora todo personaje tenia imagen para
toda reaccion, y la validacion falla (`AVATAR_NOT_AVAILABLE`) si el director pide una que falta. Con
19 reacciones ningun personaje las tiene todas (Neru tiene 6).

## Decision
- **Taxonomia (QUE):** `config/reactions.json` pasa a 19 reacciones canonicas: las 8 de siempre +
  gritando, triste, decepcionado, emocionado, timido, saludando, pensando, presumido, aburrido,
  nervioso y broma. Los alias cubren los nombres de archivo del set (maldiciendo -> enojado,
  sonrojada -> timido, llorando -> triste, bigote/gato/peluche/chibi -> broma...).
- **Fallback por reaccion (contrato nuevo):** campo opcional `fallback` (otra reaccion canonica).
  `buildCatalog` resuelve, para cada personaje y cada reaccion sin imagen propia, la primera de su
  cadena de fallback que el personaje si tenga (con sus variantes). Resultado: `avatars` del catalogo
  resuelto contiene SIEMPRE todas las reacciones canonicas que la cadena alcanza, y validacion, plan,
  parser y director LLM no cambian. Cadenas acotadas y sin ciclos; errores `REACTION_FALLBACK_UNKNOWN`
  y `REACTION_FALLBACK_CYCLE`. `AVATAR_REACTION_UNDEFINED` solo avisa si ni la cadena resuelve.
- Cadenas: shocked -> gritando -> enojado -> neutral; sorprendido -> shocked; decepcionado -> triste ->
  confundido -> neutral; pensando/nervioso -> confundido; emocionado/timido/saludando/presumido/riendo
  -> feliz -> neutral; broma -> riendo; aburrido/nerd -> neutral.
- **Ingesta:** `avatars:ingest` acepta nombres `<Personaje>_<reaccion|alias>[_n]` (prefijo del
  personaje) y `--replace` (reemplaza el set completo del personaje).
- **Personajes nuevos:** kaito y neru en `characters.json` y en `casting.json`. El planificador ahora
  exige `voice.fish.referenceId` para considerar "listo" a un personaje (antes bastaba con declarar
  la ruta del saludo, lo que habria elegido a Rin/Len sin voz al dejar de ser placeholder).

## Consecuencias
- Guiones y timelines existentes siguen validos (las 8 reacciones y sus alias no cambian).
- El director puede pedir cualquier reaccion para cualquier personaje; si falta la imagen propia se
  ve la de su fallback (documentado en el prompt del director).
- `npm run catalog` lista las 19 reacciones por personaje (propias + resueltas por fallback).
- Agregar una reaccion: definirla con `use`, `aliases` y `fallback`; no requiere imagen en todos los
  personajes.

# ADR 0002 — El audio es la autoridad temporal

- Estado: aceptado (2026-10-01)

## Decision
El director produce un borrador con tiempos estimados (~2.6 palabras/s). Tras generar las voces
(un archivo por bloque) y transcribirlas, `build-timeline` recalcula todos los tiempos: duracion de
escena = audio + pausas, escenas contiguas, gaps/cola ajustables para cumplir 60-120 s, `atWord` ->
`atMs` con los tiempos reales. Las palabras de los subtitulos son las del guion (no las de Whisper),
alineadas con Needleman-Wunsch.

## Consecuencias
- Cambiar la voz o la velocidad no rompe la sincronizacion.
- Si el audio real excede los limites, el error indica la accion (`extend`/`compress`); con el
  director LLM, `generate` hace una segunda ronda automatica.

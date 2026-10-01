# ADR 0007 — Autopiloto de produccion

- Estado: aceptado (2026-10-01)

## Contexto
El motor ya convierte un guion etiquetado en un video validado. Faltaba automatizar el resto de la
produccion: elegir el tema (noticias de IA/informatica o temas evergreen), escribir el guion con el
formato de la casa, rotar personajes y colores, colocar SFX segun la situacion y preparar la
publicacion.

## Decision
- Nuevo modulo `src/autopilot/` que **produce guiones**, no timelines: el guion etiquetado sigue siendo
  la interfaz humana y la entrada del pipeline existente (ADR 0001). Asi todo lo generado es revisable
  y editable antes de gastar en voces/render.
- **Determinismo**: el plan (tema, formato, casting, tema visual) se deriva de una semilla
  (fecha + historial + tema). Mismas entradas => mismo episodio.
- **Dos escritores**: plantilla (offline, evergreen) y LLM (noticias), ambos validados por el parser,
  el validador del motor y un lint editorial. El LLM va por `LLMProvider` (ADR 0003).
- **SFX por tags**, no por ids, para que el catalogo crezca sin tocar reglas.
- **Graficos propios** (HTML -> PNG, licencia owned) en lugar de capturas automaticas.
- **Historial** (`projects/_autopilot/history.json`) para no repetir temas, parejas ni paletas.
- **Revision humana** por defecto (`needs_review`); `--produce` es explicito.

## Consecuencias
- Los colores de subtitulos por personaje no cambian (identidad); la variacion de color se hace con
  fondos, tarjetas y acentos por tema visual.
- La calidad del contenido evergreen depende del banco (`evergreen.json`), cubierto por tests.
- Las noticias requieren clave de LLM y verificacion de hechos antes de publicar.

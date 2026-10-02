# ADR 0014 — Fondo de paleta de personajes (aesthetic / kawaii-core), sin fotos

- Estado: aceptado (2026-10-02). Reemplaza el uso de fondos foto (ADR 0013, v3) y deja los escenarios de
  ADR 0012 como contexto narrativo (ya no son el fondo por defecto).

## Contexto
- Al usuario le gustaron los fondos de los primeros videos (China: `bg_tech_loop`; OpenAI Astra:
  `bg_theme_ocean`). Son degradados oscuros con cuadrícula y una franja de luz, y combinan con gráficos
  y tablas porque las tarjetas del autopiloto usan la misma paleta del tema.
- Pidió que los temas de análisis (muchos gráficos y tablas) prefieran ese estilo, y que los videos
  suaves o de humor tengan fondos más dinámicos o desenfocados, para no sobrecargar la imagen.
- Luego precisó el estilo:
  - el color del fondo armoniza con los personajes del video;
  - cambia suave y dinámicamente entre sus paletas;
  - armoniza con los cuadros, gráficos y recuadros;
  - tiene un toque aesthetic y kawaii-core;
  - se eliminan por completo las fotos de fondo.

## Decisión
- **Paleta por personaje** (`characters.json > palette`: profundo, medio, claro; si falta, se deriva
  de `subtitleColor`). Los amarillos (Rin, Len, Neru) llevan un profundo ciruela o índigo: oscurecidos
  contra azul se veían oliva.
- **`background: palette`** (palabra clave; en el guion o en `project.json`). El plan arma un segmento
  de paleta por cada cambio de hablante (el beat mudo de Neru incluido; memes y pausas mantienen la
  anterior). El componente `PaletteBackground` dibuja, en función del frame (determinista):
  - un degradado diagonal oscuro (profundo arriba; medio mezclado con el profundo abajo);
  - brillos de color que se desplazan en círculos lentos;
  - la franja de luz y la cuadrícula de los fondos de tema originales;
  - partículas kawaii (✦ ✧ ★ ♡ ♥ ⋆) que suben flotando, con destello y posición fija por semilla.

  La transición entre paletas dura ~0,8-1 s, con aceleración y frenado suaves.
- **Estilo** (`background_style:` en el guion = `meta.backgroundStyle`; `render.json > background.styles`):

  | Estilo | Cuándo | Aspecto |
  |---|---|---|
  | `analitico` | Noticias y formatos de datos (`news_explainer`, `myth_vs_fact`) | Más oscuro, cuadrícula marcada, 6 partículas, transición de 1 s. Ambientado en el "estudio" del canal |
  | `suave` | Conceptos e historias (`concept_lesson`, `controversy_story`) | Más brillo, 16 partículas desenfocadas (bokeh) |

  Lo decide el planificador: `formats.json > backgroundStyle`, las noticias siempre `analitico`, y un
  tema evergreen puede forzarlo con `backgroundStyle`.
- **Recuadros en armonía:** el marco de los clips de b-roll toma el tono claro de quien habla, con un
  brillo del medio; los visuales (gráficos y logos) reciben un resplandor del tono medio. Los gráficos
  generados del episodio usan `castTheme`: tarjetas oscuras teñidas con el host, acento y borde en su
  tono claro.
- **Sin fotos de fondo:** se retiran `bg_foto_*` del catálogo y del disco. Los escenarios vuelven a sus
  ilustraciones (`bg_place_*`), disponibles solo si un guion las pide explícitamente.
- Fondos de asset (video o imagen) con estilo `suave` admiten desenfoque y movimiento lento (`blurPx`,
  `motion`) por compatibilidad. El autopiloto ya no los usa.

## Consecuencias
- Cada video tiene una identidad de color propia de su elenco, coherente entre el fondo, los marcos y
  los gráficos.
- Los subtítulos (color por personaje) y las tarjetas blancas siguen legibles: el fondo se oscurece
  según `darken`.
- Los gráficos globales (`assets/visuals/*`, en azul marino) no cambian de color, pero llevan el
  resplandor del personaje.

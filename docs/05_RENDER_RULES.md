# 05 — Reglas de render

Configuracion: `config/render.json`. Composicion: `src/compositions/ShortVideo.tsx` (id `ShortVideo`).
Los componentes solo leen el **RenderPlan** (`src/timeline/plan.ts`), que traduce el timeline a frames,
rutas resueltas, lados, escalas y paginas de subtitulos. Defecto visual => corregir el componente o
el compilador, nunca hackear el timeline.

## Formato
1080x1920, 9:16, 30 fps, H.264 (crf 20, yuv420p, bt709), AAC 192k. Pista de audio siempre presente.

## Capas (de abajo a arriba)
1. **Background**: video en loop (`<Loop>` + `<OffthreadVideo muted>`), imagen o color; oscurecido
   `background.dim` (0.35).
2. **Camera** (zoom/shake/golpe de meme) envuelve:
   - **Visuals**: area `layout.visualArea` (x 90, y 260, 850x640). 1 visual = area completa; 2-3 =
     columnas; slots explicitos left/right/top/bottom/full. Pop-in 250 ms, pop-out 200 ms.
   - **Stage**: personajes anclados abajo (ver 02_CHARACTER_RULES.md).
3. **Captions** (fuera de la camara: nunca salen de la safe area).
4. **MemeLayer**: imagen meme con pop/rotacion + flash blanco (180 ms).
5. **SafeAreaGuide** (solo con `--safe-area`).
6. **Audio**: pista maestra + clips por escena (si no hay master) + SFX.

## Safe area (UI de TikTok/Reels)
top 220, bottom 420, left 60, right 140 px. Los subtitulos se centran en la safe area horizontal
(x = 500) y verticalmente en `captions.centerY` (1040). El validador comprueba que la caja de texto
(incluido el nombre del personaje) quede dentro y que `visualArea` tambien.

## Subtitulos
- Montserrat 900 (assets/fonts, OFL), 78 px, contorno oscuro de 12 px, max 2 lineas, ancho 860 px.
- Color del texto = `subtitleColor` del personaje; la palabra activa se pinta en blanco y sube 4 px;
  las palabras con `subtitle_emphasis` se pintan en amarillo `#FFE14D` (o `color`) al 118%.
- Paginado (determinista): nunca mezcla personajes ni escenas; max 6 palabras; corta tras puntuacion
  final, tras silencios > 900 ms o si no cabe en 2 lineas. Cada pagina dura hasta la siguiente
  (max +400 ms tras la ultima palabra).
- Si una palabra no cabe, la fuente se reduce; por debajo de 70% es hard fail.
- `subtitles.srt` usa el mismo paginado.

## Determinismo
- Sin `Math.random()` ni fechas en componentes: `random(seed)` de Remotion con semillas
  `<escena>-<evento>-<frame>`.
- Fuentes locales (no Google Fonts en runtime). Assets copiados por hash-link a `.cache/public/<id>`.

## Rendimiento
Referencia (contenedor de 4 vCPU, chromium headless): ~7 fps de render => un video de 75 s tarda ~5 min.
`renderMedia` usa `concurrency = nCPU (max 8)`. Para iterar rapido: `npm run studio` o
`npm run smoke -- --stills`.

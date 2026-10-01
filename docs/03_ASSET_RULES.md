# 03 — Reglas de assets

Cada asset va acompanado de metadatos en un **catalogo estructurado**. El agente/LLM consulta el
catalogo (IDs + tipo + tags); nunca escanea imagenes para adivinar su significado ni inventa rutas.

## Estructura
```
assets/characters/<id>/<reaccion>.png   avatares (transparencia recomendada, ~600x900 o mayor)
assets/backgrounds/                     videos MP4 en loop (1080x1920) o imagenes de fondo
assets/visuals/                         imagenes y diagramas
assets/logos/                           logos
assets/memes/                           imagenes para meme_explosion
assets/sfx/                             efectos de sonido WAV/MP3
assets/music/                           musica de fondo (NO versionada; ver assets/music/README.md)
assets/fonts/                           Montserrat 800/900 (OFL) para subtitulos
config/assets.json                      catalogo global
config/assets.local.json                catalogo local no versionado (musica con copyright)
```

## Entrada de catalogo (`schemas/assets.schema.json`)
```json
{
  "id": "deepseek_logo",
  "type": "logo",
  "path": "assets/logos/deepseek_logo.png",
  "tags": ["ia", "empresa", "logo"],
  "safeArea": true,
  "source": "https://...",
  "license": "descripcion de la licencia",
  "license_status": "documented"
}
```
- `type`: image | logo | diagram | meme | background_video | background_image | sfx | music | broll.
- `startMs` (solo music): salta la intro o el silencio inicial del tema. La mezcla (loop, nivel,
  ducking bajo la voz, fades) esta en `config/render.json > audio.music` (ADR 0004).
- `license_status`: `documented` (verificada) | `owned` (propia) | `placeholder` (generada para
  pruebas) | `unknown` (sin verificar).
- **Regla**: toda imagen externa registra al menos `source` y `license_status`. Si es `unknown`, se
  puede usar en un render de prueba local pero queda **bloqueada para publicacion comercial**
  (`report.json > licenses.commercialUse = "blocked"`).

## Validacion del catalogo (`npm run catalog`)
Hard fail: ID duplicado, archivo inexistente, archivo vacio, imagen ilegible (sin dimensiones),
extension incompatible con el tipo, reaccion no canonica en `characters.json`, alias en colision,
video/sfx que ffprobe no puede leer. Warning: licencia unknown, reaccion sin imagen.

Si `x.png` no existe pero si `x.jpg|jpeg|webp|svg|gif`, se usa ese archivo con warning
(`AVATAR_EXT_FALLBACK`): permite reemplazar placeholders por JPG sin tocar la config.

## Assets del proyecto
- `projects/<id>/project.json > assets[]`: entradas con `path` relativo a la carpeta del proyecto.
- `projects/<id>/visuals/*.png|jpg|...`: se registran solos con `id` = nombre normalizado
  (`Mi Grafico.png` -> `mi_grafico`) y `license_status: unknown` si no se declaran.
- `projects/<id>/background.mp4` (o .png/.jpg): se registra como `project_background`.
- Un asset del proyecto con el mismo ID que uno global lo reemplaza (warning).

## Graficos propios (`npm run graphics`)
Logos, titulares y graficos se disenan en HTML/CSS en `assets/visuals/src/*.html` (estilo comun en
`style.css`, fuente Montserrat del repo). Cada HTML declara su salida y tamano con
`<meta name="output" content="assets/..png" data-width=".." data-height="..">`; `npm run graphics`
los renderiza a PNG transparente con el Chrome Headless Shell de Remotion. Los graficos con datos
llevan la fuente visible y en `notes` del catalogo. Los simbolos de marcas vienen de Wikimedia
Commons (`assets/visuals/src/logos/`, licencia registrada en el catalogo).

## B-roll (`assets/broll/`, ADR 0005)
Clips de video (o GIF) sin audio que rellenan el area de visuales cuando no hay visual ni meme:
informatica, IA, gatitos. Preparacion: recorte a 4:3 (852x640), H.264 con `-g 30 -bf 0`, sin audio,
<= 12 s. Registrar `source` (pagina de Wikimedia Commons u origen), autor y licencia; solo CC0,
dominio publico o licencias que permitan el uso.

## Memes animados (GIF)
Un meme puede ser `.gif`: se reproduce con `@remotion/gif` sincronizado con el video. Para quitar un
fondo blanco y empezar en el cuadro del estallido:
`python scripts/remove-bg.py --gif <original.gif> assets/memes/<id>.gif <cuadro_inicial>`.

## Placeholders
`npm run assets:placeholders` genera de forma determinista avatares (SVG -> PNG con librsvg de
ffmpeg), logos de texto, diagramas, memes, un fondo animado de 10 s y SFX sinteticos. Son solo para
desarrollo: reemplazarlos por material con licencia verificada (ver `09_LICENSING.md`).
`--force` nunca sobrescribe un asset cuyo `license_status` ya no es `placeholder`.

# 11 — Autopiloto: produccion automatica de episodios

`npm run autopilot` automatiza todo lo desarrollado hasta ahora para producir videos con el **mismo
formato** (saludo "¡Papu papu!", gancho con palabra clave, meme, explicacion por turnos, remate,
CTA), variando personajes, colores y efectos de sonido, a partir de **noticias de IA e informatica**
o, si no hay, de un **banco de temas evergreen** (conceptos de Computer Science, IA, programacion,
polemicas e historia). Decision de arquitectura: [ADR 0007](adr/0007-autopiloto.md).

> **Revision humana obligatoria.** El autopiloto deja cada episodio en `needs_review`: revisa
> hechos, tono y chistes en `script.md` antes de producir y publicar.

## Flujo
```
1. Fuentes      config/autopilot/sources.json -> RSS/Atom -> puntuacion (nicho+frescura) -> agrupado
                (si no hay noticias nuevas o no hay escritor LLM: config/autopilot/evergreen.json)
2. Plan         tema + formato (formats.json) + casting por roles (casting.json) + tema visual (themes.json)
                determinista; evita repetir tema, pareja y paleta (projects/_autopilot/history.json)
3. Graficos     HTML -> PNG con la paleta del tema (stat, keypoints, code, versus, headline) -> visuals/
4. Guion        escritor de plantilla (offline, evergreen) o escritor LLM (noticias, o --writer llm)
5. SFX          director de SFX por reglas (sfx-rules.json): reaccion/seccion/personaje -> tags del catalogo
6. Lint         formato de la casa: saludo, palabra clave, meme, turnos, CTA, duracion, fuentes
7. Validacion   npm run analyze del motor (schema, narrativa, rotulo, safe area, licencias)
8. Publicacion  output/<id>/publish/: tiktok.txt, instagram.txt, youtube.txt, comentario fijado,
                schedule.json (siguiente franja, hora CDMX), checklist.md
9. Produccion   --produce: voces -> transcripcion -> reajuste -> render -> QA (npm run generate)
```
Despues del guion: prototipo de revision (`npm run generate -- --project projects/<id> --tts espeak
--preview`, ADR 0013), planilla de produccion que coordina varios episodios (`npm run planilla`) y
subida a las tres plataformas (`npm run upload`). Ver [12_PUBLICACION.md](12_PUBLICACION.md).

## Comandos
| Comando | Que hace |
|---|---|
| `npm run autopilot` | Planifica y escribe 1 episodio (noticia si hay y hay LLM; si no, evergreen) |
| `npm run autopilot -- --batch 3` | 3 episodios (como mucho 1 noticia; el resto evergreen) |
| `npm run autopilot -- --mode evergreen --topic big_o` | Fuerza un tema del banco |
| `npm run autopilot -- --mode evergreen --category controversy` | Solo una categoria |
| `npm run autopilot -- --writer llm` | Escritor LLM tambien para evergreen (mas variedad) |
| `npm run autopilot -- --produce [--tts fish]` | Escribe y produce sin pausa de revision |
| `npm run autopilot -- --episode <id> --produce` | Produce un episodio ya revisado |
| `npm run autopilot -- --check-feeds` | Prueba cada feed y muestra las historias mejor puntuadas |
| `npm run autopilot -- --make-backgrounds` | Genera los fondos en loop de cada tema visual |
| `npm run autopilot -- --list-topics [--category x]` | Banco evergreen y ultimo uso |
| `npm run autopilot -- --brief <brief.json> --writer manual [--format x]` | Noticia investigada a mano: plan, graficos, `writer-brief.md` y kit; `script.md` queda como esqueleto para escribirlo (p. ej. en Claude Code, sin costo de API) |
| `npm run compare-writers -- --episodes a,b,c [--variants opus-5-5:high,sonnet-5-5:medium] --yes` | Compara variantes del escritor LLM con el guion actual de cada episodio (costo, tiempo, intentos, lint) |
| `npm run avatars:ingest -- --character rin --from <carpeta>` | Renders -> avatares sin fondo + characters.json |

Opciones: `--date YYYY-MM-DD`, `--offline` (no lee feeds), `--allow-placeholder` (permite
personajes con avatares placeholder), `--no-graphics`, `--allow-missing-audio`.

## Configuracion (`config/autopilot/`)
| Archivo | Contenido |
|---|---|
| `sources.json` | Feeds (url, idioma, peso), palabras clave del nicho con peso, lista de bloqueo, umbral y vida media de frescura. **Verificar URLs con `--check-feeds`.** |
| `evergreen.json` | 29 temas con puntos (4-6), preguntas del foil, remate, idea final, visual y fuentes. Schema: `schemas/evergreen.schema.json`. |
| `formats.json` | Formatos (news_explainer, concept_lesson, controversy_story, myth_vs_fact), estructura y duracion objetivo. |
| `casting.json` | Personajes por rol (host / foil / guest), personalidades para el LLM, probabilidad de invitado y `cameo` mudo (Neru, ADR 0011). |
| `lore.json` | Contexto de cada personaje, dinamicas compartidas, memes de la comunidad (Teto pera, Mesmerizer, Rabbit Hole, Gumi...) y afinidades personaje-tema (ADR 0011/0012). |
| `settings.json` | Escenarios (playa, cafeteria, oficina, parque, aula, habitacion, servidores, konbini, estudio): fondo + tags + conciencia del lugar (ADR 0012). |
| `arcs.json` | Narrativas secundarias por etapas (Neru consigue su voz; final solo por decision humana tras 10+ videos). |
| `themes.json` | Temas visuales: fondo, gradiente, colores de tarjetas y acento; temas por categoria. Los colores de subtitulos de cada personaje NO cambian (identidad). |
| `sfx-rules.json` | Reglas del director de SFX (por tags del catalogo, maximo por video, separacion). |
| `humor.json` | Saludo, memes, preguntas/reacciones/malentendidos del foil, remates genericos, CTA. |

## Agregar contenido
- **Tema evergreen**: añade una entrada a `evergreen.json` (puntos verificables + fuentes). `npm test`
  comprueba que cada tema genera un guion valido de 62-115 s y que el rotulo cabe.
- **Personaje nuevo**: `npm run avatars:ingest -- --character kaito --from <renders> --color "#3D7BFF"`,
  completa `voice.fish.referenceId`, el saludo `assets/voice/<id>/papu_papu.mp3`, y agregalo a los
  roles de `casting.json`. Un personaje solo se elige si sus avatares no son placeholder y tiene voz.
- **SFX nuevo**: registralo en `config/assets.json` con tags (p. ej. `["sfx","risa"]`); el director de
  SFX lo usa solo si alguna regla pide ese tag.
- **Tema visual**: añade una entrada a `themes.json` y ejecuta `--make-backgrounds`.

## Escritores
- **Plantilla** (por defecto para evergreen): sin red ni costo, determinista. Intercala host/foil,
  coloca cada pregunta del tema despues del dato relacionado, usa el remate del tema y rellena con
  malentendido + correccion si queda corto.
- **LLM** (necesario para noticias): `src/autopilot/llm-writer.ts` usa `LLMProvider` (Anthropic por
  defecto, `DIRECTOR_MODEL` y `DIRECTOR_EFFORT`, por defecto `claude-opus-5-5` / `high`). Recibe el
  formato del guion, el ejemplo `demo_001`, el catalogo, el casting y el brief (solo hechos de los
  articulos). Se valida con el parser, el validador y el lint; reintenta hasta 3 veces con los errores.
  Devuelve `factClaims` para revisar. El system prompt se cachea (abarata reintentos y lotes).
- **Manual** (`--writer manual`): para noticias calientes investigadas fuera del RSS. El brief va en
  `projects/_autopilot/briefs/*.json` (forma de `TopicBrief`: `points`, `articles` con los hechos,
  `sources`, `visual`); `--format` fuerza el formato. Genera `writer-brief.md` (la misma entrada que
  recibe el escritor LLM) y un `script.md` esqueleto.

## Visuales de noticia (ADR 0009)
Por cada articulo de una noticia, el autopiloto genera relleno contextual (`broll` del proyecto):
- `news_cap_<n>`: **captura real** del titular + bajada (sin fotos del medio), en un marco de navegador
  con el dominio real y el pie "Captura de <medio> · <fecha>". Licencia `unknown`. Si el sitio bloquea
  o el titular no coincide (>= 60 % de palabras), se omite.
- `news_card_<n>`: **tarjeta propia** con el titular textual entre comillas, el medio, la fecha y la
  traduccion (`titleEs`) si no esta en espanol. Estilos: navegador, celular, periodico, post del canal,
  ultima hora; se eligen evitando los usados en los ultimos 7 dias. Nunca imitan el sitio del medio.
En el brief, cada articulo puede llevar `outlet` (nombre para mostrar) y `titleEs`. El titular debe ser
el real de la pagina. El escritor recibe la lista y usa `[BROLL: id]` en la linea que cita la fuente.
Regenerar en un episodio existente: `npm run autopilot -- --episode <id> --refresh-visuals [--brief x]`.

## Carpeta de revision (`npm run review`)
Version simple de cada episodio fuera del repo (`REVIEW_DIR` en `.env`, p. ej. el escritorio), para
revisar guiones y hacer control de calidad de imagenes y audios sin abrir el proyecto. El autopiloto la
actualiza al escribir o producir; tras editar un `script.md` a mano, correr `npm run review`.
- `<fecha> <titulo>/Guion.txt`: dialogo limpio (sin etiquetas), quien habla y con que emocion, imagen o
  relleno en pantalla y estado del audio de cada linea (nombre de archivo esperado en `audio/input/`).
- `Imagenes/`, `Personajes/` (avatares usados), `Audios/` (grabados) y `Video final.mp4` si existe.
- `Notas.txt` nunca se sobrescribe; el resto se regenera (no se lee de vuelta: la fuente es `script.md`).
- `Resumen.txt` en la raiz: estado, audios grabados y duracion de todos los episodios.

## Elegir modelo y esfuerzo
`npm run compare-writers` corre el escritor LLM con varias variantes sobre los mismos planes y deja
`projects/<ep>/compare/<variante>.script.md` y `projects/_autopilot/compare-<fecha>.md` (tabla con
costo, tiempo, intentos, duracion estimada y avisos de lint; el guion actual del episodio aparece como
`manual`). Leer los guiones lado a lado antes de mirar el costo; fijar el ganador en `.env`
(`DIRECTOR_MODEL`, `DIRECTOR_EFFORT`). Precios en `src/autopilot/compare.ts` (verificar).

## Limitaciones conocidas
- Las URLs de feeds no se pudieron probar en el entorno de desarrollo (sin salida de red).
- Las noticias en ingles se resumen en espanol solo con el escritor LLM.
- Algunos medios bloquean la captura (muro de pago, bot) o cambian el titular: queda solo la tarjeta
  propia. Revisar cada captura en la carpeta de revision antes de publicar.
- La voz depende del proveedor configurado (`--tts`); el saludo pregrabado debe existir por personaje.

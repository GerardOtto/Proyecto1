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
| `npm run avatars:ingest -- --character rin --from <carpeta>` | Renders -> avatares sin fondo + characters.json |

Opciones: `--date YYYY-MM-DD`, `--offline` (no lee feeds), `--allow-placeholder` (permite
personajes con avatares placeholder), `--no-graphics`, `--allow-missing-audio`.

## Configuracion (`config/autopilot/`)
| Archivo | Contenido |
|---|---|
| `sources.json` | Feeds (url, idioma, peso), palabras clave del nicho con peso, lista de bloqueo, umbral y vida media de frescura. **Verificar URLs con `--check-feeds`.** |
| `evergreen.json` | 29 temas con puntos (4-6), preguntas del foil, remate, idea final, visual y fuentes. Schema: `schemas/evergreen.schema.json`. |
| `formats.json` | Formatos (news_explainer, concept_lesson, controversy_story, myth_vs_fact), estructura y duracion objetivo. |
| `casting.json` | Personajes por rol (host / foil / guest), personalidades para el LLM, probabilidad de invitado. |
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
  defecto, `DIRECTOR_MODEL`). Recibe el formato del guion, el ejemplo `demo_001`, el catalogo, el
  casting y el brief (solo hechos de los articulos). Se valida con el parser, el validador y el lint;
  reintenta hasta 3 veces con los errores. Devuelve `factClaims` para revisar.

## Limitaciones conocidas
- Las URLs de feeds no se pudieron probar en el entorno de desarrollo (sin salida de red).
- Las noticias en ingles se resumen en espanol solo con el escritor LLM.
- Los graficos de noticias son tarjetas de titular propias; no hay capturas automaticas de articulos
  (riesgo de derechos de autor). Las capturas siguen siendo manuales (`[BROLL: ...]`).
- La voz depende del proveedor configurado (`--tts`); el saludo pregrabado debe existir por personaje.

# 06 — Formato del guion (`projects/<id>/script.md`)

El director `rules` parsea este formato de forma determinista. El director `anthropic` acepta tambien
guiones libres (texto sin etiquetas) y los estructura el LLM.

```markdown
---
title: ¿China destruyó a ChatGPT?
target: 85                 # duracion objetivo en segundos
background: bg_tech_loop   # id de asset (opcional; si no, project.json o background.* del proyecto)
music: dkc_bonus_room_blitz  # id de asset music (opcional; si no, project.json; "none" = sin musica)
broll: broll_typing, broll_kittens  # clips de relleno en orden (opcional; si no, todos; "none" = sin relleno)
language: es
---

## hook
[TETO:sorprendida]
[VISUAL: chatgpt_logo, claude_logo]
¿China *destruyó* a ChatGPT y Claude?

## reaction
[MEME:meme_boom:sfx_boom]

## development
[MIKU:confundida]
[LISTEN: teto:neutral]
Espera. ¿Entonces ChatGPT ya no sirve? {REACT:teto:enojada}¿Tengo que borrar todo?
```

## Bloques
- `[PERSONAJE:reaccion]` en una linea abre un bloque de dialogo (personaje = id de characters.json, sin
  importar mayusculas; reaccion = canonica o alias; sin reaccion = neutral).
- Las lineas de texto siguientes se unen en un solo dialogo = **un archivo de audio TTS**.
- Una linea en blanco cierra el bloque. Un parrafo de texto sin etiqueta abre un **nuevo bloque del
  mismo personaje** (warning).
- `#` titulo (si no hay `title` en front matter). `## seccion` asigna la seccion a los bloques
  siguientes: hook/gancho, reaction/reaccion/meme, context/contexto, development/desarrollo,
  visual, punchline/remate/giro, closing/cierre. Sin secciones, se infieren (primer bloque = hook,
  ultimo = cierre, memes = reaction, segundo = context, penultimo con risa/shock = punchline).
- Comentarios: `<!-- ... -->` o lineas que empiezan con `//`.

## Directivas de bloque (linea propia, dentro del bloque)
| Directiva | Efecto |
|---|---|
| `[VISUAL: a, b]` | visuales durante toda la escena |
| `[SHOW:id]` / `[HIDE:id]` | visual_show / visual_hide anclado a la posicion |
| `[LISTEN: miku:neutral, rin]` / `[LISTEN:none]` | listeners de la escena |
| `[REACT:miku:shocked]` | character_reaction |
| `[ZOOM]` `[ZOOM:1.2]` `[SHAKE]` | camara |
| `[EMPHASIS: palabra, otra]` | subtitle_emphasis |
| `[SFX:sfx_ding]` | efecto de sonido |
| `[MEME]` `[MEME:meme_question]` `[MEME:meme:sfx]` `[SFX:meme_explosion]` | meme dentro del bloque |
| `[PAUSE:600]` | micro-pausa (inserta silencio en el audio) |
| `[SECTION:punchline]` | seccion de este bloque |
| `[CROWD]` | permite mas de 3 personajes en pantalla |

La posicion importa: una directiva antes del texto se ancla a la primera palabra; despues del texto,
a la ultima (excepto `[VISUAL]`, que cubre la escena, y `[PAUSE]` al final, que va tras el bloque).

## Parrafos sueltos (entre lineas en blanco, fuera de un bloque)
- `[MEME...]` o `[SFX:meme_explosion]` -> **escena meme** sin dialogo (seccion reaction, 1.3 s; la explosion dura 1.7 s y se solapa con el inicio del siguiente dialogo).
- `[PAUSE:800]` -> escena de pausa.
- Otras directivas (`[VISUAL]`, `[LISTEN]`, `[SFX:id]`, `[ZOOM]`...) se aplican al **siguiente** bloque.

## Tags inline (dentro del texto)
`{REACT:miku:shocked}`, `{SHOW:id}`, `{HIDE:id}`, `{ZOOM}`, `{SHAKE}`, `{MEME}`, `{SFX:id}`,
`{PAUSE:500}`, `{EMPH}` se anclan a la palabra siguiente (`atWord`). `{SFX:id:0.5}` acepta un
volumen opcional (0-1). Al aparecer cada visual o captura suena un "pop" automatico
(`render.json > events.visual.sfx`), asi que no hace falta marcarlo a mano. Tras `build-timeline` se
convierten en milisegundos exactos segun el audio real.

`*palabra*` marca la palabra para `subtitle_emphasis` (los asteriscos no se leen en el TTS).

## Relleno contextual (`[BROLL: a, b]`)
Directiva de bloque: los huecos del area de visuales durante ESE bloque se rellenan con estos assets
`broll` (capturas de noticias/paginas oficiales, graficos, GIFs), repartidos a partes iguales y en
orden. Tiene prioridad sobre el `broll:` del front matter, que queda como pozo de respaldo. Para dar
paso al relleno a mitad de bloque, oculta los visuales con `{HIDE:id}` en la palabra adecuada.

## Rotulo del gancho (`hook_title:`)
En el front matter: `hook_title: ¿*DeepSeek* destruyó a *ChatGPT*?` (o `titulo_gancho:`; `none` lo
desactiva). Texto fijo desde el fotograma 0 hasta el fin del gancho, para la busqueda de TikTok e
Instagram. Resalta con `*...*` la palabra clave y procura que al menos una se DIGA en los primeros
3 s (si no, warning `HOOK_KEYWORD_LATE`). ADR 0006.

## Saludo recurrente
Una linea que empieza con `¡Papu papu!` (texto en `render.json > audio.greeting.text`) usa el audio
reutilizable del personaje (`assets/voice/<id>/papu_papu.mp3`) para el saludo; el archivo del bloque
(`audio/input/<bloque>.mp3`) debe contener **solo el resto** de la frase. Ver `assets/voice/README.md`.

## Errores
El parser reporta errores con numero de linea (reaccion/asset/personaje desconocido, etiqueta
desconocida, bloque vacio). `npm run analyze` falla si hay errores.

## Presupuesto de duracion
~2.6 palabras/s (config `timing.estimatedWordsPerSecond`): 60 s ≈ 150 palabras, 85 s ≈ 200,
120 s ≈ 290 (incluyendo pausas/memes). La duracion definitiva la determina el audio.

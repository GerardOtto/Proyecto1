# 02 — Reglas de personajes

Fuente de verdad: `config/characters.json` (identidad) y `config/reactions.json` (taxonomia).
Ningun guion ni timeline puede cambiar color, escala o anclaje de un personaje.

## Personajes
| ID | Nombre | Color de subtitulo | Uso del color |
|---|---|---|---|
| teto | Teto | `#E58FB5` | rosa |
| miku | Miku | `#39C5BB` | turquesa |
| luka | Luka | `#E285B2` | rosa/magenta |
| rin | Rin | `#F6C744` | amarillo |
| len | Len | `#F2B544` | amarillo/naranja |

Los colores son una propuesta de implementacion, no colores oficiales. Ajustarlos al material real.
Nota: luka/teto y rin/len tienen colores cercanos; el nombre del personaje se muestra sobre cada
pagina de subtitulos para desambiguar.

Campos por personaje: `displayName`, `subtitleColor`, `defaultScale` (alto del avatar = escala x 1920),
`anchor` (lado preferido), `avatarDir`, `reactions` (reaccion canonica -> archivo), `voice`
(`fish.referenceId`, `speed`; `flite.voice` para desarrollo) y `license`.

## Audiencia y cierre (voz de la cuenta)
- La audiencia son **"los Papus"** / **"el Papu"**. Cuando un personaje le habla directamente a quien
  mira, abre con **"¡Papu papu!"**. Entre personajes se hablan normal.
- Cierre de cada video: invitacion breve a dar **Me gusta** y a **seguir** la cuenta, apta para
  YouTube, TikTok e Instagram (sin "suscribete", "campanita", "link en la bio"...), con el visual
  `cta_follow_like`. Recogido tambien en `prompts/director.system.md`.

## Reacciones (8 estados)
| Canonica | Uso narrativo | Prioridad | Alias aceptados (ejemplos) | Archivo (fem./masc.) |
|---|---|---|---|---|
| neutral | explicacion normal / escucha | alta | normal, listening | neutral.png |
| feliz | aprobacion / remate ligero | alta | happy, contento/a | feliz.png |
| sorprendido | hook / dato inesperado | alta | sorprendida, surprised | sorprendida.png / sorprendido.png |
| confundido | pregunta / malentendido | alta | confundida, confused | confundida.png / confundido.png |
| enojado | correccion / frustracion comica | media | enojada, angry | enojada.png / enojado.png |
| riendo | remate / reaccion | media | laughing, risa | riendo.png |
| nerd | explicacion tecnica / conclusion | media | serio_nerd, serio/a | nerd.png |
| shocked | giro exagerado / meme | media | shock, impactado/a | shocked.png |

- En guiones y timelines se acepta cualquier alias; el motor los resuelve a la forma canonica.
- Nombres de archivo estandarizados; evitar variantes ambiguas (`sorpresa2.jpg`, `surprised_final.png`).
- Para agregar una reaccion: agregarla en `config/reactions.json`, mapear el archivo en cada personaje
  de `config/characters.json`, ejecutar `npm run catalog`. No cambia la arquitectura.

## Reglas de escena (implementadas en `src/timeline/plan.ts`)
- **Lados estables**: cada personaje conserva su lado durante todo el video (orden de aparicion; el
  primero usa su `anchor`, el segundo el lado opuesto, el tercero el centro).
- **Speaker**: escala `defaultScale`, delante, leve vaiven. **Listener**: `defaultScale x 0.78`,
  brillo -25% (`config/render.json > layout`).
- Listener automatico: si la escena no declara `listeners`, se muestra al ultimo hablante distinto
  (en `neutral`). `listeners: []` deja al hablante solo.
- Escenas sin dialogo (meme, pausa) mantienen en pantalla a los personajes de la escena anterior.
- Maximo `layout.maxCharactersOnScreen` (3) personajes; mas requiere `crowd: true`.
- `character_reaction` solo para personajes en pantalla (si no, el plan falla).
- Cambios de avatar del mismo personaje a menos de `timing.minAvatarChangeIntervalMs` (1000 ms) generan
  warning: deben responder a un cambio semantico.
- **Variantes** (`characters.json > variants`): imagenes extra de la MISMA reaccion. Mientras un
  personaje habla, el plan alterna principal y variantes cada `timing.avatarVariantIntervalMs`
  (2000 ms); cada imagen dura al menos ese intervalo y nunca pisa un cambio semantico. El que escucha
  no varia. Origen de cada variante: `assets/characters/SOURCES.md`.
- Al cambiar de reaccion dentro de una escena: rebote breve (8 frames). Al cambiar de rol: transicion
  de escala (8 frames). Al entrar a escena por primera vez: entrada desde abajo (10 frames).

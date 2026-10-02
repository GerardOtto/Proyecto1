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
| kaito | Kaito | `#3D6BFF` | azul |
| neru | Neru | `#E8D44D` | amarillo limon |

Los colores son una propuesta de implementacion, no colores oficiales. Ajustarlos al material real.
Nota: luka/teto y rin/len/neru tienen colores cercanos; el nombre del personaje se muestra sobre cada
pagina de subtitulos para desambiguar. Kaito no tiene voz de Fish Audio todavia: el autopiloto no lo
elige hasta que se configure `voice.fish.referenceId`.

**Neru es muda** (no tiene voicebank oficial; ADR 0011): `voice.mute` + `voice.signatureSfx:
sfx_neru_phone`. Nunca tiene dialogo (error `MUTE_CHARACTER_SPEAKS`); aparece como listener y
"contesta" con `{REACT:neru:x}{SFX:sfx_neru_phone}`. Su celular solo suena con ella en pantalla
(aviso `SIGNATURE_SFX_WITHOUT_OWNER`). En el autopiloto entra como cameo, no como rol con dialogo.

**Imagenes en pares** (`pair_<a>_<b>_<accion>`, `assets/characters/pares/`): solo si ambos personajes
aparecen en el video (error `PAIR_CHARACTER_ABSENT`). Se usan con `[VISUAL:]` o `{STICKER:}`.

**Contexto de personajes**: `config/autopilot/lore.json` (Triple Baka, Teto quimera de 31 anos que se
cree gorda y a quien Miku y Neru molestan por comer mucho, el puerro de Miku, Neru sin voicebank...). Los guiones lo usan de forma PASIVA: 1-2
detalles por episodio dentro de una linea, nunca como explicacion.

Campos por personaje: `displayName`, `subtitleColor`, `defaultScale` (alto del avatar = escala x 1920),
`anchor` (lado preferido), `avatarDir`, `reactions` (reaccion canonica -> archivo), `voice`
(`fish.referenceId`, `speed`; `flite.voice` para desarrollo) y `license`.

## Audiencia y cierre (voz de la cuenta)
- La audiencia son **"los Papus"** / **"el Papu"**. Cuando un personaje le habla directamente a quien
  mira, abre con **"¡Papu papu!"**. Entre personajes se hablan normal.
- Cierre de cada video: invitacion breve a dar **Me gusta** y a **seguir** la cuenta, apta para
  YouTube, TikTok e Instagram (sin "suscribete", "campanita", "link en la bio"...), con el visual
  `cta_follow_like`. Recogido tambien en `prompts/director.system.md`.

## Reacciones (19 estados, ADR 0008)
| Canonica | Uso narrativo | Prioridad | Alias aceptados (ejemplos) | Fallback |
|---|---|---|---|---|
| neutral | explicacion normal / escucha | alta | normal, listening | — |
| feliz | aprobacion / remate ligero | alta | happy, contento/a, flores | neutral |
| sorprendido | hook / dato inesperado | alta | sorprendida, surprised | shocked |
| confundido | pregunta / malentendido | alta | confundida, confused, disgustado/a | neutral |
| enojado | correccion / frustracion comica | media | enojada, angry, maldiciendo | neutral |
| riendo | remate / reaccion | media | laughing, risa | feliz |
| nerd | explicacion tecnica / conclusion | media | serio_nerd, serio/a, profesional | neutral |
| shocked | giro exagerado / meme (ojos en blanco) | media | shock, impactado/a | gritando |
| gritando | exasperacion / grito comico (ojos ><) | media | grito, scream, exasperado/a | enojado |
| triste | mala noticia / llanto comico | media | sad, llorando | confundido |
| decepcionado | expectativa rota (ojos -_-) | media | decepcionada, disappointed | triste |
| emocionado | hype / anuncio / celebracion | media | emocionada, excited, bailando | feliz |
| timido | halago / verguenza | baja | timida, sonrojado/a, shy | feliz |
| saludando | saludo / despedida a los Papus | media | saludo, hola, wave | feliz |
| pensando | duda razonada / idea | media | pensativo/a, idea, thinking | confundido |
| presumido | "te lo dije" / coqueteo comico | baja | presumida, smug, coqueto/a | feliz |
| aburrido | tema denso / sueno | baja | aburrida, bored, dormido/a | neutral |
| nervioso | riesgo / preocupacion | media | nerviosa, nervous, preocupado/a | confundido |
| broma | gag visual (bigote, gato, peluche, chibi) | baja | gag, bigote, gato, chibi | riendo |

- En guiones y timelines se acepta cualquier alias; el motor los resuelve a la forma canonica.
- **Fallback**: si un personaje no tiene imagen propia para una reaccion, el catalogo usa la primera de
  su cadena que si tenga (con sus variantes). Cualquier reaccion es valida para cualquier personaje.
- Archivos: `<reaccion canonica>[_n].png` dentro de `avatarDir` (los genera `npm run avatars:ingest`).
- Para agregar una reaccion: agregarla en `config/reactions.json` con `use`, `aliases` y `fallback`
  (sin ciclos), ingestar imagenes donde existan y ejecutar `npm run catalog`.

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

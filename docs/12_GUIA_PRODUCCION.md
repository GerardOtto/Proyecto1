# 12 — Guía de producción: el estándar de calidad del canal

Esta guía resume lo aprendido en las tres rondas de corrección de los primeros videos con voces reales
(Docker, Búsqueda binaria y Log4Shell, 2 de octubre de 2026). El usuario los aprobó como el nivel mínimo
para los próximos. Ahí está todo lo que el usuario corrigió, así que conviene leerla antes de escribir,
producir o revisar un episodio.

- Guiones de referencia aprobados: `projects/ep_20261002_log4shell/script.md` (el escritor LLM lo recibe
  como ejemplo), `projects/ep_20261002_docker/script.md` y `projects/ep_20261002_binary_search/script.md`.
- Decisiones técnicas: [ADR 0013](adr/0013-orquestacion-reutilizacion-voz-y-assets.md).
- Formato del guion: [06_SCRIPT_FORMAT.md](06_SCRIPT_FORMAT.md). Autopiloto: [11_AUTOPILOT.md](11_AUTOPILOT.md).

## 1. Flujo de trabajo (orquestador)
1. **Autopiloto** (`npm run autopilot`): planifica, escribe y deja el episodio en `needs_review`.
2. **Orquestador (Claude):** reescribe el guion con esta guía. Arma el relleno contextual línea por línea
   y busca y cataloga los assets que falten (§4-§5).
3. **Producción en borrador** (`npm run autopilot -- --episode <id> --produce --tts fish`): 540x960 con
   todos los núcleos. Es la versión para revisar ([ADR 0015](adr/0015-voces-por-linea-borrador-y-render-parcial.md)).
4. **QA visual del orquestador**, además del QA automático (§7).
5. **Revisión del usuario:** deja un `Correcciones.txt` por video. El orquestador aplica cada punto,
   vuelve a producir en borrador reutilizando las voces (§3) y responde en `Historial de cambios.txt`.
   Si la duración no cambia (por ejemplo, solo un sticker o una imagen), el render es parcial: solo se
   renderizan los tramos que cambiaron.
6. **Render final, solo con la aprobación explícita del usuario:**
   `npm run autopilot -- --episode <id> --produce --final` (1080x1920; reutiliza todas las voces).
7. **Entrega:** el episodio aprobado pasa a `status: "final"` en `projects/<id>/autopilot.json` y su
   carpeta a `Desktop/Proyecto vocaloid/1. Videos finales/`. Desde ahí sale de la carpeta de revisión
   (`npm run review`).

## 2. Guion
- **Gancho recargado en los primeros 2 s:** saludo "¡Papu papu!", rótulo con la palabra clave, SFX con
  sacudida al fotograma 0 y zoom en la palabra clave.
- **Cada pregunta va DESPUÉS del dato que la provoca, y la respuesta inmediatamente después.** Error de
  la plantilla: "¿Cómo no sabes qué librerías usas?" antes de mencionar las dependencias.
- **Nada de reacciones de relleno genéricas.** "Espera, eso está buenísimo" se repetía en los tres
  videos y quedaba fuera de lugar (por ejemplo, después de una vulnerabilidad 10/10). Cada reacción
  sale de lo que se acaba de decir.
- **Sin jerga leída en voz alta:** "O de logaritmo de n" se cambió por "cada paso tira a la basura la
  mitad de lo que queda; si los datos se duplican, solo necesitas un paso más".
- **Casos reales y verificables que la audiencia reconozca.** Log4Shell y Minecraft: un mensaje en el
  chat del juego, con la captura del aviso oficial de Mojang.
- **Lore pasivo (2-3 guiños) y duración de 65 s o más** (ADR 0012). Ejemplos de lore: la apisonadora
  de Rin, Teto bromeando sobre sí misma y las baguettes, el puerro de Miku, el atún de Luka, Matryoshka
  con GUMI.
- **Sin referencias al lugar físico** (corrección del 2 de octubre de 2026): el fondo es de colores
  (ADR 0014), así que frases como "esta banca del parque" o "el jefe de esta oficina" sobran.
- **Interrupciones de Miku con vine boom** (gag recurrente). sfx_oohh en los picos.
- **Neru:** muda, con su propio beat de 1 s (ella y un solo oyente). Luego alguien "traduce" su mensaje
  ("Neru dice que..."). Nunca va como tercer personaje en la escena de otro. Usar su avatar `feliz`:
  `broma` (el limón) y `nerd` tienen mala calidad.
- **Comentarios del guion:** `//` o `<!-- -->` en UNA línea. Un `<!--` de varias líneas rompe el parser.

## 3. Voces (Fish Audio, presupuesto limitado)
- **Una línea idéntica = el mismo audio, sin costo.** Al reescribir, conserva palabra por palabra las
  líneas que sonaron bien. Para regenerar una toma mala, cambia levemente su texto (una coma basta).
  Un cambio de mayúsculas también regenera.
- **Términos técnicos en inglés se pronuncian en inglés:** agrega una regla a
  `config/pronunciations.json` ANTES de generar ("Log4Shell" se lee "Log four shell"). El subtítulo no
  cambia.
- **Dos voces para Luka** ([ADR 0015](adr/0015-voces-por-linea-borrador-y-render-parcial.md)): su voz base
  (japonesa) va en frases cortas y calmadas, a x1,2. `[VOICE:fluida]` usa otra voz más fluida y enérgica,
  sin acelerar, para las explicaciones largas. Muestras y notas del usuario en
  `Desktop/Proyecto vocaloid/3. Recursos/Muestras de voz Luka (2026-10-02)/`.
- **Ritmo:**
  - Luka es lenta por naturaleza (`voice.tempo: 1.2`).
  - Una línea concreta se ajusta con `[TEMPO:1.5]` (en local, sin regenerar).
  - Escucha sobre todo los ganchos y despedidas de Luka: ahí salieron tomas raras o entrecortadas.
- **Pausa antes de una cita:** `Adiós a... {PAUSE:300}'en mi máquina funciona'`. Los puntos
  suspensivos generan el silencio y el corte se ajusta a él.
- **Pausas raras del TTS** (1,6 s en "¿En Minecraft? ... Ahora sí es personal"): las acorta
  `render.audio.voicePauseCap`. No hay que hacer nada, pero conviene escucharlas.
- **Saldo:** `GET https://api.fish.audio/wallet/self/api-credit`. Las tres rondas costaron ~0,07 USD.

## 4. Visuales (parte superior)
- **Siempre algo relacionado con la línea que se está diciendo.** Usa `[BROLL: id]` en casi todos los
  bloques sin `[VISUAL]`. El autopiloto ya lo ordena (`src/autopilot/broll-picker.ts`).
- **Prioridad: GIF de Vocaloid del elenco** (`broll_v_*`), por ejemplo Miku tecleando o frente a una
  pantalla de error, Teto en la laptop o con baguettes, Rin en la apisonadora, Len en shock, Luka con
  su atún, Neru con el celular o Triple Baka. Fue el pedido general del usuario.
- **Todo objeto, lugar o meme que se nombra se muestra.** Las "muñecas rusas" sin imagen se notaron.
- **Logos** en tarjeta blanca (`assets/visuals/src/logo_*.html`, `npm run graphics`). **Gráficos
  propios** para explicar: VM vs contenedor, lineal vs binaria, el mensaje malicioso en el chat.
- **Capturas oficiales:** solo titular y bajada (por ejemplo, Minecraft.net). NVD bloquea al navegador
  headless; para las cifras se usa la tarjeta propia.
- **Evitar:**
  - Memes viejos o poco cercanos al público mexicano ("it works on my machine").
  - GIF con textos sin sentido ("heading on vacayyy"): mejor una foto real (CC0).
  - Gatos genéricos (solo con lentes y tecleando, y como último recurso).
- **GIF a b-roll:** MP4 4:3 con el GIF completo sobre su versión difuminada (nunca recortado), H.264
  GOP 30 sin B-frames. Revisa que no tenga tramos negros (el GIF de Teto pera tenía 1,2 s oscuro).
- **Fondos: SIN FOTOS.** Siempre `background: palette` ([ADR 0014](adr/0014-fondo-paleta-personajes.md)):
  - es un degradado oscuro aesthetic / kawaii-core con la paleta de los personajes del video;
  - pasa suavemente a los colores de quien habla;
  - lleva brillos, la cuadrícula de los primeros fondos (China, Astra) y partículas kawaii.
  - **Estilos:**
    - `background_style: analitico`: noticias y temas con muchos gráficos o tablas; más sobrio, en el
      "estudio".
    - `background_style: suave`: conceptos, historias y humor; más vivo, con bokeh.
  - **Armonía:** los marcos de los clips y el brillo de los gráficos toman la misma paleta; las tarjetas
    generadas usan la del elenco.
  - **Paletas:** se ajustan en `characters.json > palette`. Ojo con los amarillos: llevan un profundo
    ciruela o índigo para no verse oliva.

## 5. SFX
- **Cortos (<1 s, recortados al golpe) y al mismo volumen:** ~-16 LUFS, pico ≤ -1 dB. El tubo de metal
  a -7 LUFS se oía demasiado fuerte.
- **Paleta y usos:**

  | Momento | SFX |
  |---|---|
  | Gancho | dramatic boomer, oohh |
  | Interrupción de Miku | vine boom |
  | Pregunta | rayón de disco, "huh?" del gato |
  | Error o falla | error de Windows, trombón de Bob Esponja |
  | Dato impresionante | "wow" de anime |
  | Presumir | rizz |
  | Shock | FAAAH, tubo de metal (a volumen bajo) |
  | Revelación | Among Us |
  | Remate | ba dum tss, gato riendo, bruh |
  | Hacker | tecleo |
  | Minecraft | "hmm" del aldeano |
  | Neru | su celular (sfx_neru_phone) |

- **Nada vulgar:** canal educativo. El director de SFX elige por tags (`config/autopilot/sfx-rules.json`).

## 6. Biblioteca de assets (cómo ampliarla)
- **GIF:** `curl https://tenor.com/search/<q>-gifs` (con User-Agent de navegador). Arma la URL como
  `media.tenor.com/<id>AAAAC/<slug>.gif`, convierte a MP4 4:3 (§4) y registra en `config/assets.json`
  con `source` y tags: `vocaloid`, el personaje y el tema.
- **SFX:** `myinstants.com/media/sounds/<archivo>.mp3` (requiere User-Agent de navegador). Recorta al
  golpe, pásalo a mono 48 kHz y nivélalo a -16 LUFS.
- **Logos y fotos:** Wikimedia Commons (licencia en `extmetadata`); logos en tarjeta HTML.
- **Validación:** `npm run catalog` después de agregar.

## 7. QA del orquestador (antes de entregar)
- **QA automático:** todo en PASS (`report.json`). El único aviso aceptado es el de licencias.
- **Hoja de contacto con 10-12 fotogramas clave**, revisando:
  - el b-roll correcto en cada línea, sin recortes ni tramos negros;
  - el beat de Neru (ella y un oyente);
  - el rótulo del gancho;
  - la tarjeta CTA.
- **Subtítulos:** sincronizados tras las pausas (la palabra posterior no aparece antes del silencio).
- **Audio:** volumen de los SFX parejo con la voz; duración entre 65 y 120 s.
- **Informe al usuario:** qué escuchar con atención (tomas nuevas, pronunciaciones) y costo de voz.

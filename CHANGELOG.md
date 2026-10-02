# Changelog

## Sin publicar

### Orquestacion: reutilizar voces, pronunciacion y biblioteca de assets (ADR 0013)
- Voces reutilizadas por contenido (no por id de escena) y cache global de clips del proveedor
  (`.cache/tts/`): rehacer un video solo paga las lineas nuevas o cambiadas (`report.json > voices.reused`).
- `voice.tempo` por personaje (Luka 1.2): se aplica en local; cambiarlo no regenera audio.
- `config/pronunciations.json`: Log4Shell -> "Log four shell", Log4j -> "Log four jay" (solo TTS).
- `{PAUSE:ms}` corta en el silencio real mas cercano (`silencedetect`), no a mitad de palabra.
- Beat propio de personaje mudo: `[NERU:x]` sin texto + `[PAUSE:ms]`; escritores actualizados (sin
  tercer listener ni avatar `broma`).
- Biblioteca: 15 SFX virales, 13 clips contextuales (GIF -> MP4), 6 stickers animados, logos de
  Docker/Log4j/Minecraft, graficos VM vs contenedor, lineal vs binaria y chat de Log4Shell, captura
  oficial de Minecraft.net. Rin, Len y Kaito con voz de Fish Audio y saludo.
- Prototipos v2 (Docker, Busqueda binaria, Log4Shell) reescritos por el orquestador Claude.
- v3: `[TEMPO:x]` por linea, `audio.voicePauseCap` (pausas del TTS > 600 ms), SFX nivelados a ~-16 LUFS,
  21 GIF de Vocaloid (4:3 sin recortes), Matryoshka/muñecas rusas, foto CC0 de portacontenedores, fondos
  foto del usuario para cafeteria/parque/oficina; fuera "it works on my machine" y el barco con texto.

### Mundo del canal (ADR 0012)
- Lore ampliado: trasfondos, dinamicas (trio baka, Teto comilona, duo de Mesmerizer, Kagamine espejo,
  Kaito hermano mayor) y memes de la comunidad (Teto pera, Gumi, Mesmerizer, Rabbit Hole, Ievan Polkka,
  World is Mine, Luka Luka Night Fever, Roada Rolla Da).
- Escenarios con fondos propios (`bg_place_*`: playa, cafeteria, oficina, parque, aula, habitacion
  gamer, servidores, konbini) elegidos por afinidad con el tema; los personajes saben donde estan.
- Narrativa secundaria "Neru consigue su voz" por etapas; final solo por decision humana tras 10+ videos.
- Casting con afinidad personaje-tema; minimo 65 s (objetivos 80-90 s); seccion de coherencia en el brief.
- `npm run graphics` tambien renderiza `assets/backgrounds/src/*.html`.

### Pares, Neru muda y contexto de personajes (ADR 0011)
- 18 imagenes en pares (`pair_*`, campo `characters`): solo si ambos personajes estan en el video
  (error `PAIR_CHARACTER_ABSENT`); el brief del escritor lista las disponibles para el casting.
- Personajes mudos: `voice.mute` y `voice.signatureSfx`. Neru nunca habla (error
  `MUTE_CHARACTER_SPEAKS`); su voz es `sfx_neru_phone` (aviso `SIGNATURE_SFX_WITHOUT_OWNER`), que deja
  de estar reservado. En el autopiloto Neru pasa de foil/guest a cameo mudo (35 %).
- `config/autopilot/lore.json`: contexto de cada personaje y compartido (Triple Baka, Crypton,
  rivalidad Teto-Miku) para referencias pasivas; reglas en `prompts/writer.system.md`.
- Los 5 guiones sin producir (GitHub, Meta, AlphaGo, CrowdStrike, pesos abiertos) llevan 1-2 guiños.

### Stickers de reaccion (ADR 0010)
- Evento `sticker` (`{STICKER:id[:sfx][:volumen][:personaje]}`): sticker breve en la esquina del area
  de visuales del lado de quien reacciona, sin flash ni sacudida y sin tapar subtitulos.
  `render.json > events.sticker`, `Stickers.tsx`, validacion, director LLM y escritor del autopiloto.
- `sfx_oohh` deja de ser exclusivo de China: reaccion chistosa general (favorito del canal); el
  director de SFX lo considera en sorpresas y enfasis.
- Episodio OpenAI Astra: 6 stickers de reaccion (2 con "oohh").

### Avatares reales y reacciones ampliadas (ADR 0008)
- Set nuevo de avatares desde los tableros de Pinterest (209 imagenes, origen por pin en
  `assets/characters/SOURCES.md`): Teto, Miku y Luka reemplazados; Rin y Len dejan de ser placeholder;
  personajes nuevos **kaito** y **neru** (sin voz de Fish Audio aun: no entran al casting automatico).
- 19 reacciones canonicas (+ gritando, triste, decepcionado, emocionado, timido, saludando, pensando,
  presumido, aburrido, nervioso, broma) con campo `fallback`: el catalogo resuelve las reacciones sin
  imagen propia por su cadena (errores `REACTION_FALLBACK_UNKNOWN` / `REACTION_FALLBACK_CYCLE`).
- `avatars:ingest`: nombres `<Personaje>_<reaccion>[_n]` y `--replace`; el log muestra el original.
- 18 stickers como memes (`assets/memes/meme_gato_*`, `meme_pera*`, `meme_nugget`...) y 5 meme beats
  nuevos para el escritor.
- Casting: kaito/neru con roles y personalidad; el planificador exige `voice.fish.referenceId` (antes
  bastaba la ruta del saludo, que habria elegido a Rin/Len sin voz).

### Visuales de noticia (ADR 0009)
- Captura real del titular (`src/autopilot/capture.ts`, puppeteer-core sobre el Chrome de Remotion:
  movil, sin banners ni fotos, coincidencia del titular, recorte 4:3) enmarcada con el dominio real.
- Tarjetas estilo noticia propias (`src/autopilot/newscards.ts`): 5 disenos, titular textual, medio,
  fecha y traduccion; variedad entre episodios de la semana. Nunca imitan el sitio del medio.
- `--refresh-visuals` para episodios existentes; el brief del escritor lista el relleno de noticia.
- Episodios de la semana 2026-10-01 con capturas (7/7) y tarjetas en las lineas que citan cada fuente.

### Autopiloto de produccion (ADR 0007)
- `npm run autopilot`: noticias RSS/Atom (puntuacion por nicho y frescura, agrupado, historial) o banco
  evergreen de 29 temas (CS, IA, programacion, polemicas, historia) con fuentes.
- Planificador determinista: formato, casting por roles (solo personajes listos), tema visual.
- Escritor de plantilla (offline) y escritor LLM (LLMProvider, validacion + reintentos).
- Director de SFX por tags; lint editorial del formato de la casa.
- Graficos propios por episodio (stat/keypoints/code/versus/headline) y fondos por tema.
- Kit de publicacion (descripciones por plataforma, hashtags, calendario CDMX, checklist).
- `npm run avatars:ingest`: renders -> avatares sin fondo -> characters.json.
- `src/utils/chrome.ts` (captura HTML->PNG compartida; `--no-sandbox` si se ejecuta como root).
- `--brief <json> --writer manual [--format x]`: noticia investigada a mano -> episodio con
  `writer-brief.md` y `script.md` esqueleto (escritura en Claude Code, sin costo de API).
- `npm run compare-writers`: compara modelo x esfuerzo del escritor LLM (costo, tiempo, intentos, lint)
  contra el guion manual. `AnthropicProvider` acepta modelo/esfuerzo (`DIRECTOR_EFFORT`), cachea el
  system prompt y reporta tokens de cache.
- `npm run review` (`src/review/`): carpeta de revision simple fuera del repo (`REVIEW_DIR`): Guion.txt
  legible, imagenes, avatares, audios, video y Resumen.txt; el autopiloto la actualiza solo.
- Semana del 2026-10-01: 3 episodios de noticias escritos a mano (OpenAI Astra, filtracion de capturas
  en GitHub, Meta Muse) con sus briefs en `projects/_autopilot/briefs/`.

- Rotulo de palabra clave en el gancho (ADR 0006, `docs/10_DISTRIBUCION.md` §8): `meta.hookTitle`
  (`hook_title:` en el guion), `titleCard` en render.json, `TitleCard.tsx`, visuales del gancho
  desplazados bajo el rotulo, 5 validaciones (HOOK_TITLE_*), portada `cover.jpg` y tests.
- Politica de musica final: el MP4 sale sin musica (se anade desde la biblioteca de cada
  plataforma); el demo deja de usar `music:`. La explosion vuelve a 1.7x manteniendo el corte en
  850 ms.
- Explosion recortada a la mitad sin acelerar: GIF a velocidad normal cortado a los 850 ms
  (`cutAtMs`), y la escena meme dura exactamente eso (Teto habla al terminar la explosion).
- "Titular exagerado": captura real de La Nacion (27 ene 2025) con el sello "EXAGERADO" propio.
- Musica de fondo activada en el demo ("Electric Angel", solo local): -31 LUFS, ducking mas marcado
  bajo la voz. Se retiran los SFX descartados por el usuario (drama, scary, what cat) y
  `sfx_social_credit` pasa a la version "chinese-social-credit-music".
- Ritmo y humor: 7 SFX cortos (< 1 s) de memes de TikTok chino (oohh, social credit, dramatic
  boomer/drama, what cat, evil laugh, scary); hook sobrecargado en los primeros 2 s (golpe + sacudida
  al arrancar, sting en "China", "Oohh" + zoom en "destruyo"); lead-in 250 -> 60 ms.
- Explosion mas agil: GIF a 1.7x (`memeExplosion.gifPlaybackRate`), 1 s en total, sonido de 2 s a
  0.95 s y escena meme de 1.3 s a 0.8 s.
- SFX: "pop" automatico al aparecer cada visual o captura (`events.visual.sfx`, espaciado minimo,
  no pisa otros SFX ni suena en memes); `{SFX:id:volumen}` en el guion; nuevos efectos (vine boom,
  bubble pop, teetoo y teto-wav de Teto). `sfx_neru_phone` reservado para el futuro personaje NERU
  (aviso ASSET_RESERVED si se usa).
- Limitador final (`audio.finalLimiterDb`, -1.5 dB) sobre el audio del MP4 tras el render: los SFX
  que Remotion suma a la voz ya no pueden acercarse al clipping (el video se copia sin recodificar).
- Ajustes tras revision: marca de agua 84 -> 56 px; cola final 1500 -> 500 ms (sin silencio largo
  tras la despedida); la captura de Wikipedia (demasiado texto) se reemplaza por el titular de
  Infobae sobre DeepSeek superando a ChatGPT en la App Store.
- Marca de agua "@tetociencia" estilo salvapantallas de DVD: rebota en los bordes y cambia de color
  en cada rebote (colores Vocaloid), cursiva gruesa semitransparente. Handle por idioma
  (`render.json > watermark.handles`) para futuras traducciones.
- B-roll contextual: `[BROLL: a, b]` por bloque (`scene.broll`) con prioridad sobre el pozo global;
  soporte de capturas/imagenes con Ken Burns. Material nuevo: capturas de Infobae, El Financiero,
  Wikipedia, DeepSeek (anuncio, benchmark, precios), OpenAI o1, Claude 3.5 Sonnet y LMArena, y 3
  GIFs de gatos con gafas tecleando. Se retiran 8 clips CC0 genericos (se conserva el perro robot).
- Demo: el logo de DeepSeek aparece al pronunciar "DeepSeek" (antes, al final de la frase).
- Saludo recurrente "¡Papu papu!" con audio propio y reutilizable por personaje
  (`characters.json > voice.greeting`, `render.json > audio.greeting`): el guion escribe la linea
  completa; el motor genera/busca solo el resto y une saludo + pausa + resto. Audios en
  `assets/voice/` (no versionados).
- Subtitulos: `captions.keepTogether` evita partir expresiones entre paginas ("Me gusta", "Papu papu").
- Cierre del video apto para YouTube/TikTok/Instagram (Me gusta + siguenos) con el visual propio
  `cta_follow_like`. Voz de la cuenta: la audiencia son "los Papus"; al hablarle directamente se abre
  con "¡Papu papu!" (docs/02_CHARACTER_RULES.md y prompt del director).
- `generate --tts files --allow-missing-audio`: los bloques sin archivo de voz se previsualizan en
  silencio con su duracion estimada y quedan listados en report.json (steps.voices.missingAudio).
- B-roll (ADR 0005): el area de visuales nunca queda vacia. Asset `broll`, `meta.broll`
  (front matter `broll:`), relleno automatico de huecos en el plan; 9 clips CC0/dominio publico de
  Wikimedia Commons (informatica, IA, gatitos). Demo: 0 s de area vacia (antes ~25 s).
- Variantes de avatar: intervalo de 1 s a 2 s.
- Graficos propios versionados como HTML (`assets/visuals/src/`) y `npm run graphics` (Chrome
  headless de Remotion -> PNG transparente): logos (simbolos de Wikimedia Commons), titular y
  graficos con datos reales y fuente (DeepSeek-R1 arXiv:2501.12948; precios de lanzamiento de API).
- Memes GIF animados con `@remotion/gif` (sincronizados con los frames, deterministas);
  `scripts/remove-bg.py --gif` quita el fondo cuadro a cuadro y elige el cuadro inicial.
- SFX reales (explosion y ding) aportados por el usuario; meme_boom ahora es un GIF.
- `make-placeholders --force` ya no sobrescribe assets cuyo license_status no es placeholder.
- Ritmo: voz a 1.1x (`audio.voiceTempo`, atempo conserva el tono) y pausas entre turnos de 280 a
  150 ms. Explosion completa (1.7 s) que se solapa con el inicio del siguiente dialogo (escena meme
  1.3 s). El estilo "corte" (`cutAtMs`) queda disponible pero desactivado.
- Variantes de avatar por reaccion (`characters.json > variants`): el que habla alterna imagenes de la
  misma emocion cada `timing.avatarVariantIntervalMs` (1 s). Aviso de cambio rapido: 1200 -> 1000 ms.
- Musica de fondo (ADR 0004): asset `music`, `meta.music` (front matter `music:` o project.json),
  mezcla en la pista maestra con loop, nivel fijo, fades y ducking sidechain bajo la voz.
  Catalogo local no versionado `config/assets.local.json` para musica con copyright.
  Desactivada por defecto: los videos se exportan sin musica y se anade en TikTok/Instagram.
- Avatares reales de Teto, Miku y Luka (renders MMD aportados por el usuario, `license_status: unknown`);
  fondo eliminado con `scripts/remove-bg.py`; origen de cada reaccion en `assets/characters/SOURCES.md`.
- Voces de Fish Audio registradas por personaje (`voice.fish.referenceId`).
- Fix: un `fishReferenceId` vacio en `requested_voices.json` ya no tapa el id global del personaje.
- Audio: nivelado por bloque de voz a `audio.voiceBlockLufs` (-20 LUFS, ganancia estatica) antes de la
  mezcla, para que voces de distinto origen suenen igual de fuertes.
- Fix (Windows): `bg_tech_loop.mp4` regenerado con GOP corto y sin B-frames; el compositor de Remotion
  fallaba con "No frame found at position".

## 0.1.0 — 2026-10-01 — MVP tecnico (fases 0-7 del plan)
- Fase 0: proyecto TypeScript + Remotion 4, `doctor`, `smoke`, CLAUDE.md, schemas.
- Fase 1: catalogo (`config/characters.json`, `reactions.json`, `assets.json`), validacion de assets
  (rutas, vacios, tipos, duplicados), assets de proyecto, placeholders deterministas.
- Fase 2: composicion `ShortVideo` (Background, Stage, Captions, Visuals, Camera, MemeLayer, Audio),
  compilador `RenderPlan`, timeline manual `projects/manual_001`.
- Fase 3: `TTSProvider` (fish, files, flite, silent) con cache por bloque.
- Fase 4: whisper.cpp + estimate, alineado guion<->transcripcion, color por personaje, SRT.
- Fase 5: eventos (reaction, visual show/hide, zoom, shake, meme, emphasis, pause, sfx), validadores.
- Fase 6: parser de guion + director `rules`; director LLM (Anthropic, structured outputs, reintentos).
- Fase 7: QA hard/soft, reporte, prueba de reproducibilidad, demo_001 (75 s) y tests (80).
- ADRs 0001-0003.

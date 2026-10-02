# ADR 0013 — Orquestacion: reutilizar voces, pronunciacion, ritmo por personaje, beat de cameo y biblioteca de assets

- Estado: aceptado (2026-10-02). Amplia ADR 0002 (audio como autoridad temporal), ADR 0003
  (proveedores intercambiables), ADR 0011 (Neru muda) y ADR 0007 (autopiloto).

## Contexto
Tras los tres primeros prototipos del autopiloto con voces reales (Fish Audio), el usuario dejo
correcciones por video (Desktop/Proyecto vocaloid/Prototipos autopiloto 2026-10-02/*/Correcciones.txt):
- Rehacer sin volver a pagar las voces que salieron bien ("no regeneres todos los audios").
- Pronunciacion: "Log cuatro shell" / "Log cuatro ja" en lugar de "Log four shell" / "Log four jay".
- Luka habla lento: acelerar sus clips x1.2-1.3 (sin regenerarlos).
- Una pausa muy corta antes de una cita entre comillas.
- Neru como tercer personaje sobrecarga la parte inferior: darle su propio momento, lo que dura su SFX,
  y no usar su avatar del limon (baja calidad).
- Mismos GIF de gatos en todos los videos: conseguir logos, GIF, capturas y videos contextuales y SFX
  virales, y guardarlos para reutilizarlos.

## Decision
- **Reutilizacion de voz por contenido** (`stepVoices`): un bloque se reutiliza si su clave (proveedor,
  voz, personaje, texto, ritmo, volumen, saludo) coincide con la de CUALQUIER bloque previo del
  proyecto, no solo con el de la misma escena. Insertar o quitar escenas cambia los ids (`s05` ->
  `s07`) pero no obliga a regenerar. Se hace una instantanea previa (`audio/blocks/.prev/`) porque un
  bloque nuevo puede pisar el archivo de otro que se reutiliza despues. `report.json > voices.reused`.
- **Cache global de clips del proveedor** (`.cache/tts/<sha>.wav`): clave = cacheTag del proveedor +
  idioma + texto hablado. Una misma linea nunca se paga dos veces, aunque cambie de proyecto o se
  borre el indice. No aplica a `files` ni `silent`.
- **Ritmo por personaje** (`voice.tempo` en characters.json o requested_voices.json): multiplica
  `render.audio.voiceTempo`. Si el audio previo es el mismo con otro ritmo, se reajusta en local
  (`atempo` con la razon nuevo/anterior) sin llamar al proveedor. Luka: 1.2.
- **Diccionario de pronunciacion** (`config/pronunciations.json`, schema propio): reescribe solo el
  texto enviado al TTS (palabra completa, sin distinguir mayusculas, el termino mas largo primero). Los
  subtitulos conservan el guion. La clave del bloque incluye el texto hablado solo cuando difiere, asi
  los indices previos siguen siendo validos y agregar una regla regenera solo las lineas afectadas.
- **Pausas al silencio real**: `{PAUSE:ms}` dentro de una linea corta el audio en el silencio mas
  cercano (`silencedetect`, ventana 450 ms) en vez del limite estimado entre palabras, que sin whisper
  podia partir una palabra. Si no hay silencio cerca, se usa la estimacion.
- **Beat de personaje mudo**: un bloque `[NERU:x]` sin texto ya no es error; es una escena sin dialogo
  donde ella ocupa el lugar de quien habla, con sus oyentes y eventos anclados a `atMs: 0`, durante su
  `[PAUSE:ms]` (por defecto `MUTE_BEAT_MS` = 1000, lo que dura `sfx_neru_phone`). El escritor de
  plantilla y el prompt del escritor LLM la usan en lugar de sumarla como tercer listener; la reaccion
  `broma` (limon) queda fuera de los escritores.
- **Biblioteca de assets reutilizable**: 15 SFX virales cortos (myinstants, tendencias MX/US), 13 clips
  contextuales (GIF de Tenor convertidos a MP4 4:3/cuadrado, H.264 GOP 30 sin B-frames), 6 stickers
  animados, 3 tarjetas de logo (Wikimedia Commons), 3 graficos propios y una captura oficial, todos con
  tags tematicos y `source` para que futuros guiones (y el autopiloto) los elijan por tema.

### Ampliacion (2026-10-02, segunda ronda de correcciones)
- **Ritmo por linea** `[TEMPO:x]` (`scene.voiceTempo`, 0.7-1.8): multiplica voiceTempo x voice.tempo;
  con audio previo se reacelera en local (p. ej. "Cada paso tira a la basura..." de Luka x1.5).
- **Tope de pausas del TTS** (`render.audio.voicePauseCap`: silencios internos > 600 ms -> 250 ms). Fish
  dejo 1.6 s de silencio dentro de "¿En Minecraft? ... Ahora si es personal". Es un post-proceso local e
  idempotente que se aplica tambien al audio reutilizado y NO entra en la clave de cache (cambiarlo no
  regenera voces).
- **SFX nivelados por sonoridad** (~-16 LUFS, pico <= -1 dB) en lugar de por pico: el tubo de metal, el
  gato riendo y el bruh sonaban 9-10 dB mas fuertes que vine boom.
- **GIF de Vocaloid** como relleno principal (21 clips 4:3 con el GIF completo sobre su version
  difuminada, sin recortes); fondos foto del usuario para cafeteria, parque y oficina (settings.json).
- Retirados por el usuario: "it works on my machine" (viejo, poco cercano al publico) y el GIF del barco
  con texto ("heading on vacayyy"), reemplazado por una foto CC0.

## Consecuencias
- Rehacer un video tras una revision cuesta solo las lineas nuevas o cambiadas (los prototipos v2
  regeneraron 24 de 50 lineas; el resto se reutilizo o se reacelero en local).
- Un cambio de mayusculas en una linea cambia el texto y por lo tanto regenera ese audio.
- Los GIF/SFX de memes quedan `license_status: unknown` (bloqueados para monetizar, ver
  docs/09_LICENSING.md); xkcd es CC BY-NC.
- NVD bloquea al navegador headless: la gravedad 10/10 se muestra con la tarjeta propia.

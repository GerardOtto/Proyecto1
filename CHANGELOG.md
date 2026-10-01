# Changelog

## Sin publicar
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

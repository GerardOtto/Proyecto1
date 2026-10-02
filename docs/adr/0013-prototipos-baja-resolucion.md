# ADR 0013 — Prototipos de baja resolucion con voz de borrador en espanol

- Estado: aceptado (2026-10-02).

## Contexto
Antes de gastar en voces de Fish Audio y en renders de 1080x1920, el usuario quiere revisar los
episodios ya escritos como video: ritmo, chistes, stickers, SFX, imagenes y duracion. Los proveedores
offline existentes no sirven para eso: `silent` no tiene voz y `flite` solo habla ingles (el espanol
suena ininteligible). Ademas, los proveedores fallaban si faltaba el audio grabado del saludo
"¡Papu papu!" (no versionado), salvo con `--allow-missing-audio`, que lo deja en silencio.

## Decision
- **TTS `espeak`** (`src/tts/espeak.ts`, `TTSProvider`): espeak-ng con MBROLA (`mb-es3`) y respaldo
  formante latinoamericano (`es-419+f3/m3`, velocidad x1.25) si MBROLA no esta instalado. Voz por
  personaje en `config/characters.json > voice.espeak { voice, pitch, speed }` (schema actualizado):
  mismo motor con tono distinto (Miku aguda, Luka grave, Teto intermedia). Velocidad calibrada para
  ~2,6 palabras/s tras `audio.voiceTempo` (la misma estimacion del motor), para que la duracion del
  prototipo anticipe la final. Quita las marcas que espeak leeria (`*`, `#`...). `ESPEAK_NG_PATH`.
- **Voces de borrador** (`TTSProvider.draft`: espeak, flite, silent): si falta el audio grabado del
  saludo, el proveedor dice la linea completa (`greetingAudioApplies`). `fish` y `files` lo siguen
  exigiendo: la voz final no cambia.
- **Render de prototipo** (`render`/`generate --preview`): `render.json > preview { scale, crf }`
  (0.5 -> 540x960, CRF 28). Remotion renderiza con `scale` (dimensiones pares); sale en
  `output/<id>/preview.mp4`, nunca en `video.mp4`. La validacion del MP4 espera el tamano escalado
  (`scaledSize`), la tabla de QA lo muestra, `report.json > summary.preview = true`; sin portada ni
  prueba de reproducibilidad. Duracion 60-120 s y el resto de checks se mantienen.
- `npm run review` copia el prototipo como `Prototipo.mp4` si aun no hay video final.

## Consecuencias
- Un episodio se puede revisar como video en ~2-3 min por prototipo (4 vCPU), sin claves ni red.
- El prototipo no se publica nunca: el script de subida (ADR 0014) solo acepta el `video.mp4` final de
  1080x1920.
- La voz de borrador es robotica y lee los nombres en ingles con fonetica espanola ("GitHub"): se
  revisa el ritmo, no la pronunciacion.
- Rendimiento: los 5 prototipos de la semana tardaron 119-148 s cada uno (incluye voces y bundle).

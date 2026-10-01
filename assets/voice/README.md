# Saludo recurrente ("¡Papu papu!")

Audio reutilizable por personaje, grabado **una sola vez** y usado en todos los videos. No se
versiona (voces generadas en Fish Audio; el repo es publico).

| Personaje | Archivo |
|---|---|
| teto | `assets/voice/teto/papu_papu.mp3` |
| miku | `assets/voice/miku/papu_papu.mp3` |
| luka | `assets/voice/luka/papu_papu.mp3` |

Las rutas estan en `config/characters.json > voice.greeting`; el texto, en
`config/render.json > audio.greeting.text`.

## Como funciona
En el guion se escribe la linea completa: `¡Papu papu! ¿China destruyo a ChatGPT?`. Al generar la voz,
el motor detecta el saludo al inicio, pide al TTS (o busca en `audio/input/<bloque>.mp3`) **solo el
resto** ("¿China destruyo a ChatGPT?") y une: saludo + pausa (`audio.greeting.gapMs`) + resto. Los
subtitulos muestran la linea completa.

Con `generate --allow-missing-audio`, si falta el saludo se usa silencio provisional y el bloque queda
listado en `report.json > steps.voices.missingAudio`.

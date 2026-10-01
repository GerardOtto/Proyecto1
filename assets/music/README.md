# Musica de fondo

> Politica actual: los videos se exportan **sin musica**; se anade al publicar desde TikTok/Instagram
> (docs/09_LICENSING.md). Usar esta carpeta solo para pistas propias o libres de derechos.

Los archivos de esta carpeta **no se versionan** (el repo es publico y la musica suele tener
copyright). Cada maquina registra sus temas en `config/assets.local.json` (tambien ignorado), que el
motor fusiona con `config/assets.json`.

## Agregar un tema
1. Copiar el archivo aqui (`.mp3`, `.wav`, `.ogg` o `.m4a`) con un nombre en minusculas sin espacios.
2. Registrarlo en `config/assets.local.json`:
   ```json
   {
     "id": "mi_tema",
     "type": "music",
     "path": "assets/music/mi_tema.mp3",
     "tags": ["musica", "energetica"],
     "startMs": 0,
     "source": "de donde sale",
     "license_status": "unknown"
   }
   ```
   `startMs` salta la intro o el silencio inicial. Usa `documented` u `owned` solo con licencia verificada.
3. `npm run catalog` para validar.

## Usarlo en un video
En el front matter del guion (`music: mi_tema`) o en `project.json` (`"music": "mi_tema"`).
`music: none` desactiva la musica. El motor la pone en loop, la nivela a `audio.music.lufs`, la
baja automaticamente mientras alguien habla (ducking) y le aplica fade in/out
(`config/render.json > audio.music`).

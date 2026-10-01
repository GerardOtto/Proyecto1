# manual_001 — timeline escrito a mano (Fase 2)

Demuestra que un `timeline.json` escrito a mano (sin director, sin TTS, sin transcripcion) se
renderiza a un MP4 9:16 correcto. Los subtitulos se estiman a partir del texto de cada escena y el
audio solo contiene los SFX (no hay voces).

```bash
npm run validate -- --project projects/manual_001
npm run render -- --project projects/manual_001
```

Es la base para depurar componentes visuales sin depender del audio: "primero demostrar que un
timeline escrito a mano puede renderizarse bien; luego automatizar su creacion" (plan, seccion 9).

# short-video-engine

Motor **local** que convierte un guion en un video vertical educativo (TikTok / Reels) de
**60-120 s**, 1080x1920 @ 30 fps, con personajes Vocaloid (Teto, Miku, Luka, Rin, Len) como
imagenes estaticas por emocion, **subtitulos por color de personaje**, recursos visuales, efectos
meme/SFX y video de fondo.

```
guion (.md) ─► director (rules | LLM) ─► timeline.draft.json ─► TTS por bloque ─► whisper.cpp
          ─► reajuste con audio real ─► timeline.json ─► Remotion (React) ─► MP4 + SRT + report.json
```

> La IA decide **QUE** ocurre; el motor decide **COMO** ocurre. El audio es la autoridad temporal.

## Requisitos
- Node.js >= 20 (LTS), FFmpeg + ffprobe en el PATH, Git.
- Opcional: whisper.cpp (`npm run whisper:install`, requiere make + compilador C/C++),
  `FISH_AUDIO_API_KEY` (voces), `ANTHROPIC_API_KEY` (director LLM).
- Remotion descarga Chrome Headless Shell en el primer render (o usa `REMOTION_BROWSER_EXECUTABLE`).

## Inicio rapido
```bash
npm install
cp .env.example .env          # completar claves si se usan Fish Audio / Anthropic
npm run doctor                # verifica el entorno
npm run smoke                 # render de humo de 8 s -> output/smoke/smoke.mp4
npm test                      # tests rapidos

# Pipeline completo del piloto (sin claves: voz muda estimada; con flite: voz robotica offline)
npm run generate -- --project projects/demo_001 --tts silent
npm run generate -- --project projects/demo_001 --tts fish      # voces reales (Fish Audio)
```
Salida en `output/demo_001/`: `video.mp4`, `timeline.json`, `subtitles.srt`, `report.json`.

## Comandos
| Comando | Que hace |
|---|---|
| `npm run doctor` | Comprueba Node, FFmpeg, Git, navegador, whisper.cpp y claves. |
| `npm run catalog [-- --project P]` | Valida `config/*.json` y que cada personaje/reaccion/asset exista y no este vacio. |
| `npm run assets:placeholders [-- --force]` | Regenera los assets placeholder (avatares, logos, fondo, SFX). |
| `npm run analyze -- --project P [--director rules\|anthropic]` | Guion -> `timeline.draft.json` (tiempos estimados) + validacion. |
| `npm run voices -- --project P [--tts fish\|files\|flite\|silent] [--list]` | Una voz por bloque de dialogo (`audio/blocks/`, cacheado). |
| `npm run transcribe -- --project P [--transcriber auto\|whisper-cpp\|estimate]` | Timestamps por palabra + alineado con el texto del guion. |
| `npm run build-timeline -- --project P` | Pista maestra + tiempos reales -> `timeline.json` + `subtitles.srt`. |
| `npm run validate -- --project P [--draft] [--output]` | Valida **sin renderizar** (y opcionalmente el MP4 existente). |
| `npm run render -- --project P [--repro] [--safe-area]` | Renderiza el `timeline.json` existente + validacion final + reporte. |
| `npm run generate -- --project P [...]` | Todo lo anterior en orden (pasos 1-10 del plan). |
| `npm run studio -- --project P [--draft]` | Preview en Remotion Studio. |
| `npm run smoke` / `npm run test:render` | Render de humo de un fixture de 8 s. |
| `npm test` / `npm run lint` | Vitest / ESLint + `tsc --noEmit`. |
| `npm run whisper:install [-- --model small]` | Compila whisper.cpp y descarga el modelo. |

## Documentacion
- [`CLAUDE.md`](CLAUDE.md) — reglas y mapa para el agente.
- [`docs/00_README.md`](docs/00_README.md) — indice del paquete de especificacion.
- [`docs/STATUS.md`](docs/STATUS.md) — que funciona, que falta y como seguir.
- Plan original: [`docs/plan/`](docs/plan/).

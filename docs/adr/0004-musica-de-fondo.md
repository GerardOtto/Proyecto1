# ADR 0004 — Musica de fondo en la pista maestra

- Estado: aceptado (2026-10-01)

## Contexto
Los videos necesitan una cama musical para retener la atencion. La musica no debe tapar la voz,
debe sonar parecido entre temas distintos y no puede romper el principio de que el audio de voz es
la autoridad temporal (ADR 0002).

## Decision
- Nuevo tipo de asset `music`. El timeline declara `meta.music` (ID). Se elige en el front matter
  del guion (`music:`) o en `project.json`; `none` la desactiva. El LLM no la elige (no aparece en
  su resumen del catalogo), igual que el fondo.
- La musica se mezcla con ffmpeg **dentro de la pista maestra** (`build-timeline`), no en Remotion:
  loop (`-stream_loop`), salto de intro (`startMs` del asset), ganancia fija hasta
  `audio.music.lufs`, fade in/out y ducking con `sidechaincompress` disparado por la voz. Despues,
  la normalizacion EBU R128 y el limitador de siempre.
- El grafo de filtros lo genera una funcion pura (`masterFilterGraph`) cubierta por tests.
- Musica con copyright: archivos en `assets/music/` y catalogo en `config/assets.local.json`, ambos
  fuera de git (repo publico). El motor fusiona el catalogo local si existe.

## Alternativas descartadas
- Mezclar en Remotion (`<Audio loop volume={...}>`): el ducking habria que calcularlo a mano por
  frame y la QA de audio (clipping, sonoridad) veria dos pistas separadas en lugar de una.
- Ducking por envolvente calculada con los intervalos de voz: mas codigo y transiciones menos
  naturales que un compresor sidechain.

## Consecuencias
- `RenderPlan` y los componentes no cambian; Studio y render oyen la musica a traves de master.wav.
- Cambiar de tema solo requiere `build-timeline` + render (las voces quedan en cache).
- Un clon limpio del repo no trae musica: un guion que declare `music:` falla con un mensaje que
  apunta a `assets/music/README.md`.
- La licencia del tema entra en `report.json > licenses` como cualquier otro asset.

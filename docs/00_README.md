# 00 — Paquete de especificacion (indice)

Paquete inicial de la seccion 14 del plan, para retomar el desarrollo con Claude Code:

| Documento | Contenido |
|---|---|
| [01_PRODUCT_SPEC.md](01_PRODUCT_SPEC.md) | Objetivo, alcance del MVP, arquitectura, definicion de exito y de "done". |
| [02_CHARACTER_RULES.md](02_CHARACTER_RULES.md) | Personajes, reacciones, colores, escalas y reglas de escena. |
| [03_ASSET_RULES.md](03_ASSET_RULES.md) | Catalogo de assets, nombres, metadatos, assets del proyecto, licencias. |
| [04_TIMELINE_SCHEMA.md](04_TIMELINE_SCHEMA.md) | Contrato `timeline.json` (schema en `schemas/timeline.schema.json`) y eventos. |
| [05_RENDER_RULES.md](05_RENDER_RULES.md) | Capas, layout, safe area, subtitulos, animaciones, codificacion. |
| [06_SCRIPT_FORMAT.md](06_SCRIPT_FORMAT.md) | Formato del guion `script.md` (etiquetas, secciones, tags inline). |
| [07_PIPELINE.md](07_PIPELINE.md) | Los 10 pasos, archivos que produce cada uno, cache, proveedores. |
| [08_QA.md](08_QA.md) | Criterios de aceptacion (hard/soft fail), tests, validacion visual manual. |
| [09_LICENSING.md](09_LICENSING.md) | Presupuesto y licencias (personajes, voces, assets, Remotion). |
| [11_AUTOPILOT.md](11_AUTOPILOT.md) | Autopiloto: noticias/evergreen -> guion -> SFX -> graficos -> publicacion. |
| [10_DISTRIBUCION.md](10_DISTRIBUCION.md) | Estudio de distribucion: horarios por plataforma, formato de descripciones, hashtags, etiqueta de IA. |
| [STATUS.md](STATUS.md) | Estado de cada fase, como ejecutar, que falta. |
| [adr/](adr/) | Decisiones de arquitectura. |
| [plan/](plan/) | PDF original del plan (v1.0, 30-09-2026). |

Estructura del repositorio:
```
assets/      characters/{teto,miku,luka,rin,len}/ backgrounds/ visuals/ logos/ memes/ sfx/ fonts/
config/      characters.json reactions.json assets.json render.json
schemas/     timeline / characters / assets / reactions / render / project / requested-voices
prompts/     director.system.md (prompt del director LLM)
projects/    demo_001/ (piloto: script.md, project.json, requested_voices.json)  manual_001/ (timeline a mano)
src/         timeline/ compositions/ components/ catalog/ validation/ director/ tts/ transcribe/ audio/ pipeline/ utils/
scripts/     analyze-script generate-voices transcribe build-timeline validate render generate studio smoke doctor catalog ...
tests/       vitest + fixtures/
output/      entregables por proyecto (ignorado por git)
```

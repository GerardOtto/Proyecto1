# ADR 0001 — Timeline (QUE) vs RenderPlan (COMO)

- Estado: aceptado (2026-10-01)

## Contexto
El plan exige que la IA decida que ocurre y el motor como ocurre, con renders deterministas.

## Decision
- `timeline.json` (schema JSON) solo contiene decisiones narrativas por ID: escenas, personajes,
  reacciones, visuales, eventos y tiempos en ms.
- `src/timeline/plan.ts` compila timeline + catalogo resuelto + `config/render.json` a un
  `RenderPlan` en frames con rutas, lados, escalas, paginas de subtitulos y efectos. Es puro y
  determinista (testeado por hash).
- Los componentes de Remotion solo leen el plan.
- Colores, escalas y anclajes de personajes viven en `config/characters.json`; el timeline no puede
  sobrescribirlos (el schema no tiene esos campos).

## Consecuencias
- Un defecto visual se corrige en el compilador o el componente, no en el timeline.
- El plan se guarda (`render-plan.json`) para depurar; su hash entra en el reporte.

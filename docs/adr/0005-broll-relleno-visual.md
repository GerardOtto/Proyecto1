# ADR 0005 — B-roll: el area de visuales nunca queda vacia

- Estado: aceptado (2026-10-01)

## Contexto
En formato corto, los tramos sin visual en la mitad superior se sienten "muertos" y bajan la
retencion. El guion solo declara visuales donde aportan informacion; el resto del tiempo el area
quedaba vacia.

## Decision
- Nuevo tipo de asset `broll` (video o GIF, sin audio). El timeline declara `meta.broll` (lista de
  IDs). Se elige en el front matter (`broll: a, b, c` o `none`) o en `project.json`; si no se
  declara, se usan todos los `broll` del catalogo en orden de ID. El LLM no lo elige.
- El **motor** decide donde va (`src/timeline/plan.ts`): `brollGaps` calcula los huecos sin visual
  ni meme y `fillBroll` los rellena con tramos de `events.broll.clipMs` (3.5 s), rotando clips; un
  resto menor que `minMs` se suma al tramo anterior. Cada reutilizacion de un clip arranca en otro
  punto; los clips mas cortos que el tramo van en loop. Todo puro y determinista.
- `BRoll.tsx` solo dibuja: tarjeta con el marco de los visuales, video mudo tipo "cover".
- Material: clips CC0/dominio publico de Wikimedia Commons, recortados a 4:3 y re-codificados
  (H.264, GOP corto, sin B-frames), con pagina de origen, autor y licencia en el catalogo.

## Revision (relleno contextual)
- Los clips genericos se sentian desconectados de lo que se dice. Ahora cada bloque puede declarar
  su propio relleno (`[BROLL: a, b]` -> `scene.broll`): capturas de noticias, paginas y graficos
  oficiales de las entidades mencionadas, y GIFs de gatos con gafas tecleando. `brollPieces` corta
  los huecos por escena y `splitEven` reparte el tramo entre todos los elementos de la escena; el
  `meta.broll` queda como pozo de respaldo (`fillBroll`).
- `broll` admite imagenes (kind `image`), que se animan con un zoom lento (Ken Burns).
- Las capturas y GIFs no son CC0: se registran con su URL de origen y `license_status: unknown`
  (cita/uso informativo), por lo que el reporte los marca para revision antes de monetizar.

## Consecuencias
- Los visuales y memes del guion siempre tienen prioridad: el b-roll nunca se superpone.
- Agregar clips no cambia guiones existentes salvo los que usan el valor por defecto (todos).
- `RenderPlan` gana el campo `broll`; los planes antiguos sin el campo se dibujan sin relleno.

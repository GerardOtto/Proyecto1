# ADR 0012 — Mundo del canal: escenarios, narrativas secundarias, memes de la comunidad y coherencia

- Estado: aceptado (2026-10-01). Amplia ADR 0007 (autopiloto) y ADR 0011 (contexto de personajes).

## Contexto
El usuario quiere que los videos se distingan de un "AI slop" generico:
- Mas lore: chistes y guiños entre personajes, sus origenes y memes de la comunidad (Teto pera, Gumi,
  Mesmerizer, Rabbit Hole, Triple Baka...), con fines humoristicos.
- Videos de al menos 65 s (no hace falta quedarse bajo 90 s), con el gancho rapido y sobrecargado.
- Una narrativa secundaria de muchos episodios: Neru consigue su voz poco a poco; el capitulo en que
  la obtiene llega solo despues de al menos 10 videos.
- Escenarios variados (playa, cafeteria, oficina, parque...) donde los personajes saben donde estan.
- Personajes, tema, escenario, chistes y referencias relacionados a un nivel decente.

## Decision
- **Lore** (`config/autopilot/lore.json`): trasfondo por personaje, dinamicas compartidas con minimo de
  coincidencia (trio baka, Teto comilona, duo de Mesmerizer, Kagamine espejo...), `community` (memes y
  canciones: solo nombre o guiño de 2-3 palabras, nunca letras largas) y `affinities` (temas con los que
  conecta cada personaje). El brief solo incluye lo de los personajes del episodio; Gumi (sin avatar)
  siempre, como mencion o sticker.
- **Escenarios** (`config/autopilot/settings.json`): 8 lugares + el estudio, cada uno con fondo,
  tags tematicos y pistas de "conciencia del lugar". `chooseSetting` elige por afinidad con el tema y
  la lista de la categoria, sin repetir el anterior. El fondo del escenario manda sobre el del tema
  visual. Fondos propios en HTML (`assets/backgrounds/src/`, `npm run graphics`), licencia owned,
  reemplazables por arte real.
- **Narrativas secundarias** (`config/autopilot/arcs.json`): `neru_voice` con etapas por numero de
  apariciones previas de Neru (Solo celular -> Intentos -> Mensajes -> Casi). El brief pide UN momento
  breve por episodio sin resolver el arco. El final (Neru con voz propia) nunca es automatico: requiere
  decision humana, su voz configurada y al menos 10 videos. Cameo de Neru: probabilidad 0.5.
- **Casting con afinidad**: a igualdad de rotacion, se prefieren parejas cuya afinidad coincide con
  las etiquetas del tema (categoria, entidades, palabra clave).
- **Duracion y ritmo**: minimo 65 s en escritores y lint (SHORT < 66 s estimados), objetivos de formato
  80-90 s; el gancho sobrecargado sigue obligatorio. El motor mantiene el limite duro 60-120 s.
- **Coherencia**: seccion fija en el brief y reglas en `prompts/writer.system.md`.

## Consecuencias
- Los episodios del autopiloto llevan `setting` y `arcs` en el plan y el historial (`history.json`).
- Los datos del lore deben verificarse antes de ampliarlos (nada inventado).
- El escritor de plantilla (offline) usa el fondo del escenario pero no escribe chistes de lugar ni de
  lore: eso lo hacen el escritor LLM o el manual.

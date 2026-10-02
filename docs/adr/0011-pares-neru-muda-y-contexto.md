# ADR 0011 — Imagenes en pares, personajes mudos (Neru) y contexto pasivo de personajes

- Estado: aceptado (2026-10-01). Modifica ADR 0008 (Neru como foil/guest) y la reserva de `sfx_neru_phone`.

## Contexto
El usuario definio tres reglas para los proximos episodios:
1. Las imagenes de dos personajes juntos (tablero "pares" de Pinterest) pueden usarse si **ambos**
   personajes aparecen en el video.
2. Neru no tiene voicebank oficial: su unica "voz" es el sonido del celular (`sfx_neru_phone`).
3. Los guiones incluyen el contexto de los personajes de forma **pasiva** (Triple Baka, Neru sin
   voicebank, Teto se considera gorda, etc.), tambien en los guiones aun no producidos.

## Decision
- **Pares**: 18 imagenes en `assets/characters/pares/` como assets `image` `pair_<a>_<b>_<accion>` con
  el campo nuevo `characters` (schema de assets). Se usan con `[VISUAL:]`, `{SHOW:}` o `{STICKER:}`.
  Error `PAIR_CHARACTER_ABSENT` si alguno de sus personajes no aparece en el video (hablante o
  listener, incluido el listener automatico). Se omiten las de Meiko (no es personaje del canal).
- **Personajes mudos**: `characters.json > voice.mute` y `voice.signatureSfx` (Neru: `sfx_neru_phone`).
  Error `MUTE_CHARACTER_SPEAKS` si tiene dialogo; aviso `SIGNATURE_SFX_WITHOUT_OWNER` si su SFX suena
  sin ella en pantalla. El SFX deja de estar "reservado" (tag `solo_personaje`: el director de SFX
  automatico no lo usa).
- **Casting**: Neru sale de los roles con dialogo (foil/guest) y entra como **cameo** mudo
  (`casting.json > cameo`, probabilidad 0.35): listener que "contesta" con
  `{REACT:neru:x}{SFX:sfx_neru_phone}`. El escritor de plantilla la pone en el remate; el LLM/manual
  recibe instrucciones en el brief.
- **Contexto**: `config/autopilot/lore.json` (reglas + datos por personaje + contexto compartido con
  minimo de coincidencia, p. ej. Triple Baka con 2 de Miku/Teto/Neru). El brief del escritor
  (`writer-brief.md` y LLM) incluye solo el de los personajes del episodio y las imagenes en pares
  disponibles. `prompts/writer.system.md`: 1-2 referencias pasivas por episodio, sin explicar, sin
  inventar; el peso de Teto solo lo menciona ella.

## Consecuencias
- Los 5 guiones sin producir llevan 1-2 guinos pasivos (puerro, baguette, atun, "31 anos", rivalidad
  Teto-Miku, "estoy gorda").
- Los datos del lore deben verificarse antes de ampliarlos (nada inventado).

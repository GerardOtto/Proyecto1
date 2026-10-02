---
title: ¿Miku es una IA?
hook_title: ¿*Vocaloid* es inteligencia artificial?
target: 85
background: palette
background_style: suave
broll: broll_v_miku_hologram, broll_v_teto_utau, broll_v_teto_synthv, broll_v_triple_baka, broll_v_miku_confused
language: es
---
<!-- autopilot ep_20261002_vocaloid_tech | formato concept_lesson | tema vocaloid_tech | fuentes: https://en.wikipedia.org/wiki/Vocaloid https://en.wikipedia.org/wiki/Hatsune_Miku https://en.wikipedia.org/wiki/Kasane_Teto -->
// v1 (orquestador Claude, 2026-10-02): reescrito con docs/12_GUIA_PRODUCCION.md sobre el borrador de plantilla.
// Elenco: Miku (la "acusada", interrumpe con vine boom), Luka (explica), Teto invitada (su origen es la mitad del tema), Neru (beat propio, arco "Intentos").
// Casos reales: voz de Saki Fujita, Coachella 2024 (holograma != IA), Teto en Synthesizer V (2023). Escenario: parque (banca).
// Despedida reutilizada palabra por palabra (Miku de Busqueda binaria, Teto de Docker/Log4Shell): sin costo de voz.
// v2 (2026-10-02): Correcciones.txt + Notas de voz. Sin referencias al lugar (fondos de color). Luka con dos voces (ADR 0015):
// base (muestra 0, x1.2) en frases cortas y calmadas; [VOICE:fluida] (muestra 5, sin acelerar) en explicaciones largas.
// Se conservan palabra por palabra sus dos tomas buenas ("Saki Fujita" y "Eras una animacion"). "2007." ya no cierra
// la frase (salia "sush"). Teto: "¿Eh? ¿Neru intento hablar?" como una sola frase de sorpresa. Gancho: gato oscuro.
// v3 (2026-10-02): Notas del usuario. UNA sola voz de Luka por video: la fluida (muestra 5) en todas sus lineas,
// la mas eficiente en v2 (3 de 4 destacadas). Se regeneran con ella "Tranquila", "Saki Fujita" y "Eras una animacion".
// La linea que sono cantada y aguda ("Y una persona escribe todo a mano... Cero IA") se reescribe en prosa, sin lista.
// v4 (2026-10-02): "Tranquila, Miku." sonaba cantada -> frase corrida sin punto intermedio; "Tu voz es..." y
// "Y la melodia..." a [TEMPO:1.5] (el usuario las aprobo aceleradas x1.5; local, sin regenerar). Sin corte por clausulas.
// v5 (2026-10-02): "No te asustes, Miku..." con el MODELO 0 (voz base de Luka), toma 3 elegida por el usuario
// entre 7 (Tomas - No te asustes, Miku/), a x1.2 extra. Excepcion consciente a "una voz por video" (aviso VOICE_MIXED).
// v6 (2026-10-02): "Vocaloid es un programa..." tambien con el MODELO 0 (toma 2 elegida por el usuario, a x1.32 normal).
// v7 (2026-10-02): TODA Luka con el MODELO 0 (una voz por video otra vez); tomas elegidas por el usuario en
// "Escucha antes de renderizar": actriz t3 x1.1, recorta t1 x1.2, melodia (sin la "Y", que leia en ingles) t1 x1.1,
// animacion = favorita v1, cierre t3 x1.3.
// v8 FINAL (2026-10-02): 12 stickers ("stickers x3", aprobado en vista previa) y video completo a x1.1 (project.json > outputSpeed).
// Assets nuevos: vocaloid_logo, synthv_logo, diagram_vocaloid_recortes, diagram_teto_timeline, broll_v_miku_hologram, broll_v_teto_utau, broll_v_teto_synthv.

## hook
[MIKU:shocked]
[VISUAL: vocaloid_logo]
{SFX:sfx_dramatic_boomer:0.7}{SHAKE}¡Papu papu! ¿*Vocaloid* es inteligencia artificial? {SFX:sfx_oohh:0.6}{ZOOM}¿O sea que yo soy una IA?

## reaction
[MEME:meme_gato_oscuro:sfx_among_us_reveal]

## context
[LUKA:nerd]
[LISTEN: miku:shocked]
[BROLL: broll_v_luka_smug]
[TEMPO:1.2]
No te asustes, Miku, que te lo explico como a una niña.

[LUKA:nerd]
[LISTEN: miku:confundido]
[VISUAL: vocaloid_logo]
Vocaloid es un programa de Yamaha para hacer cantar a la {STICKER:meme_gato_nerd}computadora. Tú saliste en 2007, hace casi veinte años.

## development
[MIKU:enojado]
[LISTEN: luka:neutral]
[BROLL: broll_v_miku_confused]
{SFX:sfx_vine_boom:0.55}¿Un programa? ¡Pero si yo canto solita!{STICKER:meme_miku_puerro}

[LUKA:presumido]
[LISTEN: miku:sorprendido]
[VISUAL: diagram_vocaloid_recortes]
[TEMPO:1.1]
Tu voz es de una actriz real, Saki Fujita. Grabó cientos de sílabas, {SFX:sfx_pop:0.4}una por una.

[MIKU:confundido]
[LISTEN: luka:neutral]
[BROLL: broll_v_miku_thinking]
{SFX:sfx_record_scratch:0.45}¿Sílabas sueltas?{STICKER:meme_gato_buho} ¿Y cómo salen canciones?

[LUKA:nerd]
[LISTEN: miku:pensando]
[VISUAL: diagram_vocaloid_recortes]
[TEMPO:1.2]
{ZOOM}El programa las recorta y las pega nota por nota, como letras recortadas de revista.

[LUKA:feliz]
[LISTEN: miku:sorprendido]
[BROLL: broll_v_miku_typing]
[TEMPO:1.1]
La melodía y la letra las escribe una persona, {SFX:sfx_ding:0.45}no una IA.

[MIKU:shocked]
[LISTEN: luka:neutral]
[BROLL: broll_v_miku_hologram]
{SHAKE}{SFX:sfx_vine_boom:0.55}¿Y mi concierto en Coachella? ¡Eso fue real!

[LUKA:presumido]
[LISTEN: miku:decepcionado]
[BROLL: broll_v_miku_hologram]
Eras una animación proyectada, con música hecha por humanos. {STICKER:meme_gato_tarjeta_roja}Holograma no es IA.{SFX:sfx_rizz:0.45}

## visual
[TETO:emocionado]
[LISTEN: miku:sorprendido]
[VISUAL: diagram_teto_timeline]
{SFX:sfx_teto_teetoo:0.5}¡Y luego estoy yo! Nací como {STICKER:meme_pera}broma del Día de los Inocentes de 2008: una Vocaloid nueva... que no existía.

[MIKU:shocked]
[LISTEN: teto:feliz]
[BROLL: broll_v_miku_surprised]
{SFX:sfx_vine_boom:0.55}¿Eras una broma?{STICKER:meme_gato_parado} ¿Y sigues aquí?

[TETO:feliz]
[LISTEN: miku:confundido]
[BROLL: broll_v_teto_utau]
Porque a los fans les gustó tanto que me hicieron voz de verdad, en UTAU, gratis.{SFX:sfx_yippee:0.4}

[NERU:feliz]
[LISTEN: teto:sorprendido]
[BROLL: broll_v_neru_phone]
[SFX:sfx_neru_phone]
[PAUSE:1000]

[TETO:sorprendido]
[LISTEN: neru:feliz]
[BROLL: broll_v_neru_phone, broll_v_triple_baka]
¿Eh? ¿Neru intentó hablar? Ah, no: dice que si los fans me hicieron voz, ella quiere una.{STICKER:meme_neru_phone:sfx_gato_riendo:0.45}

## development
[MIKU:confundido]
[LISTEN: teto:neutral]
[BROLL: broll_v_miku_confused]
{SFX:sfx_record_scratch:0.45}Entonces, ¿dónde está la IA en todo esto?

[TETO:nerd]
[LISTEN: miku:sorprendido]
[BROLL: broll_v_teto_synthv]
{SHOW:synthv_logo}Llegó después: en 2023 estrené voz en Synthesizer V, {HIDE:synthv_logo}con una red neuronal que aprendió de una voz humana {SFX:sfx_anime_wow:0.4}real.

[MIKU:shocked]
[LISTEN: teto:feliz]
[BROLL: broll_v_miku_surprised]
{SHAKE}{SFX:sfx_vine_boom:0.55}¿O sea que Teto es más IA que yo?{STICKER:meme_pera_mordida}

[TETO:riendo]
[LISTEN: miku:enojado]
[BROLL: broll_v_teto_dance]
Por fin te gano en algo.{SFX:sfx_oohh:0.55}{STICKER:meme_teto_risa}

## punchline
[MIKU:emocionado]
[LISTEN: teto:riendo]
[BROLL: broll_v_miku_dance]
Pues yo sigo siendo la más famosa.{SFX:sfx_rizz:0.45}

[TETO:riendo]
[LISTEN: miku:riendo]
[BROLL: broll_v_teto_baguettes]
Y yo la que más baguettes {STICKER:meme_nugget}come. Cada quien con su récord.{SFX:sfx_rimshot:0.45}

## closing
[LUKA:feliz]
[LISTEN: miku:feliz]
[VISUAL: ep_main]
[TEMPO:1.3]
Así que no: Miku no es una IA. Detrás de cada voz sintética {STICKER:pair_miku_luka_cantando}hay una persona.{SFX:sfx_ding:0.45}

[MIKU:feliz]
[LISTEN: teto:feliz]
[VISUAL: cta_follow_like]
¡Papu papu! Si te sirvió, déjanos tu Me gusta.{STICKER:meme_miku_yippee}

[TETO:feliz]
[LISTEN: miku:feliz]
[VISUAL: cta_follow_like]
Y síguenos para más IA y computación explicada sin drama. ¡Nos vemos, Papus!

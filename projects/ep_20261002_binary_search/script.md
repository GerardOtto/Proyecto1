---
title: Búsqueda binaria
hook_title: *Búsqueda binaria*: un millón de datos en 20 pasos
target: 75
background: bg_foto_parque_neru
broll: broll_binary_vs_sequential, broll_v_miku_dance
language: es
---
<!-- autopilot ep_20261002_binary_search | formato concept_lesson | tema binary_search | fuentes: https://en.wikipedia.org/wiki/Binary_search -->
// v2 (orquestador Claude, 2026-10-02): correcciones del usuario en Prototipos/2 - Búsqueda binaria/Correcciones.txt.
// Luka con voice.tempo 1.2 (sus audios previos se aceleran en local, sin regenerar). Regenerados: gancho
// (no sonaba a Luka), Big O explicado sin jerga, despedida (se entrecortaba). Nuevas: puerro de Miku en el
// parque, "cero trampa", atun de Luka. "¿Y si la lista esta desordenada?" va justo antes de su respuesta.
// v3 (2026-10-02): fondo del usuario (bg_foto_parque_neru), "Cada paso tira..." x1.5 ([TEMPO:1.5], en local) y GIF de Vocaloid.

## hook
[LUKA:sorprendido]
[VISUAL: ep_main]
{SFX:sfx_dramatic_boomer:0.7}{SHAKE}¡Papu papu! {ZOOM}*Búsqueda binaria*: ¡un millón de datos en solo {SFX:sfx_anime_wow:0.45}20 pasos!

## reaction
[MEME:meme_gato_sorprendido:sfx_oohh]

## context
[LUKA:nerd]
[LISTEN: miku:neutral]
[BROLL: broll_binary_vs_sequential]
La búsqueda binaria encuentra un valor en una lista ordenada partiéndola a la mitad en cada paso.

## development
[MIKU:confundido]
[LISTEN: luka:neutral]
[BROLL: broll_v_miku_thinking]
{SFX:sfx_vine_boom:0.5}Espera. ¿Eso me sirve para encontrar mi puerro? Lo perdí aquí en el parque.{STICKER:meme_miku_puerro:sfx_huh_cat:0.5}

[LUKA:riendo]
[LISTEN: miku:confundido]
Si los puerros estuvieran en orden, sí. Mira.

[LUKA:nerd]
[LISTEN: miku:neutral]
[BROLL: broll_binary_vs_sequential]
Miras el elemento del {SFX:sfx_pop:0.4}medio: si lo que buscas es menor, descartas toda la mitad {SFX:sfx_pop:0.4}derecha; si es mayor, la {SFX:sfx_pop:0.4}izquierda.

[MIKU:pensando]
[LISTEN: luka:neutral]
[BROLL: broll_v_miku_thinking]
Mmm, ya voy entendiendo.{STICKER:meme_gato_nerd}

## visual
[LUKA:nerd]
[LISTEN: miku:neutral]
[VISUAL: chart_linear_vs_binary]
[TEMPO:1.5]
{ZOOM}Cada paso tira a la basura la mitad de lo que queda. Por eso, aunque los datos se dupliquen, solo necesitas {SFX:sfx_ding:0.45}un paso más.

[LUKA:feliz]
[LISTEN: miku:sorprendido]
[VISUAL: chart_linear_vs_binary]
Con mil elementos bastan unas diez comparaciones, y con un millón, unas {SFX:sfx_anime_wow:0.4}veinte.

## development
[MIKU:shocked]
[LISTEN: luka:neutral]
[BROLL: broll_math_lady, broll_v_miku_surprised]
{SHAKE}{SFX:sfx_vine_boom:0.55}¿Veinte pasos? ¿No será trampa?

[LUKA:presumido]
[LISTEN: miku:confundido]
[BROLL: broll_v_luka_smug]
Cero trampa: son matemáticas, Miku.{SFX:sfx_rizz:0.45}

[MIKU:confundido]
[LISTEN: luka:neutral]
[BROLL: broll_v_miku_confused]
{SFX:sfx_record_scratch:0.45}¿Y si la lista está desordenada?

[LUKA:nerd]
[LISTEN: miku:pensando]
La condición es que los datos estén ordenados. Por eso las bases de datos usan índices ordenados para buscar rápido.

## punchline
[MIKU:shocked]
[LISTEN: luka:neutral]
{SHAKE}{SFX:sfx_vine_boom:0.55}Ok, aplicaré búsqueda binaria para encontrar mis calcetines.

[LUKA:riendo]
[LISTEN: miku:riendo]
Primero tendrías que ordenarlos, papu.{SFX:sfx_rimshot:0.45}

[LUKA:presumido]
[LISTEN: miku:sorprendido]
[BROLL: broll_v_luka_tuna]
Yo tengo mis latas de atún ordenadas por fecha. Prioridades.{STICKER:meme_luka_cheer:sfx_gato_riendo:0.45}

## closing
[LUKA:feliz]
[LISTEN: miku:feliz]
[BROLL: broll_v_miku_dance]
Ordenar primero te permite buscar muchísimo más rápido.{SFX:sfx_ding:0.45}

[MIKU:feliz]
[LISTEN: luka:feliz]
[VISUAL: cta_follow_like]
¡Papu papu! Si te sirvió, déjanos tu Me gusta.{STICKER:meme_miku_yippee}

[LUKA:feliz]
[LISTEN: miku:feliz]
[VISUAL: cta_follow_like]
Y síguenos para más IA y computación, explicada sin drama. ¡Nos vemos, Papus!

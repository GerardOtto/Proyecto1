---
title: Docker y los contenedores
hook_title: ¿Qué es *Docker*? Adiós a 'en mi máquina funciona'
target: 75
background: palette
background_style: suave
broll: broll_docker_whale, broll_v_teto_laptop, broll_v_miku_typing
language: es
---
<!-- autopilot ep_20261002_docker | formato concept_lesson | tema docker | fuentes: https://en.wikipedia.org/wiki/Docker_(software) -->
// v2 (orquestador Claude, 2026-10-02): correcciones del usuario en Prototipos/1 - Docker/Correcciones.txt.
// Lineas sin cambios = mismo audio (ADR 0013). Nuevas: gancho (pausa antes de la cita), apisonadora de Rin,
// cafe para llevar, baguette de Teto, Luka (Docker con mayuscula), beat de Neru y su traduccion.
// v3 (2026-10-02): fondo foto del usuario (retirado en v4), gato nerd en lugar de "it works on my machine",
// foto real del portacontenedores, tubo de metal mas bajo y GIF de Vocaloid arriba. Textos iguales = mismo audio.
// v4 (2026-10-02): fondo de paleta de personajes (background: palette, estilo suave; ADR 0014), sin fotos.

## hook
[TETO:sorprendido]
[VISUAL: docker_logo]
{SFX:sfx_dramatic_boomer:0.7}{SHAKE}¡Papu papu! ¿Qué es {SFX:sfx_oohh:0.6}{ZOOM}*Docker*? Adiós a... {PAUSE:300}{SFX:sfx_windows_error:0.45}'en mi máquina funciona'

## reaction
[MEME:meme_gato_nerd:sfx_vine_boom]

## context
[TETO:nerd]
[LISTEN: rin:neutral]
[BROLL: broll_v_miku_typing, broll_v_miku_bluescreen]
Un clásico de la programación: el código funciona en tu computadora, pero {SFX:sfx_windows_error:0.4}falla en la del compañero o en el servidor.

## development
[RIN:confundido]
[LISTEN: teto:neutral]
[BROLL: broll_v_miku_confused]
{SFX:sfx_record_scratch:0.45}¿Por qué funciona en mi máquina y en la tuya no?{SFX:sfx_huh_cat:0.5}

[TETO:nerd]
[LISTEN: rin:confundido]
[BROLL: broll_v_teto_pc_glasses]
Suele pasar por diferencias de versiones, librerías o configuración entre máquinas.

[RIN:presumido]
[LISTEN: teto:sorprendido]
[BROLL: broll_road_roller, broll_v_rin_road_roller]
¡Fácil! Le paso mi {SFX:sfx_metal_pipe:0.35}apisonadora al servidor y listo.

[TETO:riendo]
[LISTEN: rin:presumido]
[BROLL: broll_v_rinlen_road_roller, broll_v_teto_laptop]
Guarda la apisonadora, Rin. Mejor pide tu programa para llevar, como este café.{SFX:sfx_pop:0.4}

## visual
[TETO:nerd]
[LISTEN: rin:neutral]
[VISUAL: ep_main]
{ZOOM}Un contenedor empaqueta la aplicación junto con todas sus dependencias y configuración, como una caja cerrada.

## development
[RIN:confundido]
[LISTEN: teto:feliz]
[BROLL: broll_container_ship_photo]
¿Una caja con mi programa adentro?{SFX:sfx_oohh:0.6}

[TETO:feliz]
[LISTEN: rin:sorprendido]
[BROLL: broll_docker_whale]
Docker popularizó los contenedores a partir de 2013, y hoy son la base de buena parte de la {SFX:sfx_anime_wow:0.4}nube.

[RIN:feliz]
[LISTEN: teto:feliz]
[BROLL: broll_v_rinlen_dance]
Ok, eso tiene sentido.{STICKER:meme_rin_fist_pump:sfx_yippee:0.45}

[TETO:nerd]
[LISTEN: rin:neutral]
[VISUAL: diagram_vm_vs_container]
Son más ligeros que una máquina virtual completa, porque comparten el núcleo del sistema operativo.

[TETO:timido]
[LISTEN: rin:riendo]
[BROLL: broll_teto_baguette, broll_v_teto_baguettes]
Más ligeros... como yo si dejara las baguettes. {STICKER:meme_pera:sfx_bruh:0.6}Spoiler: no las dejo.

[LUKA:presumido]
[LISTEN: teto:sorprendido]
[VISUAL: docker_logo]
Y ojo con esto: *Docker* no elimina los bugs, pero sí la excusa de 'en mi máquina funciona'.{SFX:sfx_rizz:0.45}

## punchline
[RIN:shocked]
[LISTEN: teto:neutral]
{SHAKE}{SFX:sfx_vine_boom:0.55}Entonces le pondré Docker a mi vida para que funcione igual en todas partes.

[TETO:riendo]
[LISTEN: rin:riendo]
[BROLL: broll_v_teto_dance]
Ni Docker puede contenerte, papu.{SFX:sfx_rimshot:0.45}{STICKER:meme_teto_risa}

[NERU:feliz]
[LISTEN: teto:sorprendido]
[BROLL: broll_v_neru_phone]
[SFX:sfx_neru_phone]
[PAUSE:1000]

[TETO:riendo]
[LISTEN: neru:feliz]
[BROLL: broll_v_neru_phone, broll_v_triple_baka]
Neru dice que su contenedor favorito es su celular: de ahí no sale.{STICKER:meme_neru_phone:sfx_gato_riendo:0.45}

## closing
[RIN:feliz]
[LISTEN: teto:feliz]
[VISUAL: cta_follow_like]
¡Papu papu! Si te sirvió, déjanos tu Me gusta.

[TETO:feliz]
[LISTEN: rin:feliz]
[VISUAL: cta_follow_like]
Y síguenos para más IA y computación explicada sin drama. ¡Nos vemos, Papus!

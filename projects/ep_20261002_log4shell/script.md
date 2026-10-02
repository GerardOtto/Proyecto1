---
title: Log4Shell
hook_title: *Log4Shell*: hackear un servidor con un mensaje
target: 85
background: bg_foto_oficina
broll: broll_hacker_typing, broll_v_teto_laptop, broll_it_crowd_fire, broll_this_is_fine
language: es
---
<!-- autopilot ep_20261002_log4shell | formato controversy_story | tema log4shell | fuentes: https://en.wikipedia.org/wiki/Log4Shell https://www.minecraft.net/en-us/article/important-message--security-vulnerability-java-edition -->
// v2 (orquestador Claude, 2026-10-02): correcciones del usuario en Prototipos/3 - Log4Shell/Correcciones.txt.
// Pronunciacion (config/pronunciations.json): Log4Shell -> "Log four shell", Log4j -> "Log four jay"; solo se
// regeneran las lineas que los contienen. Nuevo: caso Minecraft (hecho verificado), cuaderno del jefe (oficina),
// orden pregunta -> respuesta en dependencias, muñecas rusas y beat propio de Neru.
// v3 (2026-10-02): fondo del usuario (bg_foto_oficina), muñecas rusas (Matryoshka de Hachi/GUMI), GIF de Vocaloid;
// la pausa larga de Len ("¿En Minecraft? ... Ahora si es personal") la acorta el motor (render.audio.voicePauseCap).

## hook
[TETO:shocked]
[VISUAL: log4j_logo]
{SFX:sfx_dramatic_boomer:0.7}{SHAKE}¡Papu papu! {SFX:sfx_typing:0.45}*Log4Shell*: hackear un servidor... {SFX:sfx_oohh:0.6}{ZOOM}con un simple mensaje de chat.

## reaction
[MEME:meme_gato_oscuro:sfx_among_us_reveal]

## context
[TETO:nerd]
[LISTEN: len:neutral]
[VISUAL: log4j_logo]
Log4j es una librería de Java para registrar mensajes, los famosos logs. La usan millones de aplicaciones.

## development
[LEN:confundido]
[LISTEN: teto:neutral]
¿Logs? ¿Como el cuaderno donde el jefe de esta oficina anota quién llega tarde?{SFX:sfx_huh_cat:0.5}

[TETO:feliz]
[LISTEN: len:neutral]
[BROLL: broll_v_teto_laptop]
Exacto, pero los programas anotan todo lo que pasa. Todo.{SFX:sfx_typing:0.35}

[TETO:sorprendido]
[LISTEN: len:neutral]
En diciembre de 2021 se descubrió {SFX:sfx_among_us_reveal:0.45}Log4Shell, un fallo gravísimo en esa librería.

[LEN:shocked]
[LISTEN: teto:sorprendido]
[BROLL: broll_v_len_shocked_chibi]
{SFX:sfx_vine_boom:0.5}¡No puede ser!

## visual
[TETO:nerd]
[LISTEN: len:neutral]
[VISUAL: diagram_log4shell_chat]
{ZOOM}Bastaba con que la aplicación registrara un texto especial, por ejemplo escrito en un chat, para ejecutar código remoto.

## development
[LEN:confundido]
[LISTEN: teto:neutral]
[BROLL: broll_hackerman]
{SFX:sfx_record_scratch:0.45}¿Un mensaje en un chat podía hackear un servidor?

[TETO:nerd]
[LISTEN: len:sorprendido]
[BROLL: broll_minecraft_advisory]
Sí. El caso más famoso fue {SHOW:minecraft_logo}{SFX:sfx_villager_hmm:0.6}Minecraft: un mensaje en el chat del juego bastaba para atacar servidores.{HIDE:minecraft_logo}

[LEN:shocked]
[LISTEN: teto:nerd]
[BROLL: broll_v_len_shocked]
{SHAKE}{SFX:sfx_fahh:0.45}¿En Minecraft? Ahora sí es personal.{STICKER:meme_len_banana}

[TETO:sorprendido]
[LISTEN: len:shocked]
[VISUAL: ep_main]
Recibió la puntuación máxima de gravedad, diez sobre diez, y equipos de todo el mundo {HIDE:ep_main}trabajaron días para parchear.

[LEN:confundido]
[LISTEN: teto:neutral]
[BROLL: broll_this_is_fine]
¿Y por qué no lo arreglaron en cinco minutos?

[TETO:nerd]
[LISTEN: len:confundido]
[BROLL: broll_xkcd_dependency]
Muchas empresas ni sabían que usaban Log4j, porque venía escondida dentro de otras dependencias.

[LEN:confundido]
[LISTEN: teto:neutral]
¿Cómo no sabes qué librerías usas?{SFX:sfx_oohh:0.55}

[TETO:feliz]
[LISTEN: len:pensando]
[BROLL: broll_russian_dolls, broll_v_matryoshka_gumi]
Porque cada librería trae otras librerías adentro, como muñecas rusas.{SFX:sfx_pop:0.4}

[NERU:feliz]
[LISTEN: teto:sorprendido]
[BROLL: broll_v_neru_phone]
[SFX:sfx_neru_phone]
[PAUSE:1000]

[TETO:riendo]
[LISTEN: neru:feliz]
[BROLL: broll_v_neru_phone, broll_v_triple_baka]
Neru dice que ella sí revisa sus dependencias... desde el celular, en plena reunión.{STICKER:meme_neru_phone:sfx_gato_riendo:0.45}

## punchline
[LEN:shocked]
[LISTEN: teto:neutral]
[BROLL: broll_it_crowd_fire]
{SHAKE}{SFX:sfx_vine_boom:0.55}Entonces los logs, que eran para encontrar errores, eran el error.

[TETO:riendo]
[LISTEN: len:riendo]
[BROLL: broll_v_teto_dance]
Ironía nivel diez de diez.{SFX:sfx_rimshot:0.45}{STICKER:meme_teto_risa}

## closing
[TETO:feliz]
[LISTEN: len:feliz]
[BROLL: broll_v_teto_pc_glasses]
Revisa tus dependencias: una librería pequeña puede abrir la puerta grande.{SFX:sfx_ding:0.45}

[LEN:feliz]
[LISTEN: teto:feliz]
[VISUAL: cta_follow_like]
¡Papu papu! Si te sirvió, déjanos tu Me gusta.

[TETO:feliz]
[LISTEN: len:feliz]
[VISUAL: cta_follow_like]
Y síguenos para más IA y computación explicada sin drama. ¡Nos vemos, Papus!

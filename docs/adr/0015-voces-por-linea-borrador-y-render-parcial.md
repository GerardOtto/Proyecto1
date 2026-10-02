# ADR 0015 — Voces alternativas por linea, render borrador y render parcial

- Estado: aceptado (2026-10-02). Amplia ADR 0013 (reutilizacion de voz) y ADR 0002 (el audio manda).

## Contexto
Revision de "¿Miku es una IA?" (v1):
- Luka sonaba inestable: silaba por silaba, como si cantara, una vez como "otra mujer" y un "sush" al
  final de "2007.". Su voz de Fish (`3a7bf294...`) es un modelo **japones** de ejercicios de diccion.
  El usuario escucho 5 alternativas y decidio usar DOS: la actual (muestra 0) para frases cortas y
  calmadas, a x1,2, y `1243e3a8...` (muestra 5, japones/ingles) para explicaciones largas, sin acelerar.
- El render completo tardo ~374 s para 98 s de video (8 pestañas de Chrome en una maquina de 12 nucleos).
  El usuario pidio como regla: **borrador a media resolucion para revisar; 1080x1920 solo con la
  aprobacion final**. Tambien pregunto si se podia renderizar solo lo que cambio.

## Decision
1. **Variantes de voz** (`voice.variants` en characters.json): cada una reemplaza la voz de Fish y el
   ritmo de la base; lo que no defina se hereda. Se eligen por linea con `[VOICE:<nombre>]` (alias
   `[VOZ:x]`) y viajan como `scene.voiceVariant`. La clave de cache incluye el `referenceId`, asi que
   cada variante tiene su propio audio; una variante inexistente es un error claro.
2. **Calidad de render**: `draft` (por defecto en `generate`, `render` y `autopilot --produce`) usa
   `scale` de Remotion = `video.draftScale` (0.5 -> 540x960); `final` (`--final`) = 1080x1920. La
   validacion del MP4 espera la resolucion de la calidad pedida. `video.concurrency: null` = todos los
   nucleos. La carpeta de revision muestra "Video borrador.mp4" o "Video final.mp4".
3. **Render parcial** (automatico; `--full` lo desactiva). Tras cada render se guarda
   `.cache/render/<proyecto>/state.json` (plan, huella de cada archivo del plan, calidad, huella del codigo
   de render y del MP4). En el siguiente render:
   - Solo aplica si coinciden calidad, codigo de render, dimensiones, fps, **duracion** y todo lo global
     del plan (fondo, estilo, marca de agua, rotulo). El fondo, las particulas y la marca de agua se animan
     con el fotograma absoluto: un fotograma no cambiado se ve igual, pero si la duracion cambia todo se
     desplaza y no hay nada reutilizable.
   - `diffPlans` (puro, `src/timeline/plan-diff.ts`) compara las capas con tiempo (escenario, visuales,
     subtitulos, camara, memes, stickers, b-roll) como multiconjuntos y marca los tramos sucios, con 15
     fotogramas de margen. `alignToKeyframes` los ajusta a los fotogramas clave del MP4 anterior.
   - Se renderizan solo los tramos sucios (sin audio), se copian los demas del MP4 anterior sin recodificar
     y se unen con el demuxer concat. El audio se regenera completo (render solo de audio) y pasa por el
     limitador final.
   - Si cambia mas del 60 % del video, si alguna pieza no tiene los fotogramas esperados o si el MP4
     ensamblado no pasa la validacion (decodificacion, sincronia, resolucion), se renderiza completo.
4. **Sin referencias al lugar fisico** en los guiones: con fondos de color (ADR 0014) sobraban. El brief
   del escritor lo prohibe en lugar de pedir "1-2 menciones al escenario" (ADR 0012).

## Consecuencias
- Revisar cuesta un render a media resolucion, que deberia ser varias veces mas rapido. El final se hace
  una vez, con las voces ya pagadas.
- Cambios sin efecto en la duracion (sticker, imagen, subtitulo, emocion del avatar) se renderizan en
  segundos. Cambios de voz o de texto siguen requiriendo el render completo, porque mueven los tiempos.
- Un cambio en `src/components`, `src/compositions` o `src/timeline` invalida el render parcial
  (huella del codigo).

## Ampliacion (2026-10-02, revision v2 -> v3)
- **Una sola voz por personaje en cada video** (pedido del usuario): mezclar `[VOICE:x]` con la voz base
  da el aviso `VOICE_MIXED` al validar.
- **Retoma por ritmo** (`voice.minWordsPerSec`, `src/tts/retake.ts`): la voz fluida de Luka a veces "canta"
  o arrastra; esas tomas salen a ~1,6 pal/s frente a ~3 pal/s de las buenas. Una toma por debajo del minimo
  se vuelve a pedir (hasta 3) y queda la mas rapida. Si ninguna llega, la elegida se marca como aceptada
  (`.cache/tts/<clave>.accepted`) para no volver a pagar en cada produccion.
- **Sintesis por clausulas: probada y DESCARTADA.** Fue una sugerencia del usuario para la voz base de Luka,
  que silabea. Se implemento, pero al escuchar las muestras (6A/6B) el usuario prefirio la linea entera, asi
  que se retiro del motor.
- Con la voz fluida, las frases cortas con punto en medio ("Tranquila, Miku. Te lo...") tienden a salir
  cantadas; una frase corrida suena mejor. Para acelerar una linea concreta sin pagar voz nueva: `[TEMPO:x]`.
- Prueba de indicaciones de estilo en s2-pro ("[hablando con naturalidad...]"): no se leen en voz alta, pero
  su efecto en el ritmo fue irregular (1,6 a 2,5 pal/s); no se adoptaron como regla.

## Ampliacion (2026-10-02, entrega de "¿Miku es una IA?")
- **Elegir tomas en lugar de confiar en una**: el usuario escucho una carpeta "Escucha antes de renderizar"
  (3 tomas por linea, a la velocidad del video, mas las anteriores y las lineas que no cambian) y eligio
  una por linea, a veces con `[TEMPO:x]`. La toma elegida se copia a `.cache/tts/<clave>.wav` (clave =
  sha256 de `cacheTag|idioma|texto`), asi el motor la usa sin volver a pagarla. Con ese metodo, Luka quedo
  entera con el modelo 0.
- **`outputSpeed` en project.json**: acelera TODO el MP4 (imagen, voz, SFX) despues del render, como la
  vista previa aprobada (x1,1); el SRT se reescala (`src/timeline/captions-speed.ts`) y la validacion espera
  la duracion acelerada. Como el MP4 acelerado no sirve de base, desactiva el render parcial.
- **Contador de costo**: `report.json > voices.providerCalls` cuenta las llamadas reales al proveedor;
  `generated` incluia lineas sacadas de `.cache/tts`, que no cuestan.

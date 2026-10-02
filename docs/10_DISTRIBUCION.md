# 10 — Estudio de distribución: horarios de publicación y formato de descripciones

Fecha: 2026-10-01 · Cuenta: **@tetociencia** · Plataformas: TikTok, Instagram Reels, YouTube Shorts.

> Resumen ejecutivo
> 1. **Audiencia objetivo: Latinoamérica hispanohablante, con México como mercado principal.** El tono
>    ("¡Papu papu!") y el tamaño del mercado (85–99 M de usuarios de TikTok en México) lo indican.
>    Todos los horarios de este documento están en **hora de CDMX (UTC-6, sin horario de verano)**.
> 2. **TikTok primero, Reels al día siguiente y Shorts dos días después.** TikTok es la plataforma
>    principal: allí la Generación Z hispana busca respuestas, y los videos de más de 60 s entran en
>    el programa de monetización (Creator Rewards).
> 3. **Horarios de partida:** TikTok martes y jueves 19:30 y domingo 10:30 · Reels lunes, miércoles y
>    viernes 13:00 · Shorts miércoles, viernes y sábado 17:00 (la semana tipo de §2.3). Son hipótesis
>    para validar con tus propias métricas en 4 semanas (§4).
> 4. **Las descripciones son metadatos de búsqueda:** palabra clave en los primeros ~100 caracteres,
>    una pregunta para provocar comentarios y **de 3 a 5 hashtags** (Instagram ya no permite más de 5).
>    En YouTube, los hashtags van en la descripción y no en el título.
> 5. **Las noticias de IA caducan rápido.** Si el tema es noticia del día, publica en cuanto el video
>    esté listo, en las tres plataformas. La oportunidad pesa más que el horario ideal.
> 6. **Etiqueta las voces sintéticas** con el interruptor de contenido de IA de cada plataforma. Las
>    voces son clones de TTS de personajes cuyas voces vienen de actrices reales; no etiquetarlas
>    arriesga strikes y la monetización (§6).

---

## 1. Qué publicamos (perfil del contenido)

Lo deduje del repositorio (`projects/demo_001/script.md`, `config/*.json`, `docs/09_LICENSING.md`):

| Rasgo | Valor | Implicación para la distribución |
|---|---|---|
| Formato | Vertical 9:16, **60–120 s** (el demo dura ~68 s) | Más de 60 s: elegible para Creator Rewards en TikTok; dentro del límite de 3 min de Reels y Shorts |
| Tema | Actualidad de IA y tecnología explicada ("DeepSeek vs ChatGPT", precios, benchmarks) | Contenido de **búsqueda** y de **actualidad**: vive de palabras clave y de llegar a tiempo |
| Formato narrativo | Gancho, meme, explicación, remate y CTA ("¡Papu papu! … síguenos") | Gancho fuerte en los primeros 3 s; humor con "edutainment" |
| Personajes | Kasane Teto y Hatsune Miku (renders MMD) con **voces de IA** (Fish Audio) | Atrae al fandom Vocaloid/anime; exige etiqueta de IA |
| Idioma | Español con modismos de internet latinoamericano ("papu") | Prioriza LATAM; España es audiencia secundaria |
| Audio | Sin música (se añade al publicar, desde la biblioteca de cada plataforma) | Usa el audio nativo de cada app; nunca subas a Instagram el audio "de TikTok" |
| Marca de agua | `@tetociencia` propia (sin logo de TikTok) | Bien: Instagram penaliza las marcas de agua de otras plataformas (§3.2) |
| Material de terceros | Capturas de noticias y GIFs con `license_status: unknown` | Riesgo para la monetización; ver §6 |

**Nicho combinado:** IA + educación + Vocaloid. Es una intersección poco explotada, y de ahí sale la
ventaja: cada video puede entrar por **tres puertas de descubrimiento** (búsquedas de IA, comunidad
Vocaloid/anime y edutainment). La estrategia de hashtags (§3.4) está diseñada para abrir las tres.

## 2. Horarios óptimos

### 2.1 Qué dicen los estudios (2026)

Los estudios grandes **no coinciden**. Usan bases de cuentas distintas: Buffer mide sobre todo
creadores pequeños y Sprout Social mide marcas. Además, todos expresan las horas en la **zona horaria
de la audiencia**.

| Plataforma | Fuente | Resultado clave |
|---|---|---|
| TikTok | Buffer (7,1 M de posts) | Mejores franjas: **domingo 9:00**, lunes 13:00 y domingo 13:00; el engagement sube de **18:00 a 23:00**; el sábado es el mejor día |
| TikTok | Sprout Social (general) | **Martes a jueves, 14:00–18:00**; domingo, el peor día |
| TikTok | Sprout Social (**educación**) | **Miércoles y jueves 11:00–18:00**; martes 13:00 y 15:00–19:00; fines de semana flojos |
| TikTok | Datos por país | **México: 12–14 h y 19–22 h** (el jueves, el mejor día) · Colombia: 11–13 h y 19–21 h · Argentina: 13–15 h y 20–23 h · España: 14–16 h y 21–23 h |
| TikTok | Guías por tipo de contenido | Educativo, por la mañana; humor y entretenimiento, de 19:00 a 23:00 |
| Reels | SocialPilot (250 k Reels) | **Lunes a jueves, 8:00–12:00** |
| Reels | Buffer | **Entre semana, 18:00–23:00**, sobre todo miércoles y jueves |
| Reels | Consenso de varios estudios | Entre semana, por la mañana y a mediodía (12–13 h); el mejor tramo es de martes a jueves |
| Shorts | Buffer (1,8 M de videos) | **Viernes, 16:00–19:00** (sus tres mejores franjas caen el viernes por la tarde) |
| Shorts | Consenso | Mediodía (11–15 h) y tarde-noche (18–21 h); jueves, viernes y sábado |

### 2.2 Ajuste a nuestra audiencia

- **Husos horarios:** CDMX es UTC-6. Bogotá y Lima, UTC-5 (+1 h respecto a CDMX). Buenos Aires y
  Santiago (Chile con horario de verano desde septiembre), UTC-3 (+3 h). España, UTC+2 hasta el
  25-oct-2026 (+8 h) y UTC+1 después (+7 h).
- **19:30 CDMX** = 20:30 Bogotá/Lima = 22:30 Buenos Aires/Santiago. Cae en la franja nocturna de
  todos los países de LATAM. España queda fuera (03:30).
- **13:00 CDMX** = mediodía en México y Colombia, 16:00 en el Cono Sur y **20:00–21:00 en España**.
  Es la única franja que cubre el almuerzo latinoamericano y el prime time español a la vez.
- El fandom Vocaloid/anime y el público de EduTok son mayoritariamente estudiantes, que están activos
  **después de clase (16–22 h)** y en los descansos de mediodía. Coincide con las franjas anteriores.
- Nuestro contenido mezcla educación y humor. La franja nocturna favorece al humor y el mediodía de
  entre semana favorece a lo educativo; por eso probamos ambas.

### 2.3 Calendario recomendado (hora CDMX)

Para **3 videos por semana** (A, B y C). Es una cadencia sostenible que deja margen de calidad (§5):

| Día | TikTok | Instagram Reels | YouTube Shorts |
|---|---|---|---|
| Lunes | — | **13:00** · C (semana anterior) | — |
| Martes | **19:30** · A | — | — |
| Miércoles | — | **13:00** · A | 17:00 · C (semana anterior) |
| Jueves | **19:30** · B | — | — |
| Viernes | — | **13:00** · B | **17:00** · A |
| Sábado | — | — | **17:00** · B |
| Domingo | **10:30** · C | — | — |

Reglas del calendario:
1. **TikTok va primero.** Es donde la audiencia busca, y la reacción de la primera hora te sirve de
   prueba antes de publicar en las demás.
2. **Reels al día siguiente, Shorts 2–3 días después.** En Shorts el horario pesa menos: la
   distribución tiene una cola larga y depende sobre todo de la retención.
3. **Excepción de actualidad:** si el video trata una noticia de menos de 48 h (un lanzamiento, una
   caída de bolsa por una IA), publica en las tres plataformas en cuanto esté listo. En noticias, el
   pico de búsquedas dura horas.
4. Publica **15–30 minutos antes** de la franja objetivo, para que la distribución inicial coincida
   con el pico de actividad.
5. Quédate **60 minutos** después de publicar para responder comentarios: alimenta la señal de
   interacción temprana.

> Implementación: esta tabla es `WEEKLY` en `src/autopilot/publish.ts` (bloques A/B/C). La usan el kit
> de publicación de cada episodio y la **planilla de producción** (`npm run planilla`), que reparte los
> episodios pendientes en las semanas, calcula los plazos de producción y vigila la separación entre
> videos; la subida se hace con `npm run upload` (ver [12_PUBLICACION.md](12_PUBLICACION.md), ADR 0014).

## 3. Formato de descripciones por plataforma

### 3.1 TikTok (descripción de hasta 4.000 caracteres; se ven ~100–150 antes de "más")

TikTok funciona como buscador: la palabra clave tiene que estar **dicha** en los primeros 3 s,
**escrita en pantalla** y en la **primera línea** de la descripción. Los datos sobre la longitud
chocan: las descripciones de menos de 100 caracteres reciben un 21 % más de interacción, y las largas
ayudan al SEO. Resolvemos el choque con una **primera línea corta y potente**, seguida de 1–2 frases
de contexto con palabras clave (≈150–300 caracteres en total).

**Plantilla**
```
[Pregunta o afirmación gancho con la palabra clave] [1 emoji] [qué explica, en ≤8 palabras]
[1–2 frases con palabras clave secundarias: entidades, conceptos]
[Pregunta para comentarios] 👇
#[tema amplio] #[entidad 1] #[entidad 2] #[personaje/comunidad] #[formato]
```

**Ejemplo (demo_001)**
```
¿China destruyó a ChatGPT? 🤖 DeepSeek explicado sin drama
Teto y Miku te cuentan qué pasó con DeepSeek, por qué asustó a internet y por qué la competencia entre modelos de IA abarata su uso.
¿Tú cuál usas: ChatGPT, Claude o DeepSeek? 👇
#inteligenciaartificial #deepseek #chatgpt #kasaneteto #aprendeentiktok
```
- Las descripciones con pregunta reciben **un 44 % más de comentarios**.
- **Comentario fijado** con las fuentes (en contenido educativo da credibilidad) y la nota
  "🎙️ Voces generadas con IA".
- Agrupa los videos en una **serie o playlist** ("IA sin drama") para encadenar visualizaciones.
- Elige **3–5 hashtags específicos**; evita #fyp y #viral. Mezcla 1 hashtag amplio, 2 de la entidad
  del episodio, 1 de la comunidad y 1 de formato.

### 3.2 Instagram Reels (máximo 5 hashtags; las palabras clave pesan más que los hashtags)

Desde diciembre de 2025, Instagram **limita a 5 los hashtags** por Reel, sumando descripción y
comentarios. Mosseri insiste en que los hashtags no aumentan la visibilidad. Lo que impulsa el
alcance son las **palabras clave de la descripción**, el texto en pantalla, el texto alternativo y el
audio. Las tres señales principales confirmadas son **tiempo de visualización, "me gusta" por alcance
y envíos por alcance**. Los envíos son la señal más fuerte para llegar a no seguidores: se reportan
como equivalentes a entre 3 y 5 "me gusta".

**Plantilla**
```
[Gancho con palabra clave, ≤125 caracteres] [emoji]
[2–3 frases de valor con palabras clave: qué aprenderás]
📌 Guárdalo para [situación concreta].
📤 Mándaselo a [persona concreta que lo necesita].
#[tema] #[entidad] #[entidad] #[comunidad] #[tecnologia]
```

**Ejemplo (demo_001)**
```
¿China destruyó a ChatGPT? 🤖 Spoiler: no, pero lo que pasó es más interesante.
Teto y Miku explican DeepSeek, la competencia entre modelos de inteligencia artificial y por qué eso hace que usarlos sea cada vez más barato.
📌 Guárdalo para la próxima vez que leas un titular alarmista.
📤 Mándaselo a ese amigo que dice que ChatGPT ya murió.
#inteligenciaartificial #deepseek #chatgpt #vocaloid #tecnologia
```
- La CTA de **envío** es deliberada: es la palabra que más pesa para llegar a no seguidores.
- **Reescribe** la descripción, no copies la de TikTok. Sube el MP4 limpio que exporta el motor (sin
  marca de agua de TikTok) y añade música **de la biblioteca de Instagram**. Instagram rebaja el
  alcance del contenido reciclado y detecta marcas de agua, huellas de audio y descripciones copiadas.
- Rellena el **texto alternativo** (configuración avanzada) con una frase descriptiva y palabras clave.
- Usa **Trial Reels** para probar ganchos alternativos con no seguidores sin afectar al perfil.
- **Portada:** fotograma del gancho con el titular legible. Mantiene ordenada la cuadrícula del perfil.

### 3.3 YouTube Shorts (título de hasta 100 caracteres; hashtags en la descripción)

Shorts tiene su propio sistema de recomendación, basado en **visto frente a deslizado** (Viewed vs
Swiped Away), el porcentaje visto y la satisfacción. Por debajo de ~60 % de "visto", deja de mostrarse
a gente nueva; ~70 % ya es territorio viral.

**Título** (60–80 caracteres, palabra clave al principio, **sin hashtags**):
```
¿China destruyó a ChatGPT? DeepSeek explicado sin drama (Teto y Miku)
```
**Descripción** (300–500 caracteres, gancho en los primeros 100, hashtags al final):
```
DeepSeek, el modelo chino de inteligencia artificial, asustó a medio internet. ¿De verdad acabó con ChatGPT y Claude? Teto y Miku lo explican sin drama: benchmarks, competencia entre modelos de IA y por qué los precios bajan cada año.

Fuentes: [enlaces]
Voces sintéticas generadas con IA. Personajes: Kasane Teto, Hatsune Miku.

#inteligenciaartificial #deepseek #chatgpt
```
- Los **3 primeros hashtags** de la descripción aparecen como enlaces sobre el título. Usa 3–5;
  con más de 15, YouTube los ignora todos.
- Usa la opción **"video relacionado"** para enlazar un video largo o la playlist de la serie.
- **Playlist** "IA sin drama" y una respuesta fijada en los comentarios con la pregunta del episodio.

### 3.4 Banco de hashtags por nicho (elige 3–5 por video)

| Rol | TikTok | Instagram | YouTube |
|---|---|---|---|
| Tema amplio (1) | #inteligenciaartificial · #ia · #tecnologia | #inteligenciaartificial · #tecnologia | #inteligenciaartificial |
| Entidad del episodio (1–2) | #chatgpt · #deepseek · #claude · #gemini · #openai | igual | igual |
| Comunidad (1) | #kasaneteto · #hatsunemiku · #vocaloid · #teto | #vocaloid · #hatsunemiku | #vocaloid |
| Formato (0–1) | #aprendeentiktok · #edutok · #aprendeconia | #aprendeconia · #datoscuriosos | — |

- **Etiqueta comunitaria con respeto:** usa #kasaneteto / #hatsunemiku solo cuando el personaje
  aparezca y tenga un papel. El fandom Vocaloid es muy sensible al uso de IA ("AI covers"). Pon la
  transparencia por delante (§6) y mantén los vínculos con la comunidad (fechas como el aniversario de
  Teto, el 1 de abril, o el de Miku, el 31 de agosto).
- **Momento de Teto:** sigue en tendencia en 2025–2026 (memes, el voicebank de Synthesizer V AI
  lanzado en noviembre de 2025, conciertos). Es un buen gancho de descubrimiento para la comunidad.
- **Evita** #fyp, #viral, #parati y #trending: no garantizan distribución y no describen el contenido.

## 4. Protocolo de validación (las cifras externas son solo el punto de partida)

Los estudios son agregados, mayoritariamente de cuentas en inglés y de nichos distintos. **El dato
que manda es el de tu propia cuenta.**

1. **Semanas 1–2:** el calendario de §2.3, sin cambios.
2. **Semanas 3–4:** prueba A/B de **una sola variable** en TikTok. Mueve los videos del martes y del
   jueves a **13:00** (franja de mediodía + España) y compara.
3. Métricas de decisión por plataforma:
   - TikTok: visualizaciones en la primera hora, **% de visualización completa**, tiempo medio de
     visualización, % de tráfico de búsqueda.
   - Instagram: **envíos por alcance**, guardados, % de alcance a no seguidores.
   - YouTube: **% visto frente a deslizado** (objetivo ≥ 70 %) y porcentaje medio visto.
4. Con más de 100 seguidores, usa la gráfica de **"seguidores activos por hora"** de TikTok e
   Instagram. A partir de ahí, publica 30 minutos antes del pico real.
5. Revisa el reparto por país en las analíticas. Si España supera el 25 %, la franja de 13:00 CDMX
   gana peso.

## 5. Recomendaciones de contenido que afectan a la distribución

| Recomendación | Motivo | Dónde actuar |
|---|---|---|
| **Palabra clave en pantalla durante el gancho** (p. ej., "¿DeepSeek destruyó a ChatGPT?") | La búsqueda de TikTok lee el texto en pantalla y lo que se dice en los primeros 3 s. Hoy el saludo "¡Papu papu!" ocupa ~1 s antes de la palabra clave | Motor: **tarea aprobada, especificada en §8** |
| Duración por plataforma: **TikTok 61–90 s**; **Reels y Shorts 60–75 s** | Más de 60 s monetiza en TikTok. En Reels, el tramo de 45–60 s obtiene la mayor mediana de visualizaciones. En Shorts manda la retención, no la duración | Guion: `target` |
| **Final que enlace con el inicio** (loop) | Las repeticiones elevan la retención por encima del 100 % en Shorts y TikTok | Guion/motor |
| Variar temas, personajes y estructura entre episodios; comentario original | La política de **contenido no auténtico** de YouTube castiga el contenido masivo y con plantilla. El motor produce videos con plantilla, así que la variación editorial humana es obligatoria | Guion |
| Fuentes en el comentario fijado o en la descripción | Credibilidad del contenido educativo y defensa frente a reportes | Publicación |
| 3 videos por semana con calidad constante, antes que publicar a diario con menos calidad | La retención importa más que el volumen. Instagram también penaliza las cuentas que reciclan contenido | Operación |

## 6. Cumplimiento: etiqueta de IA, derechos y monetización

- **TikTok:** obliga a etiquetar el contenido de IA realista, incluidos los **clones de voz**. Las
  excepciones son los estilos artísticos (anime) y el TTS genérico que **no** imita una voz
  reconocible. Nuestras voces imitan a Teto y Miku, cuyas voces vienen de actrices reales: **activa
  el interruptor de contenido generado con IA**. En 2026 hay etiquetado automático y strikes por no
  declararlo.
- **YouTube:** activa **"contenido alterado o sintético"** cuando se clona la voz de otra persona.
  Declararlo **no** reduce la monetización; no hacerlo de forma reiterada puede llevar a la suspensión
  del YPP. A esto se suma la política de contenido no auténtico (§5).
- **Instagram/Meta:** usa la etiqueta "Info de IA" para audio y video sintéticos realistas.
- **Texto en la descripción:** "Voces generadas con IA" en las tres plataformas. Cuesta poco y genera
  confianza en una comunidad (Vocaloid) que vigila el uso de IA.
- **Licencias (ver `09_LICENSING.md`):** las ilustraciones de Miku tienen licencia CC BY-NC (no
  comercial). Teto tiene guías propias para la monetización y el uso de la voz. Las capturas de noticias y los
  GIFs están marcados como `unknown`. **Antes de activar Creator Rewards, YPP o colaboraciones
  pagadas, cierra la revisión de licencias**: `report.json > licenses.commercialUse` debe decir
  `allowed`.
- **Creator Rewards (TikTok):** videos de 60 s o más, 10.000 seguidores, 100.000 visualizaciones en
  30 días, mayoría de edad y contenido original. México figura entre los países elegibles.

## 7. Checklist de publicación (por video)

- [ ] El tema es de actualidad: ¿publico ya (excepción §2.3) o en la franja del calendario?
- [ ] La palabra clave se dice en los primeros 3 s y aparece escrita en pantalla.
- [ ] TikTok: descripción con gancho + contexto + pregunta, 3–5 hashtags, interruptor de IA activado,
      comentario fijado con las fuentes, añadido a la serie.
- [ ] Reels (día siguiente): descripción reescrita con CTA de guardar y enviar, ≤5 hashtags, texto
      alternativo, música de la biblioteca de Instagram, etiqueta de IA, portada.
- [ ] Shorts (2–3 días después): título de 60–80 caracteres sin hashtags, descripción con fuentes y
      3 hashtags, contenido sintético declarado, video relacionado y playlist.
- [ ] Primera hora tras publicar en TikTok: responder comentarios.
- [ ] A las 48 h: anotar retención, envíos y % visto/deslizado en la hoja **Seguimiento** de la planilla
      (`npm run planilla`).

## 8. Tarea de implementación para el agente: rótulo de palabra clave en el gancho

> **Estado: IMPLEMENTADA (2026-10-01, ADR 0006).** Demo: `hook_title: ¿*DeepSeek* destruyó a *ChatGPT*?`
> (se resalta tambien ChatGPT, que se dice a los ~2 s, para no disparar `HOOK_KEYWORD_LATE`). Este apartado es una
> especificación accionable para el agente de Claude Code local. Respeta las reglas de `CLAUDE.md`:
> cambia el contrato del timeline, así que hay que **escribir el ADR 0006 y actualizar los schemas y
> los tests antes que el render**.

### 8.1 Problema
La búsqueda de TikTok (y el OCR de Instagram) indexa lo que **se dice** y lo que **aparece escrito**
en los primeros ~3 s. Hoy el gancho arranca con el saludo pregrabado "¡Papu papu!"
(`audio.greeting`, `src/tts/greeting.ts`), y la palabra clave ("ChatGPT", "DeepSeek") no se oye
hasta ~1 s después. Además, ningún elemento de texto fijo muestra el tema: los subtítulos van
palabra por palabra y los logos son imágenes. El primer fotograma (miniatura y portada) no comunica
de qué trata el video.

### 8.2 Objetivo
Un **rótulo de título** (title card) con la palabra clave del episodio, visible y legible **desde el
fotograma 0 hasta el final de la escena `hook`**. Debe caber en la safe area y no tapar los
subtítulos, que quedan por encima en el orden de capas. Así el saludo se mantiene (es identidad del
canal) y la palabra clave aparece escrita desde el primer instante.

### 8.3 Diseño
Sigue el principio QUE/COMO: **el texto lo decide la narrativa; la posición y el estilo, el motor.**

**Contrato (QUE)**
- `schemas/timeline.schema.json > meta.hookTitle`: string opcional, 1–60 caracteres. Admite
  `*palabra*` para resaltar la palabra clave (mismo convenio que `subtitle_emphasis`).
- `src/timeline/types.ts > TimelineMeta.hookTitle?: string`.
- Guion: clave de front matter `hook_title:` (también `titulo_gancho:`) en `src/director/script-parser.ts`
  y en `scriptMeta` (`src/director/rules.ts`). El valor `none` desactiva el rótulo. Si la clave no
  está, **no hay rótulo** (el cambio no altera los guiones existentes) y el validador emite un
  warning (8.5).
- Director LLM: añade `hookTitle` (string, requerido; `""` = sin rótulo) al schema de salida de
  `src/director/llm/director.ts`. En `prompts/director.system.md`, pide un rótulo de ≤ 45 caracteres
  con la entidad o palabra clave buscable al principio y marcada con `*…*`.
- `projects/demo_001/script.md`: añadir `hook_title: ¿*DeepSeek* destruyó a ChatGPT?`.

**Configuración (COMO)**: nuevo bloque `titleCard` en `config/render.json` (y en su schema y en
`RenderConfig`):
```json
"titleCard": {
  "enabled": true,
  "y": 240,
  "maxWidth": 860,
  "fontSize": 64,
  "maxLines": 2,
  "lineHeight": 1.1,
  "paddingX": 28,
  "paddingY": 16,
  "radius": 22,
  "background": "rgba(17,17,17,0.72)",
  "textColor": "#FFFFFF",
  "emphasisColor": "#FFE14D",
  "minMs": 1500,
  "maxMs": 6000,
  "popInMs": 200,
  "fadeOutMs": 250,
  "reserveVisualArea": true
}
```
Los valores son puntos de partida: calibrar con `npm run render -- --safe-area`.

**Compilador (`src/timeline/plan.ts`, puro)**
- Nuevo campo `RenderPlan.titleCard: PlanTitleCard | null` con `{ text, tokens: [{text, emphasis}],
  from: 0, to, fontSize, lines, box: {x, y, width, height}, popInFrames, fadeOutFrames, colors }`.
- `to` = fin de la escena con `section: "hook"`, acotado a `[minMs, maxMs]`. Sin escena hook,
  `to` = `minMs`.
- Layout con la misma estimación de ancho que los subtítulos (`estimateTextWidth` / `wrapTokens` de
  `src/timeline/captions.ts`). Si no cabe en `maxLines`, reduce la fuente; por debajo del 70 %, el
  validador da error (8.5).
- Si `reserveVisualArea`, los visuales y el b-roll que se solapen con `[from, to)` usan un área
  desplazada hacia abajo (`visualArea.y + box.height + 12`, con la altura reducida en lo mismo).
  Así los logos del gancho siguen visibles y no quedan tapados.
- Centrado horizontal en `captionCenterX(cfg)` (centro de la safe area, como los subtítulos).
- Planes antiguos sin `titleCard` deben seguir dibujándose (`plan.titleCard ?? null`, igual que
  `broll` y `watermark`).

**Render**
- Nuevo `src/components/TitleCard.tsx`: solo lee el plan. Banda redondeada semitransparente, texto
  Montserrat 900 blanco con contorno (reusar `outline` de `Captions.tsx` o extraerlo a un util
  compartido) y palabras resaltadas en `emphasisColor`. Entrada pop/scale y salida fade, deterministas.
- En `src/compositions/ShortVideo.tsx`: **fuera de `<Camera>`** (no tiembla ni hace zoom), **encima
  de `<Watermark>`** y **debajo de `<Captions>`**.
- `SafeAreaGuide.tsx`: dibujar también la caja del rótulo.
- `planFiles` (`src/pipeline/render.ts`) no cambia: el rótulo no usa archivos nuevos.

**Portada (opcional, recomendado)**: en `stepRender`, exportar `output/<id>/cover.jpg` con
`renderStill` del fotograma `min(15, titleCard.to - 1)`, para usarlo como portada en Reels y
Shorts (§3.2). Añadirlo a `copyToOutput`.

### 8.4 Fuera de alcance
- Generar automáticamente las descripciones o los hashtags por plataforma (sería otra tarea; las
  plantillas de §3 sirven de base).
- Cambiar el saludo "¡Papu papu!" o el audio del gancho.

### 8.5 Validación (`src/validation/timeline.ts`, check `subtitles`/`narrative`)
| Código | Nivel | Condición |
|---|---|---|
| `HOOK_TITLE_MISSING` | warning | Timeline final sin `meta.hookTitle` (perjudica el SEO) |
| `HOOK_TITLE_TOO_LONG` | error | Más de `maxLines` líneas o fuente < 70 % |
| `HOOK_TITLE_OUTSIDE_SAFE_AREA` | error | La caja del rótulo sale de la safe area |
| `HOOK_TITLE_OVERLAPS_CAPTIONS` | error | La caja del rótulo se solapa con la caja máxima de subtítulos (`captions.centerY` ± alto) |
| `HOOK_KEYWORD_LATE` | warning | Ninguna palabra resaltada del rótulo (o, si no hay resaltadas, ninguna palabra de ≥ 5 letras) se **dice** antes de los 3.000 ms según `captions` |

### 8.6 Tests (añadir; no borrar ni desactivar ninguno existente)
- `tests/schemas.test.ts`: acepta `meta.hookTitle`; rechaza > 60 caracteres.
- `tests/script-parser.test.ts`: `hook_title:` y `titulo_gancho:` llegan a `meta.hookTitle`; `none` lo omite.
- `tests/plan.test.ts`: `titleCard.from === 0`; `to` = fin del hook acotado a `[minMs, maxMs]`;
  resaltado de `*palabra*`; los visuales del hook se desplazan con `reserveVisualArea`; sin
  `hookTitle`, `titleCard === null`; determinismo (hash).
- `tests/validation.test.ts`: un caso por cada código de 8.5.
- `tests/llm-director.test.ts`: el schema incluye `hookTitle` y la conversión lo traslada a `meta`.
- `tests/fixtures/smoke.timeline.json`: añadir `hookTitle` para que el smoke render lo cubra.

### 8.7 Documentación
- `docs/adr/0006-rotulo-palabra-clave-gancho.md`: contexto (§8.1), decisión (§8.3), consecuencias.
- `docs/04_TIMELINE_SCHEMA.md` (campo `meta.hookTitle`), `docs/05_RENDER_RULES.md` (capa y layout),
  `docs/06_SCRIPT_FORMAT.md` (`hook_title:`), `CHANGELOG.md`, y en `docs/STATUS.md` marcar la tarea
  como hecha.

### 8.8 Criterios de aceptación
1. `npm run lint && npm test && npm run smoke` en verde.
2. `npm run render -- --project projects/demo_001 --safe-area`: en el fotograma 0 se lee
   "¿DeepSeek destruyó a ChatGPT?", con "DeepSeek" resaltado y dentro de la safe area; los logos
   del gancho siguen visibles debajo; los subtítulos no quedan tapados.
3. El rótulo desaparece con un fade al terminar la escena `hook` (≤ 6 s).
4. `report.json` en PASS en todos los checks hard; `npm run render -- --repro` da fotogramas idénticos.
5. Validación manual en el teléfono: el tema se entiende con el video en silencio y mirando solo el
   primer fotograma.

## Fuentes

Horarios
- Buffer — TikTok (7,1 M de posts): https://buffer.com/resources/best-time-to-post-on-tiktok/
- Sprout Social — TikTok: https://sproutsocial.com/insights/best-times-to-post-on-tiktok/
- Neal Schaffer — TikTok por industria y región: https://nealschaffer.com/best-time-to-post-on-tiktok/
- eClincher — por qué discrepan los estudios: https://www.eclincher.com/articles/best-time-to-post-on-tiktok-in-2026-what-the-data-really-says
- Clip to Click — horarios por país: https://cliptoclick.com/mejores-horarios-tiktok
- Maldrich — México: https://www.maldrich.com/mx/guias/mejor-hora-para-publicar-en-tiktok/
- TimeToPost — México: https://timetopost.co/best-time-to-post/tiktok/mexico/
- TokPortal — España: https://www.tokportal.com/learn/best-time-to-post-on-tiktok/spain
- SocialPilot — Reels: https://www.socialpilot.co/insights/best-time-to-post-reels-on-instagram
- Buffer — Instagram: https://buffer.com/resources/when-is-the-best-time-to-post-on-instagram/
- Later — Instagram: https://later.com/blog/best-time-to-post-on-instagram/
- Buffer — YouTube: https://buffer.com/resources/best-time-to-post-on-youtube/
- Hopper HQ — Shorts: https://www.hopperhq.com/blog/best-time-to-post-youtube-shorts/
- SocialPilot — YouTube: https://www.socialpilot.co/insights/best-time-to-post-on-youtube

Descripciones, hashtags y algoritmos
- Metricool — SEO en TikTok: https://metricool.com/tiktok-seo/
- ALM Corp — SEO en TikTok: https://almcorp.com/blog/tiktok-seo/
- TTS Vibes — longitud de la descripción: https://insights.ttsvibes.com/tiktok-caption-length-impact-on-engagement/
- Instagram Creators — límite de 5 hashtags: https://www.threads.com/@creators/post/DSalXGPCWM4/new-hashtag-guidance-starting-today-instagram-will-allow-up-to-hashtags-in-a
- Later — hashtags de Instagram 2026: https://later.com/blog/ultimate-guide-to-using-instagram-hashtags/
- Señales de Mosseri (envíos por alcance): https://www.socialync.io/blog/adam-mosseri-shares-instagram-algorithm-2026 · https://hanamisocial.com/en/blog/instagram-reels-algorithm-2026/
- Contenido reciclado en Instagram: https://www.emarketer.com/content/instagram-s-algorithm-clamps-down-on-repurposed--unoriginal-photos-posts · https://almcorp.com/blog/meta-original-content-rules-2026-facebook-instagram-creators/
- Duración de los Reels: https://frameos.studio/blog/how-long-should-a-reel-be
- Hashtags en Shorts: https://hashtagtools.io/blog/youtube-shorts-hashtags-title-vs-description-2026 · https://reap.video/blog/boost-your-youtube-shorts-picking-the-perfect-hashtags-for-more-views
- Algoritmo de Shorts / visto frente a deslizado: https://www.socialchamp.com/blog/youtube-shorts-algorithm/ · https://prepublish.ai/blog/viewed-vs-swiped-away-youtube-shorts
- Duración de los Shorts: https://piktochart.com/blog/how-long-youtube-shorts/

Nicho y audiencia
- Kasane Teto: https://en.wikipedia.org/wiki/Kasane_Teto
- Hashtags de IA y educación en español: https://www.tiktok.com/tag/aprendeconia · https://hashtagradar.com/hashtag/aprendizaje/
- TikTok como buscador (Gen Z, LATAM/México): https://mexicobusiness.news/ecommerce/news/tiktok-emerges-key-search-tool-gen-z-shoppers · https://www.niemanlab.org/reading/almost-40-of-gen-z-is-using-tiktok-and-instagram-for-search-instead-of-google-according-to-googles-own-data/
- Usuarios en México: https://www.quadratin.com.mx/entretenimiento/entretenimiento-entretenimiento/alcanza-tiktok-a-99-millones-de-mexicanos-facebook-a-93-5/ · https://houseofmarketers.com/tiktok-users-statistics-demographic-data/

Cumplimiento y monetización
- TikTok — contenido generado con IA: https://www.tiktok.com/tns-inapp/pages/ai-generated-content
- Reglas de declaración de IA por plataforma: https://influencermarketinghub.com/ai-disclosure-rules/
- YouTube — IA, voz y contenido no auténtico: https://shortsfast.com/blog/youtube-ai-content-disclosure-rules-2026/ · https://lenspov.com/articles/youtube-ai-content-demonetization-2026
- TikTok Creator Rewards: https://postlinkapp.com/blog/tiktok-creator-rewards-program · https://www.arqfinance.com/en-MX/blog/freelancer-tips/como-funciona-creator-rewards-program-tiktok

> Nota metodológica: varias cifras vienen de blogs del sector que resumen estudios propietarios
> (Buffer, Sprout Social, Later, Socialinsider). No pude verificar cada estudio original en su fuente
> primaria. Por eso los horarios se presentan como hipótesis y el protocolo de §4 es parte de la
> recomendación.

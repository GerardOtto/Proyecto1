# 12 — Planilla de produccion y subida de videos

Como pasar de "guion escrito" a "publicado en las tres plataformas" con plazos claros. Decisiones:
[ADR 0013](adr/0013-prototipos-baja-resolucion.md) (prototipos) y
[ADR 0014](adr/0014-planilla-y-subida.md) (planilla y subida). Horarios y reglas de fondo:
[10_DISTRIBUCION.md](10_DISTRIBUCION.md).

## Flujo de una semana
```
guion (autopiloto o a mano) ─► prototipo 540x960 con voz de borrador ─► revision humana
   ─► voces Fish Audio ─► render final 1080x1920 + QA ─► aprobacion ─► TikTok ─► Reels (+1 dia) ─► Shorts (+2-3 dias)
```
| Paso | Comando | Plazo (dias respecto al estreno en TikTok) |
|---|---|---|
| Prototipo | `npm run generate -- --project projects/<id> --tts espeak --preview` | cuando el guion esta escrito |
| Guion aprobado | revisar `Prototipo.mp4` y `Guion.txt` (`npm run review`) | T-4 |
| Voces | grabar en Fish Audio (`--tts fish` o `--tts files`) | T-3 |
| Render final + QA | `npm run autopilot -- --episode <id> --produce` (o `npm run generate`) | T-2 |
| Aprobacion final | ver el video, revisar textos del kit, marcar **Aprobado** en la planilla | T-1 |
| Publicar | `npm run upload -- --episode <id>` o `--due` | T (TikTok), T+1 (Reels), T+2/3 (Shorts) |
| Metricas | anotar en la hoja Seguimiento | T+2 |

## Planilla (`npm run planilla`)
```bash
npm run planilla                                   # 4 semanas desde el proximo lunes; prueba A/B en la semana 3
npm run planilla -- --desde 2026-10-05 --semanas 4 --prueba-ab 3
npm run planilla -- --sin-sugerencias              # solo episodios que ya existen
```
Genera `projects/_autopilot/planillas/planilla_produccion_<lunes>.xlsx`. Nunca sobrescribe una
planilla existente (puede tener estados y metricas anotados) salvo con `--force`.

| Hoja | Para que |
|---|---|
| Resumen | Como usarla, conteos (planificadas, aprobadas, publicadas, avisos) y la semana tipo. |
| Calendario | Una fila por publicacion: fecha y hora CDMX (editable), dia, plataforma, episodio, horas desde el video anterior en esa plataforma, horas desde el estreno en TikTok, **Regla** (OK/Revisar), hora en Bogota/Lima, Buenos Aires y Madrid, **Estado** (Pendiente → Aprobado → Publicado), enlace y notas. |
| Produccion | Un episodio por fila: tipo, formato, elenco, escenario, duracion, estreno en TikTok y plazos (guion, voces, render, aprobacion, metricas). En rojo los plazos vencidos sin llegar a esa etapa. |
| Seguimiento | Metricas a la 1 h y a las 48 h por publicacion (vistas, % visto, envios, guardados...). |
| Reglas | Parametros editables (separaciones y plazos) y reglas de docs/10. |

Celdas amarillas = editables; grises = formulas. Si mueves una fecha, la columna **Regla** avisa si se
rompe la separacion: nunca menos de 24 h entre dos videos de la misma plataforma, Reels entre 12 y 48 h
despues del TikTok y Shorts entre 36 y 96 h despues.

**Orden**: primero las noticias (caducan; la mas antigua antes), luego los evergreen y al final temas
sugeridos por el planificador del autopiloto para completar las semanas (se escriben con
`npm run autopilot -- --mode evergreen --topic <id>`). Una noticia de menos de 48 h se publica en las
tres plataformas en cuanto el video este aprobado, sin esperar la franja.

### Semana tipo (hora CDMX)
| Bloque | TikTok | Instagram Reels | YouTube Shorts |
|---|---|---|---|
| A | martes 19:30 | miercoles 13:00 | viernes 17:00 |
| B | jueves 19:30 | viernes 13:00 | sabado 17:00 |
| C | domingo 10:30 | lunes 13:00 (semana siguiente) | miercoles 17:00 (semana siguiente) |

Semanas 3-4 (prueba A/B de docs/10 §4.2): TikTok de A y B a las 13:00.

## Subida con Selenium + Chromium (`npm run upload`)
### Preparacion (una vez)
1. `npm install` (instala `selenium-webdriver`; Selenium Manager descarga el chromedriver correcto).
2. Navegador: Chromium si esta instalado en la ruta habitual, o define `UPLOAD_BROWSER` en `.env`
   (ruta a Chromium o Chrome). Sin nada, se usa Google Chrome.
3. `npm run upload -- --login`: abre TikTok, Instagram y YouTube Studio en un perfil propio
   (`.cache/upload-profile`, o `UPLOAD_PROFILE_DIR`). Inicia sesion a mano en las tres pestanas (con
   2FA si la tienes) y presiona Enter. El script nunca ve ni guarda contrasenas.

### Uso
```bash
npm run upload -- --episode <id> --simular                 # sin navegador: textos, etiqueta IA y validacion del video
npm run upload -- --episode <id>                           # TikTok, Instagram y YouTube; pregunta antes de publicar
npm run upload -- --episode <id> --plataforma instagram    # una sola plataforma
npm run upload -- --due                                    # filas "Aprobado" de la planilla cuya hora llego (ventana 2 h)
npm run upload -- --due --publicar                         # sin preguntar (para el programador de tareas)
```
Que hace en cada plataforma:
| | TikTok Studio | Instagram (Reels) | YouTube Studio (Shorts) |
|---|---|---|---|
| Archivo | `video.mp4` final | `video.mp4` final + recorte "Original" | `video.mp4` final |
| Texto | `tiktok.txt` | `instagram.txt` (+ portada `cover.jpg` si se puede) | titulo y descripcion de `youtube.txt` |
| IA | "Contenido generado por IA" | "Etiqueta de IA" (configuracion avanzada) | "Contenido alterado" = Si |
| Otros | espera a que termine la subida | — | "No es para ninos", visibilidad Publica, guarda el enlace |

Antes de publicar muestra un resumen (✔/✖ por paso) y pregunta: **[s]** el script publica, **[m]** ya
lo publique a mano, **[n]** cancelar. Con `--publicar` solo publica si todos los pasos obligatorios
quedaron confirmados (sin etiqueta de IA no publica nunca). Si un paso no aparece (la plataforma cambio
su interfaz, un captcha), la ventana queda abierta para terminar a mano.

Despues de cada subida: captura en `output/_subidas/`, registro en `projects/_autopilot/subidas.json`
(evita publicar dos veces) y recordatorio de lo que queda a mano: **fijar el comentario con las
fuentes** y marcar **Publicado** en la planilla con el enlace.

Lo que el script NO hace (hazlo a mano): comentario fijado, musica de la biblioteca de Instagram (solo
en la app), playlists/series, respuestas a comentarios.

### Programar `--due`
- Windows (Programador de tareas): accion `cmd /c cd /d C:\ruta\Proyecto1 && npm run upload -- --due --publicar`,
  disparador diario cada 15 minutos, "Ejecutar solo cuando el usuario haya iniciado sesion" (el
  navegador debe poder abrirse en tu escritorio).
- Linux/macOS (cron): `*/15 * * * * cd /ruta/Proyecto1 && npm run upload -- --due --publicar >> output/_subidas/cron.log 2>&1`.
Solo se publican filas en estado **Aprobado** cuya hora (CDMX) llego hace menos de 2 h (`--ventana`).

### Mantenimiento y limites
- Las plataformas cambian su web sin aviso. Selectores y textos (espanol e ingles) estan en
  `src/upload/platforms.ts > SITES`; al cambiarlos, actualiza tambien las paginas simuladas de
  `tests/fixtures/upload/` y corre `npm run test:upload` (requiere `CHROMEDRIVER_PATH` y
  `UPLOAD_BROWSER`).
- Automatizar la web puede ir contra los terminos de uso de las plataformas. Mantener el volumen bajo
  (3 videos por semana), siempre con la etiqueta de IA y, si se crece, migrar a las APIs oficiales
  (YouTube Data API, Instagram Graph API, TikTok Content Posting API).
- No verificado aun contra las cuentas reales (ver docs/STATUS.md): la primera vez usa el modo con
  confirmacion y revisa cada pantalla.

# ADR 0014 — Planilla de produccion y subida con Selenium + Chromium

- Estado: aceptado (2026-10-02). Ajusta el calendario de `src/autopilot/publish.ts` a la tabla de
  `docs/10_DISTRIBUCION.md` §2.3.

## Contexto
El kit de publicacion del autopiloto calcula la "siguiente franja" por episodio, sin coordinar
episodios entre si: dos guiones escritos el mismo dia recibian las mismas franjas. Ademas el codigo no
seguia la tabla de §2.3: el Reel del bloque B (TikTok jueves) caia el lunes siguiente en vez del
viernes. El usuario pidio una planilla de produccion con plazos de publicacion entre videos en TikTok,
Instagram y YouTube, y un script con Selenium y Chromium para subir los videos.

## Decision
- **Semana tipo unica** (`publish.ts > WEEKLY`): bloques A/B/C con dia y hora por plataforma (TikTok
  mar/jue 19:30 y dom 10:30; Reels +1 dia; Shorts +2-3 dias). `CALENDAR` (franjas del kit por
  episodio) se deriva de `WEEKLY`, asi el kit y la planilla no se contradicen.
- **Planilla** (`npm run planilla`, `src/autopilot/schedule.ts` puro + `planilla.ts` +
  `planilla-xlsx.ts` con exceljs): episodios pendientes del historial (noticias primero, la mas antigua
  antes) + temas sugeridos por el planificador evergreen (simulado, no escribe el historial) para
  completar N semanas; prueba A/B de docs/10 §4 (TikTok A/B a las 13:00 desde la semana 3). Hojas:
  Resumen, Calendario (una fila por publicacion), Produccion (plazos hacia atras desde el estreno en
  TikTok, vencidos en rojo), Seguimiento (metricas 1 h / 48 h) y Reglas (parametros). Las columnas
  derivadas son formulas que leen los parametros de Reglas: si la persona mueve una fecha, la columna
  Regla avisa si se rompe la separacion (>= 24 h por plataforma, Reels 12-48 h y Shorts 36-96 h despues
  de TikTok). Una planilla por periodo; no se sobrescribe sin `--force` (puede tener anotaciones).
- **Subida** (`npm run upload`, `src/upload/`, `selenium-webdriver`): Chromium (o Chrome) visible con
  un perfil persistente donde la persona inicia sesion a mano (`--login`); el script no maneja
  contrasenas ni evade controles (captchas y verificaciones las resuelve la persona). Sube solo el
  `video.mp4` final (1080x1920, 60-120 s, con audio; nunca `preview.mp4`) con los textos del kit (o
  reconstruidos desde el plan) y la etiqueta de IA. Por defecto llena todo y **pregunta** antes de
  publicar; `--publicar` publica solo si se confirmaron descripcion, etiqueta de IA y los pasos
  obligatorios de cada plataforma. `--due` lee la planilla (filas "Aprobado" cuya hora CDMX llego,
  ventana de 2 h) para usarlo desde cron o el Programador de tareas. Registro en
  `projects/_autopilot/subidas.json` (evita duplicados); con las tres plataformas publicadas el episodio
  pasa a `published` en el historial. Selectores y textos de cada sitio en `platforms.ts > SITES`.
- **Pruebas**: logica pura (calendario, lectura de la planilla, `--due`, kit, validacion del video) y
  los flujos de Selenium contra paginas simuladas de las tres plataformas (`tests/fixtures/upload/`,
  `npm run test:upload`, se omite sin chromedriver).

## Consecuencias
- Las interfaces web de TikTok, Instagram y YouTube cambian sin aviso: los selectores fallaran tarde o
  temprano. Por eso el modo por defecto es asistido (la persona ve y confirma) y un paso que no aparece
  deja la ventana abierta para terminar a mano. No se verifico contra las plataformas reales (sin red
  ni cuentas en el entorno de desarrollo).
- Automatizar la interfaz web puede contravenir los terminos de uso de las plataformas; para un volumen
  mayor conviene migrar a las APIs oficiales (YouTube Data API `videos.insert`, Instagram Graph API
  para Reels, TikTok Content Posting API), detras de la misma interfaz `runUpload`.
- Instagram web no permite elegir musica de su biblioteca: si se quiere, se publica desde la app.
- Dependencias nuevas: `exceljs` (con `uuid` forzado a 11.1.1 por un aviso de seguridad) y
  `selenium-webdriver` (Selenium Manager descarga el chromedriver correcto).

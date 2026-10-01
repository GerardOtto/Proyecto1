# ADR 0009 — Visuales de noticia: captura real del titular + tarjetas propias

- Estado: aceptado (2026-10-01). Modifica el punto "Graficos propios en lugar de capturas automaticas"
  del ADR 0007.

## Contexto
Los episodios del autopiloto solo usaban graficos propios sencillos (tarjeta de titular generica,
cifra, puntos clave). El usuario los encontro monotonos: las capturas de titulares de medios reales
(como las de Infobae y El Financiero del demo, hechas a mano) retienen mas y dan credibilidad. Ademas,
la regla de relleno contextual pide que lo que se ve corresponda a la linea que se dice.

Se evaluaron tres opciones: (A) captura real automatica del titular, (B) maqueta que imite el sitio del
medio y (C) tarjetas "estilo noticia" propias con el titular real.

## Decision
- **A + C, sin B.** Por cada articulo del brief (`topic.articles`):
  - **A** — `src/autopilot/capture.ts`: navegador movil (puppeteer-core sobre el chrome-headless-shell
    de Remotion), quita capas fijas y banners, **oculta fotos/videos** (no capturamos imagenes de
    terceros), busca el `<h1>/<h2>` que coincide con el titular esperado (>= 60 % de palabras) y recorta
    titular + bajada en 4:3. Se enmarca en una ventana de navegador con el dominio real y el pie
    "Captura de <medio> · <fecha>". `license_status: unknown` (cita informativa, igual que las manuales).
    Si el sitio bloquea, tiene muro de pago o el titular no coincide, no hay captura.
  - **C** — `src/autopilot/newscards.ts`: 5 disenos genericos (navegador, celular, periodico, post del
    canal, ultima hora) con el titular **textual** entre comillas, el medio como texto, la fecha y la
    traduccion si el original no esta en espanol. Siempre se genera (fallback de A). Licencia owned.
- **B se descarta**: imitar logo/tipografia/maqueta de un medio fabrica una pagina que parece suya sin
  serlo (riesgo de marca y de credibilidad). Por la misma razon, la barra de direcciones de las
  tarjetas propias NO muestra el dominio del medio; solo las capturas reales lo muestran.
- Variedad: los estilos se eligen con semilla, prefiriendo los menos usados por los episodios de los
  ultimos 7 dias.
- Todo se registra como `broll` del proyecto (`news_cap_<n>`, `news_card_<n>`) y se lista en el brief
  del escritor para usarlo con `[BROLL: id]` en la linea que cita cada fuente.
- `npm run autopilot -- --episode <id> --refresh-visuals [--brief <json>]` regenera los visuales de un
  episodio existente.

## Consecuencias
- Nueva dependencia `puppeteer-core` (sin descarga de navegador: usa el de Remotion).
- Las capturas mantienen `commercialUse: blocked` mientras su licencia sea `unknown`; las tarjetas C
  son monetizables.
- El titular del brief debe ser el real de la pagina (si el medio lo cambia, la captura se rechaza y
  queda la tarjeta; actualizar el brief y usar `--refresh-visuals`).
- Revisar cada captura en la carpeta de revision (`Imagenes/`) antes de publicar: algunos sitios dejan
  botones o contadores en el recorte.

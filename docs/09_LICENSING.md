# 09 — Presupuesto y licencias

El MVP tecnico puede tener costo adicional cercano a cero si el desarrollo es local y ya se dispone de
un plan de Claude. Los costos aparecen al pasar a produccion (voz, assets, licencias).

| Componente | MVP local | Produccion inicial | Observacion |
|---|---|---|---|
| Claude Code | cubierto por el plan del usuario | idem | Agente del repo, no editor manual de clips |
| Director LLM (opcional) | pago por uso de la API | idem | `--director rules` no usa API |
| Remotion | $0 si se cumple la Free License | depende del tamano del equipo | Gratis para individuos y equipos de hasta 3 personas (verificar terminos vigentes) |
| Fish Audio | $0 posible durante prototipo | pago por uso / plan | Verificar derechos comerciales de cada voz y del plan |
| Whisper.cpp | $0 | $0 | Local |
| FFmpeg | $0 | $0 | Revisar licencia si se distribuye el binario |
| Storage | $0 local | bajo | Crece si se archivan renders |
| Assets/personajes | variable | variable | Depende de derechos de uso de cada ilustracion |

## No mezclar "puedo usar el personaje" con "puedo usar esta imagen/voz"
- Miku, Rin, Len y Luka: la pagina oficial de Crypton (Piapro, "For Creators") indica CC BY-NC para las
  ilustraciones originales de los personajes; otras ilustraciones y obras pueden tener derechos
  distintos. CC BY-NC no permite uso comercial: la monetizacion requiere revisar sus guias/licencias.
- Kasane Teto: las guias oficiales permiten a particulares publicar videos y monetizarlos bajo
  determinadas condiciones; las reglas de voz y los usos comerciales deben revisarse por separado.
- Voces TTS: la voz de un modelo de Fish Audio tiene sus propios terminos (y los del plan contratado).
- Musica de fondo: **politica actual: los videos se exportan SIN musica** y la musica se anade al
  publicar, desde la biblioteca de TikTok/Instagram (licenciada por la plataforma y enlazada a la
  pagina del sonido, que ayuda al alcance). El motor conserva el soporte (`music:` en el guion,
  ADR 0004) para pistas propias o libres de derechos. Las bandas sonoras comerciales tienen
  copyright: en TikTok pueden provocar audio silenciado o exclusion de la monetizacion. El repo es
  publico: la musica nunca se versiona (`assets/music/`, `config/assets.local.json`).
- El MVP puede ser tecnico/local, pero **cualquier monetizacion debe pasar un chequeo de licencia de
  assets y voces concretos**.

## Como lo aplica el motor
- Cada asset y cada set de avatares registra `source` y `license_status`
  (`documented | owned | placeholder | unknown`).
- `unknown` => usable en render local de prueba, **bloqueado para publicacion comercial**.
- `placeholder` => material generado por `scripts/make-placeholders.ts`; no representa a los
  personajes reales y debe reemplazarse.
- `report.json > licenses` resume `commercialUse: allowed | blocked` y la lista `blockedBy`.
- Al reemplazar un placeholder: actualizar `source`, `license`, `license_status` y `notes`.

Montserrat (subtitulos): SIL Open Font License 1.1 (`assets/fonts/OFL-Montserrat.txt`).

## Referencias (del plan)
- Claude Code: https://docs.anthropic.com/en/docs/claude-code/cli-usage ·
  https://docs.anthropic.com/en/docs/claude-code/getting-started
- Remotion: https://www.remotion.dev/docs/the-fundamentals ·
  https://www.remotion.dev/docs/captions/create-tiktok-style-captions ·
  https://www.remotion.dev/docs/license/pricing
- Fish Audio: https://fish.audio/developers/ · https://fish.audio/plan/
- Crypton/Piapro: https://piapro.net/intl/en_for_creators.html
- Kasane Teto: https://kasaneteto.jp/guidelines/ · https://kasaneteto.jp/guidelines/character.html ·
  https://kasaneteto.jp/guidelines/voice.html

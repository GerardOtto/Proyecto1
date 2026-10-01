# Origen de los avatares

Todos los personajes salen de los tableros de Pinterest de `chaewonjames` (un tablero por personaje,
descargados el 2026-10-01): renders MMD de terceros, con el fondo eliminado por `scripts/remove-bg.py`
(`T_LO=7`; sin relleno de huecos en Luka/Neru con fondo blanco puro) y revisados a mano. Copia de trabajo
con nombres por emocion: `Desktop/Proyecto Vocaloid/Pinterest/<Personaje>/<Personaje>_<emocion>[_n].png`
(`manifest.csv` en esa carpeta: archivo -> pin -> notas). Ingesta:

```bash
npm run avatars:ingest -- --character <id> --from "<carpeta>" --no-bg-removal --replace --max-height 1080 \
  [--manifest overrides.json]   # archivo -> reaccion cuando el nombre no basta
```

Overrides usados (el nombre no distingue): ojos en blanco -> `shocked` (Teto_sorprendida_2,
Miku_sorprendida, Luka_sorprendida, Rin_sorprendida, Len_sorprendido, Kaito_sorprendido(_3));
`neutral` de Miku/Len/Kaito/Neru = Miku_timida / Len_nerd_2 / Kaito_nerd_2 / Neru_nerviosa;
Teto_feliz_4, Miku_emocionada y Miku_maldiciendo -> `riendo`; Miku_sonrojada -> `sorprendido`;
Rin_con_len -> `aburrido`.

`license_status: unknown`: autores originales sin documentar -> apto para validacion local, bloqueado
para uso comercial (docs/09_LICENSING.md). Las reacciones sin imagen propia usan su cadena de
`fallback` (config/reactions.json, ADR 0008).

## teto

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| broma | broma.png | Teto_gato.png | 1146166174356100280 |
| broma (variante) | broma_2.png | Teto_peluche.png | 1146166174356100321 |
| decepcionado | decepcionado.png | Teto_decepcionada.png | 1146166174356031255 |
| decepcionado (variante) | decepcionado_2.png | Teto_decepcionada_2.png | 1146166174356031267 |
| emocionado | emocionado.png | Teto_emocionada.png | 1146166174356031263 |
| emocionado (variante) | emocionado_2.png | Teto_emocionada_2.png | 1146166174356100283 |
| emocionado (variante) | emocionado_3.png | Teto_emocionada_3.png | 1146166174356100293 |
| enojado | enojado.png | Teto_maldiciendo.png | 1146166174356031279 |
| feliz | feliz.png | Teto_feliz.png | 1146166174356031282 |
| feliz (variante) | feliz_2.png | Teto_feliz_2.png | 1146166174356031260 |
| feliz (variante) | feliz_3.png | Teto_feliz_3.png | 1146166174356031265 |
| feliz (variante) | feliz_4.png | Teto_feliz_5.png | 1146166174356031273 |
| feliz (variante) | feliz_5.png | Teto_feliz_6.png | 1146166174356100277 |
| feliz (variante) | feliz_6.png | Teto_feliz_7.png | 1146166174356100289 |
| feliz (variante) | feliz_7.png | Teto_feliz_8.png | 1146166174356100331 |
| gritando | gritando.png | Teto_gritando.png | 1146166174356100319 |
| nerd | nerd.png | Teto_nerd.png | 1146166174356031280 |
| nerd (variante) | nerd_2.png | Teto_nerd_2.png | 1146166174356031276 |
| nerd (variante) | nerd_3.png | Teto_nerd_3.png | 1146166174356031256 |
| nerd (variante) | nerd_4.png | Teto_nerd_4.png | 1146166174356031271 |
| nerd (variante) | nerd_5.png | Teto_nerd_5.png | 1146166174356076676 |
| neutral | neutral.png | Teto_neutral.png | 1146166174356100302 |
| riendo | riendo.png | Teto_feliz_4.png | 1146166174356031266 |
| saludando | saludando.png | Teto_saludando.png | 1146166174356031314 |
| saludando (variante) | saludando_2.png | Teto_saludando_2.png | 1146166174356031258 |
| shocked | shocked.png | Teto_sorprendida_2.png | 1146166174356031262 |
| sorprendido | sorprendido.png | Teto_sorprendida.png | 1146166174356031281 |
| timido | timido.png | Teto_sonrojada.png | 1146166174356100299 |
| timido (variante) | timido_2.png | Teto_timida.png | 1146166174356076587 |
| triste | triste.png | Teto_triste.png | 1146166174356031275 |

## miku

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| broma | broma.png | Miku_arma.png | 1146166174356038707 |
| broma (variante) | broma_2.png | Miku_bigote.png | 1146166174356039010 |
| confundido | confundido.png | Miku_disgustada.png | 1146166174356039038 |
| decepcionado | decepcionado.png | Miku_decepcionada.png | 1146166174356038975 |
| decepcionado (variante) | decepcionado_2.png | Miku_decepcionada_2.png | 1146166174356038968 |
| decepcionado (variante) | decepcionado_3.png | Miku_decepcionada_3.png | 1146166174356038958 |
| decepcionado (variante) | decepcionado_4.png | Miku_decepcionada_4.png | 1146166174356076716 |
| emocionado | emocionado.png | Miku_emocionada_2.png | 1146166174356038982 |
| emocionado (variante) | emocionado_2.png | Miku_emocionada_3.png | 1146166174356099479 |
| enojado | enojado.png | Miku_enojada.png | 1146166174356039069 |
| enojado (variante) | enojado_2.png | Miku_enojada_2.png | 1146166174356039040 |
| feliz | feliz.png | Miku_beso.png | 1146166174356076621 |
| feliz (variante) | feliz_2.png | Miku_feliz.png | 1146166174356039057 |
| feliz (variante) | feliz_3.png | Miku_feliz_2.png | 1146166174356039023 |
| feliz (variante) | feliz_4.png | Miku_feliz_3.png | 1146166174356038964 |
| feliz (variante) | feliz_5.png | Miku_feliz_4.png | 1146166174356076721 |
| gritando | gritando.png | Miku_gritando.png | 1146166174356039046 |
| gritando (variante) | gritando_2.png | Miku_gritando_2.png | 1146166174356039042 |
| gritando (variante) | gritando_3.png | Miku_gritando_3.png | 1146166174356098781 |
| nerd | nerd.png | Miku_nerd.png | 1146166174356039073 |
| nerd (variante) | nerd_2.png | Miku_nerd_2.png | 1146166174356039061 |
| nerd (variante) | nerd_3.png | Miku_nerd_3.png | 1146166174356038997 |
| nerd (variante) | nerd_4.png | Miku_nerd_4.png | 1146166174356038674 |
| neutral | neutral.png | Miku_timida.png | 1146166174356039008 |
| pensando | pensando.png | Miku_pensando.png | 1146166174356039002 |
| riendo | riendo.png | Miku_emocionada.png | 1146166174356039012 |
| riendo (variante) | riendo_2.png | Miku_maldiciendo.png | 1146166174356039015 |
| saludando | saludando.png | Miku_saludando.png | 1146166174356038991 |
| shocked | shocked.png | Miku_sorprendida.png | 1146166174356076634 |
| sorprendido | sorprendido.png | Miku_sonrojada.png | 1146166174356076625 |
| triste | triste.png | Miku_llorando.png | 1146166174356076629 |

## luka

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| aburrido | aburrido.png | Luka_aburrida.png | 1146166174356076655 |
| broma | broma.png | Luka_bigote.png | 1146166174356031439 |
| broma (variante) | broma_2.png | Luka_chibi.png | 1146166174356031189 |
| broma (variante) | broma_3.png | Luka_con_miku.png | 1146166174356076660 |
| confundido | confundido.png | Luka_disgustada.png | 1146166174356038580 |
| decepcionado | decepcionado.png | Luka_decepcionada.png | 1146166174356031145 |
| decepcionado (variante) | decepcionado_2.png | Luka_decepcionada_2.png | 1146166174356031152 |
| decepcionado (variante) | decepcionado_3.png | Luka_decepcionada_3.png | 1146166174356031164 |
| decepcionado (variante) | decepcionado_4.png | Luka_decepcionada_4.png | 1146166174356076683 |
| emocionado | emocionado.png | Luka_bailando.png | 1146166174356098715 |
| emocionado (variante) | emocionado_2.png | Luka_emocionada.png | 1146166174356038587 |
| emocionado (variante) | emocionado_3.png | Luka_emocionada_2.png | 1146166174356031150 |
| emocionado (variante) | emocionado_4.png | Luka_emocionada_3.png | 1146166174356076572 |
| emocionado (variante) | emocionado_5.png | Luka_emocionada_4.png | 1146166174356098961 |
| enojado | enojado.png | Luka_maldiciendo.png | 1146166174356031175 |
| enojado (variante) | enojado_2.png | Luka_maldiciendo_2.png | 1146166174356038566 |
| feliz | feliz.png | Luka_feliz.png | 1146166174356038669 |
| feliz (variante) | feliz_2.png | Luka_flores.png | 1146166174356031419 |
| feliz (variante) | feliz_3.png | Luka_profesional_feliz.png | 1146166174356038584 |
| feliz (variante) | feliz_4.png | Luka_feliz_2.png | 1146166174356038635 |
| feliz (variante) | feliz_5.png | Luka_feliz_3.png | 1146166174356038593 |
| feliz (variante) | feliz_6.png | Luka_feliz_4.png | 1146166174356038588 |
| feliz (variante) | feliz_7.png | Luka_feliz_5.png | 1146166174356038570 |
| feliz (variante) | feliz_8.png | Luka_feliz_6.png | 1146166174356038562 |
| feliz (variante) | feliz_9.png | Luka_feliz_7.png | 1146166174356031165 |
| feliz (variante) | feliz_10.png | Luka_feliz_8.png | 1146166174356031168 |
| feliz (variante) | feliz_11.png | Luka_feliz_9.png | 1146166174356031172 |
| feliz (variante) | feliz_12.png | Luka_feliz_10.png | 1146166174356031176 |
| feliz (variante) | feliz_13.png | Luka_feliz_11.png | 1146166174356031383 |
| feliz (variante) | feliz_14.png | Luka_feliz_12.png | 1146166174356031393 |
| feliz (variante) | feliz_15.png | Luka_feliz_13.png | 1146166174356076751 |
| gritando | gritando.png | Luka_gritando.png | 1146166174356031158 |
| gritando (variante) | gritando_2.png | Luka_gritando_2.png | 1146166174356031163 |
| gritando (variante) | gritando_3.png | Luka_gritando_3.png | 1146166174356098766 |
| nerd | nerd.png | Luka_nerd.png | 1146166174356038664 |
| nerd (variante) | nerd_2.png | Luka_profesional.png | 1146166174356038680 |
| nerd (variante) | nerd_3.png | Luka_nerd_2.png | 1146166174356038557 |
| nerd (variante) | nerd_4.png | Luka_profesional_2.png | 1146166174356038567 |
| nerd (variante) | nerd_5.png | Luka_nerd_3.png | 1146166174356031155 |
| nerd (variante) | nerd_6.png | Luka_nerd_4.png | 1146166174356076740 |
| nervioso | nervioso.png | Luka_nerviosa.png | 1146166174356098752 |
| neutral | neutral.png | Luka_neutral.png | 1146166174356031390 |
| pensando | pensando.png | Luka_idea.png | 1146166174356031412 |
| pensando (variante) | pensando_2.png | Luka_pensando.png | 1146166174356038575 |
| presumido | presumido.png | Luka_coqueta.png | 1146166174356076729 |
| presumido (variante) | presumido_2.png | Luka_presumida.png | 1146166174356031166 |
| riendo | riendo.png | Luka_riendo.png | 1146166174356031173 |
| riendo (variante) | riendo_2.png | Luka_riendo_2.png | 1146166174356031387 |
| riendo (variante) | riendo_3.png | Luka_riendo_3.png | 1146166174356098785 |
| saludando | saludando.png | Luka_saludando.png | 1146166174356031438 |
| saludando (variante) | saludando_2.png | Luka_saludando_2.png | 1146166174356076690 |
| shocked | shocked.png | Luka_sorprendida.png | 1146166174356038578 |
| sorprendido | sorprendido.png | Luka_sorprendida_2.png | 1146166174356098738 |
| timido | timido.png | Luka_sonrojada.png | 1146166174356031171 |
| timido (variante) | timido_2.png | Luka_timida.png | 1146166174356031154 |
| timido (variante) | timido_3.png | Luka_sonrojada_2.png | 1146166174356098720 |
| timido (variante) | timido_4.png | Luka_timida_2.png | 1146166174356031394 |
| triste | triste.png | Luka_llorando.png | 1146166174356031448 |

## rin

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| aburrido | aburrido.png | Rin_aburrida.png | 1146166174356076636 |
| aburrido (variante) | aburrido_2.png | Rin_con_len.png | 1146166174356100063 |
| decepcionado | decepcionado.png | Rin_decepcionada.png | 1146166174356098701 |
| emocionado | emocionado.png | Rin_emocionada.png | 1146166174356038644 |
| emocionado (variante) | emocionado_2.png | Rin_emocionada_2.png | 1146166174356076738 |
| emocionado (variante) | emocionado_3.png | Rin_emocionada_3.png | 1146166174356100437 |
| enojado | enojado.png | Rin_maldiciendo.png | 1146166174356100430 |
| feliz | feliz.png | Rin_feliz.png | 1146166174356076668 |
| feliz (variante) | feliz_2.png | Rin_flores.png | 1146166174356098837 |
| feliz (variante) | feliz_3.png | Rin_feliz_2.png | 1146166174356100052 |
| gritando | gritando.png | Rin_gritando.png | 1146166174356098735 |
| nerd | nerd.png | Rin_nerd.png | 1146166174356076651 |
| nerd (variante) | nerd_2.png | Rin_nerd_2.png | 1146166174356098711 |
| nerd (variante) | nerd_3.png | Rin_nerd_3.png | 1146166174356100033 |
| nerd (variante) | nerd_4.png | Rin_nerd_4.png | 1146166174356100038 |
| nerd (variante) | nerd_5.png | Rin_nerd_5.png | 1146166174356100041 |
| nerd (variante) | nerd_6.png | Rin_nerd_6.png | 1146166174356100415 |
| nerd (variante) | nerd_7.png | Rin_nerd_7.png | 1146166174356100445 |
| neutral | neutral.png | Rin_neutral.png | 1146166174356100030 |
| pensando | pensando.png | Rin_pensando.png | 1146166174356100455 |
| presumido | presumido.png | Rin_presumida.png | 1146166174356100440 |
| riendo | riendo.png | Rin_riendo.png | 1146166174356098728 |
| riendo (variante) | riendo_2.png | Rin_riendo_2.png | 1146166174356100417 |
| shocked | shocked.png | Rin_sorprendida.png | 1146166174356100042 |
| timido | timido.png | Rin_sonrojada.png | 1146166174356100412 |
| timido (variante) | timido_2.png | Rin_timida.png | 1146166174356098744 |
| triste | triste.png | Rin_triste.png | 1146166174356076643 |

## len

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| broma | broma.png | Len_chibi.png | 1146166174356031236 |
| broma (variante) | broma_2.png | Len_tiburon.png | 1146166174356099080 |
| decepcionado | decepcionado.png | Len_decepcionado.png | 1146166174356031201 |
| decepcionado (variante) | decepcionado_2.png | Len_decepcionado_2.png | 1146166174356031213 |
| emocionado | emocionado.png | Len_emocionado.png | 1146166174356031214 |
| emocionado (variante) | emocionado_2.png | Len_emocionado_2.png | 1146166174356098928 |
| enojado | enojado.png | Len_maldiciendo.png | 1146166174356031203 |
| feliz | feliz.png | Len_feliz.png | 1146166174356031219 |
| feliz (variante) | feliz_2.png | Len_feliz_2.png | 1146166174356099089 |
| gritando | gritando.png | Len_gritando.png | 1146166174356031210 |
| gritando (variante) | gritando_2.png | Len_gritando_2.png | 1146166174356031218 |
| gritando (variante) | gritando_3.png | Len_gritando_3.png | 1146166174356031220 |
| gritando (variante) | gritando_4.png | Len_gritando_4.png | 1146166174356099287 |
| nerd | nerd.png | Len_nerd.png | 1146166174356031206 |
| neutral | neutral.png | Len_nerd_2.png | 1146166174356099293 |
| presumido | presumido.png | Len_presumido.png | 1146166174356031204 |
| presumido (variante) | presumido_2.png | Len_presumido_2.png | 1146166174356031205 |
| presumido (variante) | presumido_3.png | Len_presumido_3.png | 1146166174356031216 |
| presumido (variante) | presumido_4.png | Len_presumido_4.png | 1146166174356031222 |
| riendo | riendo.png | Len_riendo.png | 1146166174356098804 |
| shocked | shocked.png | Len_sorprendido.png | 1146166174356031207 |

## kaito

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| aburrido | aburrido.png | Kaito_aburrido.png | 1146166174356100145 |
| aburrido (variante) | aburrido_2.png | Kaito_aburrido_2.png | 1146166174356100174 |
| decepcionado | decepcionado.png | Kaito_decepcionado.png | 1146166174356099321 |
| decepcionado (variante) | decepcionado_2.png | Kaito_decepcionado_2.png | 1146166174356099342 |
| decepcionado (variante) | decepcionado_3.png | Kaito_decepcionado_3.png | 1146166174356099362 |
| emocionado | emocionado.png | Kaito_emocionado.png | 1146166174356099333 |
| emocionado (variante) | emocionado_2.png | Kaito_emocionado_2.png | 1146166174356099444 |
| emocionado (variante) | emocionado_3.png | Kaito_emocionado_3.png | 1146166174356100131 |
| emocionado (variante) | emocionado_4.png | Kaito_emocionado_4.png | 1146166174356100155 |
| enojado | enojado.png | Kaito_enojado.png | 1146166174356099336 |
| enojado (variante) | enojado_2.png | Kaito_maldiciendo.png | 1146166174356099368 |
| feliz | feliz.png | Kaito_feliz.png | 1146166174356099335 |
| feliz (variante) | feliz_2.png | Kaito_feliz_2.png | 1146166174356099436 |
| feliz (variante) | feliz_3.png | Kaito_feliz_3.png | 1146166174356099453 |
| feliz (variante) | feliz_4.png | Kaito_feliz_4.png | 1146166174356100100 |
| feliz (variante) | feliz_5.png | Kaito_feliz_5.png | 1146166174356100114 |
| gritando | gritando.png | Kaito_gritando.png | 1146166174356099377 |
| nerd | nerd.png | Kaito_nerd.png | 1146166174356099385 |
| nerd (variante) | nerd_2.png | Kaito_nerd_3.png | 1146166174356100116 |
| nerd (variante) | nerd_3.png | Kaito_nerd_4.png | 1146166174356100138 |
| nervioso | nervioso.png | Kaito_nervioso.png | 1146166174356099391 |
| neutral | neutral.png | Kaito_nerd_2.png | 1146166174356100102 |
| pensando | pensando.png | Kaito_pensando.png | 1146166174356100167 |
| presumido | presumido.png | Kaito_coqueto.png | 1146166174356100183 |
| presumido (variante) | presumido_2.png | Kaito_presumido.png | 1146166174356100109 |
| riendo | riendo.png | Kaito_riendo.png | 1146166174356100172 |
| saludando | saludando.png | Kaito_saludando.png | 1146166174356100110 |
| saludando (variante) | saludando_2.png | Kaito_saludando_2.png | 1146166174356100149 |
| shocked | shocked.png | Kaito_sorprendido.png | 1146166174356100121 |
| shocked (variante) | shocked_2.png | Kaito_sorprendido_3.png | 1146166174356100157 |
| sorprendido | sorprendido.png | Kaito_sorprendido_2.png | 1146166174356100130 |
| timido | timido.png | Kaito_timido.png | 1146166174356100123 |
| timido (variante) | timido_2.png | Kaito_timido_2.png | 1146166174356100128 |
| triste | triste.png | Kaito_llorando.png | 1146166174356099451 |
| triste (variante) | triste_2.png | Kaito_llorando_2.png | 1146166174356100207 |

## neru

| Reaccion | Archivo | Original | Pin |
|---|---|---|---|
| broma | broma.png | Neru_limon.png | 1146166174356099772 |
| decepcionado | decepcionado.png | Neru_decepcionada.png | 1146166174356098934 |
| decepcionado (variante) | decepcionado_2.png | Neru_decepcionada_2.png | 1146166174356099561 |
| enojado | enojado.png | Neru_maldiciendo.png | 1146166174356099103 |
| feliz | feliz.png | Neru_feliz.png | 1146166174356099010 |
| nerd | nerd.png | Neru_nerd.png | 1146166174356098911 |
| neutral | neutral.png | Neru_nerviosa.png | 1146166174356099553 |

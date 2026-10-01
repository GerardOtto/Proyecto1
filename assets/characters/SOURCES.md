# Origen de los avatares

Teto, Miku y Luka: renders MMD aportados por el usuario (carpeta "Proyecto vocaloid"), con el fondo
gris claro eliminado por `scripts/remove-bg.py` y alto limitado a 1080 px. Los nombres de la tabla son
los de esa carpeta, que hoy solo guarda las versiones ya recortadas (`.png`, mismo nombre base).
`license_status: unknown` hasta documentar el origen de modelos y renders (ver docs/09_LICENSING.md).
Rin y Len siguen siendo placeholders.

| Personaje | Reaccion | Archivo original |
|---|---|---|
| teto | neutral | Teto_feliz_3.jpg |
| teto | feliz | Teto_feliz_5.jpg |
| teto | sorprendida | Teto_sorprendida.jpg |
| teto | confundida | Teto_decepcionada_2.jpg (provisional: no hay "confundida") |
| teto | enojada | Teto_maldiciendo.jpg |
| teto | riendo | Teto_feliz_4.jpg |
| teto | nerd | Teto_nerd.jpg |
| teto | shocked | Teto_sorprendida_2.jpg |
| miku | neutral | Miku_timida.jpg |
| miku | feliz | Miku_feliz.jpg |
| miku | sorprendida | Miku_decepcionada_2.jpg |
| miku | confundida | Miku_pensando.jpg |
| miku | enojada | Miku_enojada_2.png (ya venia recortada) |
| miku | riendo | Miku_emocionada_2.jpg |
| miku | nerd | Miku_nerd.jpg |
| miku | shocked | Miku_gritando.jpg |
| luka | neutral | Luka_pensando.jpg |
| luka | feliz | Luka_feliz_3.jpg |
| luka | sorprendida | Luka_feliz_2.jpg |
| luka | confundida | Luka_disgustada.jpg |
| luka | enojada | Luka_maldiciendo_2.jpg |
| luka | riendo | Luka_feliz_5.jpg |
| luka | nerd | Luka_nerd_2.jpg |
| luka | shocked | Luka_sorprendida.jpg |

## Variantes (`characters.json > variants`)
Misma emocion que la principal; se alternan mientras el personaje habla.

| Personaje | Archivo | Original |
|---|---|---|
| teto | nerd_2 / nerd_3 / nerd_4 | Teto_nerd_2 / Teto_nerd_3 / Teto_nerd_4 |
| teto | feliz_2 / feliz_3 / feliz_4 | Teto_feliz / Teto_feliz_2 / Teto_saludando_2 |
| teto | riendo_2 | Teto_emocionada |
| teto | enojada_2 | Teto_decepcionada |
| miku | nerd_2 / nerd_3 | Miku_nerd_2 / Miku_nerd_3 |
| miku | feliz_2 / feliz_3 | Miku_feliz_3 / Miku_saludando |
| miku | shocked_2 | Miku_gritando_2 |
| miku | riendo_2 | Miku_maldiciendo |
| miku | confundida_2 | Miku_disgustada |
| miku | enojada_2 | Miku_decepcionada |
| luka | feliz_2 / feliz_3 / feliz_4 | Luka_feliz / Luka_feliz_6 / Luka_saludando |
| luka | nerd_2 | Luka_nerd |
| luka | riendo_2 / riendo_3 | Luka_maldiciendo / Luka_emocionada |
| luka | sorprendida_2 | Luka_feliz_4 |

Regenerar un avatar:
```bash
python scripts/remove-bg.py "<original>.jpg" assets/characters/<id>/<reaccion>.png
```
Requiere Python 3 con Pillow, numpy y scipy.

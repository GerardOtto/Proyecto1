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

Regenerar un avatar:
```bash
python scripts/remove-bg.py "<original>.jpg" assets/characters/<id>/<reaccion>.png
```
Requiere Python 3 con Pillow, numpy y scipy.

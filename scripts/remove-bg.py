"""Quita el fondo claro uniforme (renders MMD sobre gris ~#ECEAEB) y guarda PNG con transparencia.

Metodo determinista (sin IA):
  1. Color de fondo = mediana de los pixeles del borde parecidos al gris claro.
  2. Candidatos a fondo = pixeles a distancia < T_LO del fondo.
  3. Fondo = candidatos conectados al borde + huecos interiores grandes y muy parecidos al fondo.
  4. Banda de borde: alfa suave segun la distancia al fondo y descontaminacion del color
     (se quita el gris mezclado para evitar halos claros sobre fondos oscuros).
  5. Se recortan los margenes transparentes (arriba/izquierda/derecha); el borde inferior se conserva.

Uso: python scripts/remove-bg.py <entrada> <salida.png>
     python scripts/remove-bg.py --dir <carpeta_in> <carpeta_out>
     python scripts/remove-bg.py --gif <entrada.gif> <salida.gif> [cuadro_inicial]
Requiere Pillow, numpy y scipy. Herramienta de preparacion de assets (no forma parte del pipeline).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage

T_LO = 16.0  # distancia (max por canal) bajo la cual un pixel puede ser fondo
T_HI = 70.0  # distancia sobre la cual el pixel es 100% personaje dentro de la banda
HOLE_T = 9.0  # huecos interiores: deben ser casi exactamente del color del fondo
HOLE_MIN_AREA = 400


def estimate_bg(a: np.ndarray) -> np.ndarray:
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).reshape(-1, 3)
    light = border[(border.min(1) > 200) & (np.ptp(border, 1) < 12)]
    if len(light) < 50:
        return np.array([236.0, 234.0, 235.0])
    return np.median(light, 0)


def remove_bg(img: Image.Image, trim: bool = True, holes_ok: bool = True) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    bg = estimate_bg(a)
    dist = np.abs(a - bg).max(2)

    cand = dist < T_LO
    labels, _ = ndimage.label(cand)
    edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bgmask = np.isin(labels, edge_labels[edge_labels > 0])

    # huecos interiores (entre brazos, manos en corazon...)
    holes, nh = ndimage.label((dist < HOLE_T) & ~bgmask)
    if nh and holes_ok:
        idx = np.arange(1, nh + 1)
        areas = ndimage.sum(np.ones_like(dist), holes, index=idx)
        # el gris del fondo no tiene tinte azul; los brillos de la camisa plateada (Miku) si
        tint = ndimage.mean(a[..., 2] - a[..., 0], holes, index=idx) - (bg[2] - bg[0])
        keep = idx[(areas >= HOLE_MIN_AREA) & (tint < 2.0)]
        bgmask |= np.isin(holes, keep)

    # alfa: 0 en fondo, 1 en personaje, rampa en una banda de 3 px alrededor del fondo
    alpha = np.where(bgmask, 0.0, 1.0)
    band = ndimage.binary_dilation(bgmask, iterations=3) & ~bgmask
    ramp = np.clip((dist - T_LO * 0.5) / (T_HI - T_LO * 0.5), 0.0, 1.0)
    alpha[band] = ramp[band]
    # suaviza el escalon del borde del fondo (antialias) sin tocar el interior
    soft = ndimage.gaussian_filter(alpha, 0.6)
    edge = ndimage.binary_dilation(bgmask, iterations=2) & ~ndimage.binary_erosion(bgmask, iterations=1)
    alpha[edge] = np.minimum(alpha[edge], soft[edge])

    # descontaminacion: C = a*F + (1-a)*B  =>  F = (C - (1-a)*B) / a
    rgb = a.copy()
    m = (alpha > 0.02) & (alpha < 0.999)
    am = alpha[m][:, None]
    rgb[m] = np.clip((a[m] - (1 - am) * bg) / am, 0, 255)

    out = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)

    # recorte de margenes transparentes (conserva el borde inferior)
    ys, xs = np.nonzero(out[..., 3] > 8)
    if trim and len(ys):
        pad = 6
        x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, w)
        y0 = max(ys.min() - pad, 0)
        out = out[y0:h, x0:x1]
    return Image.fromarray(out, "RGBA")


def ends_transparent(im: Image.Image) -> bool:
    """Recorte limpio = las esquinas son totalmente transparentes."""
    al = np.asarray(im.getchannel("A"))
    return int(max(al[0, 0], al[0, -1], al[-1, 0], al[-1, -1])) == 0 and (al > 0).mean() < 0.9


def remove_bg_gif(src: str, dst: str, start: int = 0) -> None:
    """GIF animado: quita el fondo de cada cuadro (mismo lienzo, sin rellenar huecos), rota el orden
    para empezar en el cuadro `start` y guarda un GIF con transparencia binaria."""
    im = Image.open(src)
    frames, durations = [], []
    for f in ImageSequence.Iterator(im):
        durations.append(f.info.get("duration", 100))
        cut = np.asarray(remove_bg(f.convert("RGB"), trim=False, holes_ok=False))
        # GIF: paleta de 255 colores + indice 255 reservado para lo transparente (alfa binario).
        p = Image.fromarray(np.ascontiguousarray(cut[..., :3])).quantize(colors=255, dither=Image.Dither.NONE)
        idx = np.asarray(p).copy()
        idx[cut[..., 3] < 128] = 255
        q = Image.fromarray(idx, "P")
        pal = p.getpalette()[: 255 * 3]
        q.putpalette(pal + [0] * (768 - len(pal)))
        frames.append(q)
    frames = frames[start:] + frames[:start]
    durations = durations[start:] + durations[:start]
    frames[0].save(dst, save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=2, transparency=255, optimize=False)


def main() -> None:
    if sys.argv[1] == "--gif":
        remove_bg_gif(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 0)
        return
    if sys.argv[1] == "--dir":
        src, dst = sys.argv[2], sys.argv[3]
        os.makedirs(dst, exist_ok=True)
        for f in sorted(os.listdir(src)):
            if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            im = Image.open(os.path.join(src, f))
            name = os.path.splitext(f)[0] + ".png"
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
                lo = im.getchannel("A").getextrema()[0]
                if lo < 250 and ends_transparent(im):
                    im.save(os.path.join(dst, name))  # recorte limpio ya hecho: se copia tal cual
                    print(f"{f}: ya transparente")
                    continue
                # transparencia parcial (p. ej. rectangulo difuminado): se aplana sobre el gris
                flat = Image.new("RGBA", im.size, (236, 234, 235, 255))
                im = Image.alpha_composite(flat, im)
            remove_bg(im).save(os.path.join(dst, name), optimize=True)
            print(f"{f} -> {name}")
    else:
        remove_bg(Image.open(sys.argv[1])).save(sys.argv[2], optimize=True)


if __name__ == "__main__":
    main()

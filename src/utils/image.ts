// Lectura minima de dimensiones de imagen (PNG/JPEG/WebP/SVG/GIF) sin dependencias, para detectar
// imagenes vacias o corruptas en el catalogo.
import fs from "node:fs";

export interface ImageInfo {
  format: string;
  width: number;
  height: number;
}

export const readImageInfo = (file: string): ImageInfo | null => {
  const buf = fs.readFileSync(file);
  if (buf.length < 24) return null;
  // PNG
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { format: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.toString("ascii", 0, 3) === "GIF") {
    return { format: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { format: "webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { format: "webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { format: "webp", width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG: recorrer segmentos hasta SOFn
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1]!;
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { format: "jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  // SVG: width/height o viewBox
  const head = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  if (head.includes("<svg")) {
    const vb = /viewBox="\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)"/.exec(head);
    const w = /\swidth="([\d.]+)/.exec(head);
    const h = /\sheight="([\d.]+)/.exec(head);
    const width = Number(w?.[1] ?? vb?.[1]);
    const height = Number(h?.[1] ?? vb?.[2]);
    if (width > 0 && height > 0) return { format: "svg", width, height };
    return null;
  }
  return null;
};

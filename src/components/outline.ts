// Contorno de texto via text-shadow (16 direcciones + sombra suave). Compartido por subtitulos y
// rotulo del gancho. Sin efectos secundarios.
export const outline = (color: string, w: number): string => {
  const steps = 16;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    parts.push(`${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${color}`);
  }
  parts.push(`0 ${w * 0.8}px ${w}px rgba(0,0,0,0.5)`);
  return parts.join(", ");
};

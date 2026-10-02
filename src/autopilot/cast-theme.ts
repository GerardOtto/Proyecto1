// Tema visual derivado del elenco (ADR 0014): las tarjetas, cifras y recuadros generados del episodio
// usan la paleta de los personajes, igual que el fondo, para un look "aesthetic / kawaii-core" coherente.
// Puro.
import { characterPalette, mixHex } from "../timeline/palette";
import type { ThemeDef } from "./config";

const NIGHT = "#0c0a16";

export const castTheme = (
  base: ThemeDef,
  cast: string[],
  characters: Record<string, { subtitleColor: string; palette?: string[] }>,
): ThemeDef => {
  const [hostDeep, hostMid, hostLight] = characterPalette(characters[cast[0] ?? ""]);
  const [, foilMid, foilLight] = characterPalette(characters[cast[1] ?? cast[0] ?? ""]);
  return {
    ...base,
    label: `Paleta de ${cast.slice(0, 2).join(" y ")}`,
    background: "palette",
    gradient: [hostDeep, mixHex(hostMid, NIGHT, 0.6), mixHex(foilMid, NIGHT, 0.6), hostDeep].map((c) => `0x${c.slice(1)}`),
    card: [mixHex(hostMid, NIGHT, 0.62), mixHex(hostDeep, NIGHT, 0.35)],
    accent: hostLight,
    muted: mixHex(foilLight, "#ffffff", 0.25),
    border: hostLight,
  };
};

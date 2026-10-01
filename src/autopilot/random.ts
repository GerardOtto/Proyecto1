// Aleatoriedad determinista para el autopiloto: misma semilla => mismas decisiones (reproducible).
import { sha256 } from "../utils/hash";

/** Numero en [0, 1) derivado de una semilla. */
export const seeded = (seed: string): number => parseInt(sha256(seed).slice(0, 12), 16) / 2 ** 48;

export const pick = <T>(items: readonly T[], seed: string): T => {
  if (items.length === 0) throw new Error(`pick(): lista vacia (seed ${seed})`);
  return items[Math.floor(seeded(seed) * items.length)]!;
};

/** Elige evitando `avoid` si hay alternativas. */
export const pickAvoiding = <T>(items: readonly T[], avoid: readonly T[], seed: string): T => {
  const rest = items.filter((x) => !avoid.includes(x));
  return pick(rest.length > 0 ? rest : items, seed);
};

/** Mezcla determinista (Fisher-Yates con semillas derivadas). */
export const shuffle = <T>(items: readonly T[], seed: string): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seeded(`${seed}:${i}`) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

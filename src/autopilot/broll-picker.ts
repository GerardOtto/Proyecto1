// Seleccion de relleno (b-roll) para un episodio (docs/12_GUIA_PRODUCCION.md, ADR 0013): primero los GIF
// de Vocaloid de los personajes del elenco, despues lo que coincide con el tema y el escenario; los gatos
// genericos al final. Las capturas de noticias/paginas oficiales las decide el brief de cada noticia. Pura.
import type { Catalog } from "../catalog/catalog";
import type { EpisodePlan } from "./types";

/** Todos los personajes del episodio (con dialogo + cameo mudo). */
export const castOf = (plan: Pick<EpisodePlan, "casting">): string[] =>
  [plan.casting.host, plan.casting.foil, plan.casting.guest, plan.casting.cameo].filter((c): c is string => !!c);

const EXCLUDED = ["captura", "noticia", "oficial"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export interface RankedBroll {
  id: string;
  score: number;
  castHits: number;
  topicHits: number;
  description: string;
  tags: string[];
}

/** Palabras del tema para comparar con los tags del catalogo (entidades, palabra clave, categoria, escenario). */
export const topicTagsOf = (plan: Pick<EpisodePlan, "topic"> & { setting?: string }): string[] => {
  const t = plan.topic as { keyword?: string; category?: string; entities?: string[]; id?: string };
  const words = [t.keyword ?? "", t.category ?? "", t.id ?? "", ...(t.entities ?? []), plan.setting ?? ""];
  return [...new Set(words.flatMap((w) => [norm(w), ...norm(w).split("_")]).filter((w) => w.length > 2))];
};

export const rankBroll = (catalog: Catalog, cast: string[], topicTags: string[]): RankedBroll[] =>
  Object.values(catalog.entries)
    .filter((e) => (e.type as string) === "broll" && !e.tags.some((t) => EXCLUDED.includes(t)))
    .map((e) => {
      const tags = e.tags.map(norm);
      const castHits = cast.filter((c) => tags.includes(c)).length;
      const topicHits = topicTags.filter((t) => tags.includes(t)).length;
      const score = 4 * castHits + 2 * topicHits + (tags.includes("vocaloid") ? 1 : 0) - (tags.includes("gatos") ? 3 : 0);
      return { id: e.id, score, castHits, topicHits, description: e.description ?? e.tags.join(", "), tags: e.tags };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

/**
 * Pozo de relleno del episodio (front matter `broll:`): intercala lo del TEMA (hasta la mitad) con los GIF
 * de Vocaloid del elenco; sin gatos si hay alternativas.
 */
export const pickBroll = (catalog: Catalog, plan: Pick<EpisodePlan, "casting" | "topic"> & { setting?: string }, max = 8): string[] => {
  const ranked = rankBroll(catalog, castOf(plan), topicTagsOf(plan));
  const topical = ranked.filter((r) => r.topicHits > 0 && r.score > 0).slice(0, Math.ceil(max / 2));
  // GIF del elenco por turnos (host, foil, invitado, cameo): todos quedan representados.
  const queues = castOf(plan).map((c) => ranked.filter((r) => r.tags.includes(c) && !topical.includes(r)));
  const cast: RankedBroll[] = [];
  for (let round = 0; queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      const r = q[round];
      if (r && !cast.includes(r)) cast.push(r);
    }
  }
  const mixed: RankedBroll[] = [];
  for (let i = 0; mixed.length < max && (i < topical.length || i < cast.length); i++) {
    if (topical[i]) mixed.push(topical[i]!);
    if (cast[i] && mixed.length < max) mixed.push(cast[i]!);
  }
  if (mixed.length >= 3) return mixed.map((r) => r.id);
  const good = ranked.filter((r) => r.score > 0);
  return (good.length >= 3 ? good : ranked).slice(0, max).map((r) => r.id);
};

/** GIF de Vocaloid por personaje del elenco, para el relleno de las lineas de cada uno. */
export const characterBroll = (catalog: Catalog, cast: string[]): Record<string, string[]> =>
  Object.fromEntries(
    cast.map((c) => [
      c,
      Object.values(catalog.entries)
        .filter((e) => (e.type as string) === "broll" && e.tags.includes("vocaloid") && e.tags.includes(c))
        .map((e) => e.id)
        .sort(),
    ]),
  );

// Planificador de episodio: QUE tema, con que formato, que personajes y que tema visual.
// Determinista: misma fecha + mismo historial + mismas noticias => mismo plan.
import type { EngineConfig } from "../catalog/catalog";
import type { AutopilotConfig, EvergreenTopic } from "./config";
import { active, evergreenLastUsed, newsAlreadyUsed, recent, type History } from "./history";
import { clusterKeyword, type SourcesConfig } from "./news";
import { pick, pickAvoiding, seeded, shuffle } from "./random";
import type { ArcBeat, Casting, EpisodePlan, FormatId, NewsCluster, TopicBrief, TopicCategory } from "./types";

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "tema";

export const topicFromEvergreen = (t: EvergreenTopic): TopicBrief => ({
  id: t.id,
  kind: "evergreen",
  category: t.category,
  keyword: t.keyword,
  title: t.title,
  hookTitle: t.hookTitle,
  points: t.points,
  questions: t.questions,
  punchline: t.punchline,
  takeaway: t.takeaway,
  ...(t.twist ? { twist: t.twist } : {}),
  ...(t.example ? { example: t.example } : {}),
  visual: t.visual,
  sources: t.sources,
  entities: t.entities,
});

export const topicFromCluster = (c: NewsCluster, cfg: SourcesConfig): TopicBrief => {
  const lead = c.items[0]!;
  const keyword = clusterKeyword(c, cfg);
  return {
    id: `news_${slugify(lead.title)}`,
    kind: "news",
    category: "news",
    keyword,
    title: lead.title,
    hookTitle: `¿Qué pasó con *${keyword}*?`.slice(0, 60),
    points: c.items.slice(0, 4).map((i) => (i.summary || i.title).slice(0, 220)),
    takeaway: "",
    visual: { type: "headline", title: lead.title, caption: new URL(lead.url).hostname.replace(/^www\./, "") },
    sources: [...new Set(c.items.map((i) => i.url))],
    entities: c.entities,
    articles: c.items.map(({ id, feed, lang, title, summary, url, publishedAt }) => ({ id, feed, lang, title, summary, url, publishedAt })),
  };
};

/** Valida un brief manual (--brief). Exige los campos que usan el escritor, los graficos y la publicacion. */
export const parseBrief = (raw: unknown, file = "brief"): TopicBrief => {
  const b = raw as Partial<TopicBrief>;
  const missing = (["id", "kind", "category", "keyword", "title", "hookTitle"] as const).filter((k) => typeof b?.[k] !== "string" || !b[k]);
  if (!Array.isArray(b?.points) || b.points.length === 0) missing.push("points" as never);
  if (!Array.isArray(b?.sources) || b.sources.length === 0) missing.push("sources" as never);
  if (missing.length) throw new Error(`${file}: faltan campos ${missing.join(", ")}`);
  if (b.kind !== "news" && b.kind !== "evergreen") throw new Error(`${file}: kind debe ser news o evergreen`);
  if (b.kind === "news" && !b.articles?.length) throw new Error(`${file}: una noticia necesita articles (unica fuente de hechos del escritor)`);
  return { takeaway: "", entities: [], ...b } as TopicBrief;
};

/** Primer cluster con puntuacion suficiente y no usado antes. */
export const pickNews = (clusters: NewsCluster[], history: History, cfg: SourcesConfig): NewsCluster | null =>
  clusters.find((c) => c.score >= cfg.minScore && !c.items.some((i) => newsAlreadyUsed(history, i.url, i.title))) ?? null;

/** Tema evergreen menos usado; desempata rotando categorias respecto al ultimo episodio. */
export const pickEvergreen = (bank: EvergreenTopic[], history: History, seed: string, category?: string): EvergreenTopic => {
  const last = evergreenLastUsed(history);
  const lastCats = recent(history, 2).map((e) => e.topicId).map((id) => bank.find((t) => t.id === id)?.category);
  const pool = bank.filter((t) => !category || t.category === category);
  if (pool.length === 0) throw new Error(`No hay temas evergreen para la categoria ${category}`);
  const ranked = shuffle(pool, seed).sort((a, b) => {
    const ua = last.get(a.id) ?? "";
    const ub = last.get(b.id) ?? "";
    if (ua !== ub) return ua.localeCompare(ub); // nunca usado ("") primero, luego el mas antiguo
    const ca = lastCats.includes(a.category) ? 1 : 0;
    const cb = lastCats.includes(b.category) ? 1 : 0;
    return ca - cb;
  });
  return ranked[0]!;
};

export const chooseFormat = (category: TopicCategory, ap: AutopilotConfig, seed: string, history: History): FormatId => {
  const candidates = (Object.entries(ap.formats.formats) as Array<[FormatId, AutopilotConfig["formats"]["formats"][FormatId]]>)
    .filter(([, f]) => f.for.includes(category))
    .map(([id]) => id);
  if (candidates.length === 0) return category === "news" ? "news_explainer" : "concept_lesson";
  const lastFormat = recent(history, 1)[0]?.format as FormatId | undefined;
  return pickAvoiding(candidates, lastFormat ? [lastFormat] : [], `${seed}:format`);
};

/** Un personaje esta listo si tiene avatares reales (no placeholder) y voz o saludo configurados. */
export const readyCharacters = (engine: EngineConfig, allowPlaceholder = false): string[] =>
  Object.entries(engine.characters.characters)
    .filter(([, c]) => {
      const lic = c.license?.license_status ?? "unknown";
      // Voz = referenceId de Fish Audio: un saludo pregrabado solo no alcanza para el resto del dialogo.
      const hasVoice = !!c.voice?.fish?.referenceId;
      return allowPlaceholder || (lic !== "placeholder" && hasVoice);
    })
    .map(([id]) => id)
    .sort();

/** Personajes mudos (ADR 0011) con avatares reales: pueden aparecer como cameo sin voz. */
export const silentCharacters = (engine: EngineConfig, allowPlaceholder = false): string[] =>
  Object.entries(engine.characters.characters)
    .filter(([, c]) => c.voice?.mute && (allowPlaceholder || (c.license?.license_status ?? "unknown") !== "placeholder"))
    .map(([id]) => id)
    .sort();

/** Etiquetas del tema para relacionar personajes y escenario (categoria, tipo, entidades, palabra clave). Pura. */
export const topicTags = (topic: TopicBrief): string[] =>
  [...new Set([topic.category, topic.kind, ...(topic.entities ?? []), ...slugify(topic.keyword).split("_")].map((t) => slugify(t)).filter(Boolean))];

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

/**
 * Escenario (ADR 0012): el de mas afinidad con el tema (tags + lista de la categoria), sin repetir el
 * del episodio anterior; desempate determinista por semilla. Pura.
 */
export const chooseSetting = (ap: AutopilotConfig, topic: TopicBrief, history: History, seed: string): string | undefined => {
  const all = Object.entries(ap.settings?.settings ?? {});
  if (all.length === 0) return undefined;
  const tags = topicTags(topic);
  const byCat = ap.settings.byCategory[topic.category] ?? [];
  const last = recent(history, 1)[0]?.setting;
  const scored = shuffle(all, `${seed}:setting`)
    .filter(([id]) => id !== last || all.length === 1)
    .map(([id, s]) => ({ id, score: overlap(s.tags.map(slugify), tags) * 2 + (byCat.includes(id) ? 3 - byCat.indexOf(id) * 0.5 : 0) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.id;
};

/** Etapa de cada narrativa secundaria cuyo personaje esta en el episodio (ADR 0012). Pura. */
export const arcBeats = (ap: AutopilotConfig, history: History, casting: Casting): ArcBeat[] => {
  const cast = [casting.host, casting.foil, casting.guest, casting.cameo].filter(Boolean);
  const done = active(history);
  return (ap.arcs?.arcs ?? [])
    .filter((a) => cast.includes(a.character))
    .map((a) => {
      const appearances = done.filter((e) => [e.casting.host, e.casting.foil, e.casting.guest, e.casting.cameo].includes(a.character)).length;
      const stage = [...a.stages].reverse().find((s) => appearances >= s.from) ?? a.stages[0]!;
      return {
        id: a.id,
        label: a.label,
        appearances,
        stage: stage.label,
        beat: stage.beat,
        finaleAvailable: done.length >= a.minEpisodesBeforeFinale,
        finale: a.finale,
      };
    });
};

export const chooseCasting = (ap: AutopilotConfig, ready: string[], history: History, seed: string, silent: string[] = [], tags: string[] = []): Casting => {
  const roles = ap.casting.roles;
  const hosts = roles.host.filter((c) => ready.includes(c));
  if (hosts.length === 0) throw new Error("No hay personajes listos para el rol host (revisa avatares/voces o usa --allow-placeholder)");
  const recentPairs = recent(history, ap.casting.pairsAvoidRepeatWindow).map((e) => `${e.casting.host}+${e.casting.foil}`);
  // Afinidad personaje-tema (lore.json > affinities): a igualdad, el orden lo decide la semilla.
  const aff = (c: string) => overlap((ap.lore?.affinities?.[c] ?? []).map(slugify), tags);
  const pairs = shuffle(
    hosts.flatMap((h) => roles.foil.filter((f) => f !== h && ready.includes(f)).map((f) => ({ host: h, foil: f }))),
    `${seed}:pairs`,
  ).sort((a, b) => aff(b.host) + aff(b.foil) - (aff(a.host) + aff(a.foil)));
  if (pairs.length === 0) throw new Error("Se necesitan al menos 2 personajes listos (host + foil)");
  const fresh = pairs.find((p) => !recentPairs.includes(`${p.host}+${p.foil}`)) ?? pairs[0]!;
  const guests = roles.guest.filter((g) => ready.includes(g) && g !== fresh.host && g !== fresh.foil);
  const withGuest = guests.length > 0 && seeded(`${seed}:guest`) < ap.casting.guestProbability;
  const cast: Casting = withGuest ? { ...fresh, guest: pick(guests, `${seed}:guestpick`) } : fresh;
  // Cameo mudo (Neru): solo escucha y reacciona con su SFX de firma; no cuenta como rol con dialogo.
  const cameos = (ap.casting.cameo?.characters ?? []).filter((c) => silent.includes(c) && c !== cast.host && c !== cast.foil && c !== cast.guest);
  const withCameo = cameos.length > 0 && seeded(`${seed}:cameo`) < (ap.casting.cameo?.probability ?? 0);
  return withCameo ? { ...cast, cameo: pick(cameos, `${seed}:cameopick`) } : cast;
};

export const chooseTheme = (ap: AutopilotConfig, category: TopicCategory, history: History, seed: string): string => {
  const options = ap.themes.byCategory[category] ?? Object.keys(ap.themes.themes);
  const last = recent(history, 1)[0]?.theme;
  return pickAvoiding(options, last ? [last] : [], `${seed}:theme`);
};

export interface PlanInput {
  date: string; // YYYY-MM-DD
  ap: AutopilotConfig;
  engine: EngineConfig;
  history: History;
  clusters: NewsCluster[];
  mode: "auto" | "news" | "evergreen";
  forceTopic?: string;
  /** Brief redactado a mano (p. ej. una noticia caliente investigada fuera del lector RSS). */
  forceBrief?: TopicBrief;
  /** Fuerza el formato (si no, se elige por categoria evitando repetir el ultimo). */
  format?: FormatId;
  category?: string;
  allowPlaceholder?: boolean;
  /** Sin escritor LLM no se pueden escribir noticias: se cae a evergreen. */
  canWriteNews: boolean;
}

export const planEpisode = (input: PlanInput): EpisodePlan => {
  const { ap, history, date } = input;
  const baseSeed = `${date}:${history.episodes.length}`;
  let topic: TopicBrief;
  if (input.forceBrief) {
    topic = input.forceBrief;
  } else if (input.forceTopic) {
    const t = ap.evergreen.find((x) => x.id === input.forceTopic);
    if (!t) throw new Error(`Tema evergreen desconocido: ${input.forceTopic}`);
    topic = topicFromEvergreen(t);
  } else {
    const news = input.mode !== "evergreen" && input.canWriteNews ? pickNews(input.clusters, history, ap.sources) : null;
    if (input.mode === "news" && !news) throw new Error(input.canWriteNews ? "No hay noticias nuevas con puntuacion suficiente" : "Las noticias requieren el escritor LLM");
    topic = news ? topicFromCluster(news, ap.sources) : topicFromEvergreen(pickEvergreen(ap.evergreen, history, baseSeed, input.category));
  }
  const seed = `${baseSeed}:${topic.id}`;
  const format = input.format ?? chooseFormat(topic.category, ap, seed, history);
  if (!ap.formats.formats[format]) throw new Error(`Formato desconocido: ${format}`);
  const f = ap.formats.formats[format];
  const casting = chooseCasting(ap, readyCharacters(input.engine, input.allowPlaceholder), history, seed, silentCharacters(input.engine, input.allowPlaceholder), topicTags(topic));
  const setting = chooseSetting(ap, topic, history, seed);
  const arcs = arcBeats(ap, history, casting);
  return {
    episodeId: `ep_${date.replace(/-/g, "")}_${slugify(topic.kind === "news" ? topic.keyword + "_" + topic.title : topic.id).slice(0, 32)}`,
    date,
    topic,
    format,
    structure: f.structure,
    targetSec: f.targetSec,
    casting,
    theme: chooseTheme(ap, topic.category, history, seed),
    ...(setting ? { setting } : {}),
    ...(arcs.length ? { arcs } : {}),
    seed,
  };
};

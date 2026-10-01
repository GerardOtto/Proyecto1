// Noticias: lectura de feeds RSS/Atom, puntuacion por nicho y frescura, deduplicacion y agrupado.
// Las funciones de parseo/puntuacion son puras (testeadas con fixtures); solo fetchFeeds usa red.
import { XMLParser } from "fast-xml-parser";
import { sha256 } from "../utils/hash";
import type { NewsCluster, NewsItem, ScoredNews } from "./types";

export interface FeedConfig {
  id: string;
  url: string;
  lang: string;
  weight: number;
}

export interface SourcesConfig {
  maxAgeHours: number;
  feeds: FeedConfig[];
  keywords: Record<string, number>;
  blocklist: string[];
  minScore: number;
  freshnessHalfLifeHours: number;
}

export const normalizeText = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const stripHtml = (s: string): string =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const text = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return text(o["#text"] ?? o["@_href"] ?? "");
  }
  return "";
};

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Parsea RSS 2.0 o Atom. Devuelve [] si el XML no es un feed reconocible. */
export const parseFeed = (xml: string, feed: Pick<FeedConfig, "id" | "lang">): NewsItem[] => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  const items: NewsItem[] = [];
  const rss = doc["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  if (channel) {
    for (const it of asArray(channel["item"] as Record<string, unknown> | Record<string, unknown>[])) {
      const title = stripHtml(text(it["title"]));
      const url = text(it["link"]) || text(it["guid"]);
      if (!title || !url) continue;
      const date = text(it["pubDate"]) || text(it["dc:date"]);
      items.push({
        id: sha256(url).slice(0, 16),
        feed: feed.id,
        lang: feed.lang,
        title,
        summary: stripHtml(text(it["description"]) || text(it["content:encoded"])).slice(0, 600),
        url,
        publishedAt: toIso(date),
      });
    }
    return items;
  }
  const atom = doc["feed"] as Record<string, unknown> | undefined;
  if (atom) {
    for (const e of asArray(atom["entry"] as Record<string, unknown> | Record<string, unknown>[])) {
      const title = stripHtml(text(e["title"]));
      const links = asArray(e["link"] as Record<string, unknown> | Record<string, unknown>[]);
      const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      const url = alt ? String(alt["@_href"] ?? "") : "";
      if (!title || !url) continue;
      items.push({
        id: sha256(url).slice(0, 16),
        feed: feed.id,
        lang: feed.lang,
        title,
        summary: stripHtml(text(e["summary"]) || text(e["content"])).slice(0, 600),
        url,
        publishedAt: toIso(text(e["published"]) || text(e["updated"])),
      });
    }
  }
  return items;
};

const toIso = (s: string): string | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const keywordRegex = (kw: string): RegExp => new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);

export const scoreItem = (item: NewsItem, cfg: SourcesConfig, now: Date): ScoredNews => {
  const hay = normalizeText(`${item.title} ${item.title} ${item.summary}`);
  const matched: string[] = [];
  let score = 0;
  for (const [kw, w] of Object.entries(cfg.keywords)) {
    if (kw.startsWith("$")) continue;
    if (keywordRegex(normalizeText(kw)).test(hay)) {
      matched.push(kw);
      score += w;
    }
  }
  const blocked = cfg.blocklist.some((b) => keywordRegex(normalizeText(b)).test(hay));
  const ageHours = item.publishedAt ? Math.max(0, (now.getTime() - Date.parse(item.publishedAt)) / 3_600_000) : null;
  const freshness = ageHours === null ? 0.5 : Math.pow(0.5, ageHours / cfg.freshnessHalfLifeHours);
  const weight = cfg.feeds.find((f) => f.id === item.feed)?.weight ?? 1;
  const finalScore = blocked || (ageHours !== null && ageHours > cfg.maxAgeHours) ? 0 : score * weight * (0.4 + 0.6 * freshness);
  return { ...item, score: Math.round(finalScore * 100) / 100, matched, ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10 };
};

const titleTokens = (s: string): Set<string> =>
  new Set(normalizeText(s).split(" ").filter((w) => w.length > 3));

export const jaccard = (a: Set<string>, b: Set<string>): number => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
};

/** Agrupa noticias de la misma historia (titulos parecidos o mismas entidades fuertes). */
export const clusterNews = (items: ScoredNews[], cfg: SourcesConfig): NewsCluster[] => {
  const strong = (kw: string) => (cfg.keywords[kw] ?? 0) >= 4;
  const sorted = [...items].filter((i) => i.score > 0).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const clusters: NewsCluster[] = [];
  for (const it of sorted) {
    const tk = titleTokens(it.title);
    const ent = it.matched.filter(strong);
    const target = clusters.find((c) => {
      const lead = c.items[0]!;
      const sim = jaccard(tk, titleTokens(lead.title));
      const sharedEntities = ent.filter((e) => c.entities.includes(e)).length;
      return sim >= 0.35 || (sharedEntities >= 2 && sim >= 0.15);
    });
    if (target) {
      if (!target.items.some((x) => x.url === it.url)) target.items.push(it);
      target.entities = [...new Set([...target.entities, ...ent])];
    } else {
      clusters.push({ key: it.id, items: [it], score: 0, entities: ent });
    }
  }
  for (const c of clusters) {
    const feeds = new Set(c.items.map((i) => i.feed)).size;
    c.score = Math.round(c.items[0]!.score * (1 + 0.25 * (feeds - 1)) * 100) / 100;
  }
  return clusters.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
};

/** Palabra clave visible: la entidad de mayor peso, con la grafia del titulo original. */
export const clusterKeyword = (c: NewsCluster, cfg: SourcesConfig): string => {
  const lead = c.items[0]!;
  const ranked = [...lead.matched].sort((a, b) => (cfg.keywords[b] ?? 0) - (cfg.keywords[a] ?? 0) || b.length - a.length);
  const kw = ranked[0];
  if (!kw) return lead.title.split(" ").slice(0, 3).join(" ");
  const m = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").exec(lead.title.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  return m ? lead.title.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(m.index, m.index + kw.length) : kw;
};

export interface FetchResult {
  items: NewsItem[];
  errors: Array<{ feed: string; error: string }>;
}

export const fetchFeeds = async (cfg: SourcesConfig, timeoutMs = 12_000): Promise<FetchResult> => {
  const errors: FetchResult["errors"] = [];
  const results = await Promise.all(
    cfg.feeds.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { "User-Agent": "short-video-engine/0.1 (+autopilot)" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseFeed(await res.text(), f);
        if (items.length === 0) throw new Error("feed vacio o formato no reconocido");
        return items;
      } catch (err) {
        errors.push({ feed: f.id, error: (err as Error).message });
        return [];
      }
    }),
  );
  return { items: results.flat(), errors };
};

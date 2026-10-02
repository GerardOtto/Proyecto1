// Carga de la configuracion del autopiloto (config/autopilot/*.json).
import { readJson } from "../utils/fs";
import { fromRepo } from "../utils/paths";
import { assertSchema } from "../validation/schemas";
import type { SourcesConfig } from "./news";
import type { BeatKind, FormatId, TopicCategory, VisualSpec } from "./types";

export interface EvergreenTopic {
  id: string;
  category: Exclude<TopicCategory, "news">;
  keyword: string;
  title: string;
  hookTitle: string;
  points: string[];
  questions: string[];
  punchline: { line: string; reply: string };
  takeaway: string;
  twist?: string;
  example?: string;
  visual: VisualSpec;
  sources: string[];
  entities: string[];
}

export interface FormatsConfig {
  formats: Record<FormatId, { label: string; for: TopicCategory[]; targetSec: number; structure: BeatKind[] }>;
  mix: { news: number; evergreen: number };
}

export interface CastingConfig {
  roles: { host: string[]; foil: string[]; guest: string[] };
  pairsAvoidRepeatWindow: number;
  guestProbability: number;
  /** Personajes mudos que pueden aparecer de cameo (ADR 0011). */
  cameo?: { characters: string[]; probability: number };
  personalities: Record<string, string>;
}

/** Contexto de los personajes (lore) para referencias PASIVAS en los guiones (ADR 0011). */
export interface LoreConfig {
  rules: string[];
  characters: Record<string, string[]>;
  /** Contexto compartido: se ofrece si al menos `min` de sus personajes estan en el episodio. */
  shared: Array<{ id: string; characters: string[]; min: number; facts: string[] }>;
  /** Memes y canciones de la comunidad: se ofrecen si alguno de sus personajes esta (o si no tiene personajes). */
  community?: Array<{ id: string; characters: string[]; facts: string[] }>;
  /** Temas (tags) con los que conecta cada personaje: el casting prefiere afinidad con el tema (ADR 0012). */
  affinities?: Record<string, string[]>;
}

/** Escenarios (ADR 0012): fondo + lugar del que los personajes son conscientes. */
export interface SettingDef {
  label: string;
  background: string;
  tags: string[];
  awareness: string[];
}
export interface SettingsConfig {
  settings: Record<string, SettingDef>;
  byCategory: Partial<Record<TopicCategory, string[]>>;
}

/** Narrativas secundarias entre episodios (ADR 0012). */
export interface ArcDef {
  id: string;
  label: string;
  character: string;
  minEpisodesBeforeFinale: number;
  stages: Array<{ from: number; label: string; beat: string }>;
  finale: string;
}
export interface ArcsConfig {
  arcs: ArcDef[];
}

export interface ThemeDef {
  label: string;
  background: string;
  gradient: string[];
  card: [string, string];
  accent: string;
  muted: string;
}

export interface ThemesConfig {
  themes: Record<string, ThemeDef>;
  byCategory: Partial<Record<TopicCategory, string[]>>;
}

export interface SfxRule {
  id: string;
  when: { section?: string[]; reaction?: string[]; character?: string[] };
  pickTags: string[];
  avoidTags?: string[];
  volume: number;
  anchor: "start" | "end";
}

export interface SfxRulesConfig {
  maxPerVideo: number;
  minBlocksBetween: number;
  excludeTags: string[];
  rules: SfxRule[];
}

export interface HumorConfig {
  greeting: string;
  memeBeats: Array<{ meme: string; sfx: string }>;
  hookTemplates: Partial<Record<TopicCategory, string[]>>;
  foilQuestions: string[];
  foilMisunderstandings: string[];
  foilReactions: string[];
  hostCorrections: string[];
  punchlines: string[];
  punchlineReplies: string[];
  ctaLines: Array<[string, string]>;
  ctaVisual: string;
}

export interface AutopilotConfig {
  sources: SourcesConfig;
  evergreen: EvergreenTopic[];
  formats: FormatsConfig;
  casting: CastingConfig;
  themes: ThemesConfig;
  sfx: SfxRulesConfig;
  humor: HumorConfig;
  lore: LoreConfig;
  settings: SettingsConfig;
  arcs: ArcsConfig;
}

const cfgFile = (name: string) => fromRepo("config/autopilot", name);

export const loadAutopilotConfig = (): AutopilotConfig => {
  const bank = assertSchema<{ topics: EvergreenTopic[] }>("evergreen", readJson(cfgFile("evergreen.json")), "config/autopilot/evergreen.json");
  const ids = new Set<string>();
  for (const t of bank.topics) {
    if (ids.has(t.id)) throw new Error(`evergreen.json: id duplicado ${t.id}`);
    ids.add(t.id);
  }
  return {
    sources: readJson<SourcesConfig>(cfgFile("sources.json")),
    evergreen: bank.topics,
    formats: readJson<FormatsConfig>(cfgFile("formats.json")),
    casting: readJson<CastingConfig>(cfgFile("casting.json")),
    themes: readJson<ThemesConfig>(cfgFile("themes.json")),
    sfx: readJson<SfxRulesConfig>(cfgFile("sfx-rules.json")),
    humor: readJson<HumorConfig>(cfgFile("humor.json")),
    lore: readJson<LoreConfig>(cfgFile("lore.json")),
    settings: readJson<SettingsConfig>(cfgFile("settings.json")),
    arcs: readJson<ArcsConfig>(cfgFile("arcs.json")),
  };
};

// Orquestacion del autopiloto: tema -> plan -> graficos -> guion -> SFX -> lint -> proyecto listo para
// revision -> (opcional) produccion con el pipeline existente -> kit de publicacion.
import fs from "node:fs";
import path from "node:path";
import { buildCatalog, loadProject, type EngineConfig } from "../catalog/catalog";
import { AnthropicProvider } from "../director/llm/anthropic";
import type { LLMProvider } from "../director/llm/provider";
import { stepAnalyze } from "../pipeline/steps";
import { writeJson } from "../utils/fs";
import { log } from "../utils/log";
import { fromRepo, toRepoRel } from "../utils/paths";
import { castOf, characterBroll, pickBroll } from "./broll-picker";
import type { AutopilotConfig } from "./config";
import { generateEpisodeGraphics } from "./graphics";
import { loadHistory, recordPlan, saveHistory, type History } from "./history";
import { lintScript, type LintIssue } from "./lint";
import { buildWriterBrief, writeLLMScript } from "./llm-writer";
import { generateNewsVisuals } from "./newscards";
import { renderFrontMatter } from "./script-doc";
import { clusterNews, fetchFeeds, scoreItem } from "./news";
import { planEpisode } from "./planner";
import { buildPublishTexts, buildSchedule, writePublishKit } from "./publish";
import { autoSfx, type SfxDecision } from "./sfx-director";
import { writeTemplateScript, type WriterAssets } from "./template-writer";
import type { EpisodePlan, FormatId, NewsCluster, TopicBrief } from "./types";

export interface AutopilotOptions {
  date: string;
  mode: "auto" | "news" | "evergreen";
  /** manual: prepara el episodio (plan, graficos, kit) y deja script.md como esqueleto para escribirlo a mano. */
  writer: "auto" | "llm" | "template" | "manual";
  tts: string;
  topic?: string;
  brief?: TopicBrief;
  format?: FormatId;
  category?: string;
  offline?: boolean;
  allowPlaceholder?: boolean;
  graphics?: boolean;
  provider?: LLMProvider;
  now?: Date;
}

export interface EpisodeResult {
  plan: EpisodePlan;
  projectDir: string;
  lint: LintIssue[];
  sfx: SfxDecision[];
  notes: string[];
  estimatedMs: number | null;
  publishDir: string;
  draftOk: boolean;
}

/** Noticias puntuadas y agrupadas (se guardan en projects/_autopilot/news-<fecha>.json para auditoria). */
export const gatherNews = async (ap: AutopilotConfig, date: string, now: Date): Promise<NewsCluster[]> => {
  const { items, errors } = await fetchFeeds(ap.sources);
  for (const e of errors) log.warn(`feed ${e.feed}: ${e.error}`);
  const scored = items.map((i) => scoreItem(i, ap.sources, now));
  const clusters = clusterNews(scored, ap.sources);
  writeJson(fromRepo("projects/_autopilot", `news-${date}.json`), { fetchedAt: now.toISOString(), errors, clusters: clusters.slice(0, 20) });
  log.info(`${items.length} noticias de ${ap.sources.feeds.length - errors.length}/${ap.sources.feeds.length} feeds; ${clusters.filter((c) => c.score >= ap.sources.minScore).length} historias sobre el umbral`);
  return clusters;
};

export const genericBroll = (catalog: Awaited<ReturnType<typeof buildCatalog>>): string[] =>
  Object.values(catalog.entries)
    .filter((e) => (e.type as string) === "broll" && !e.tags.some((t) => ["captura", "noticia", "oficial"].includes(t)))
    .map((e) => e.id)
    .sort();

/** Relleno de noticia ya registrado en el proyecto (capturas/tarjetas), para el brief del escritor. */
export const newsBrollOf = (assets: Array<{ id: string; description?: string }>): WriterAssets["newsBroll"] =>
  assets.filter((a) => /^news_(cap|card)_\d+$/.test(a.id)).map((a) => ({ id: a.id, description: a.description ?? a.id }));

/** Regenera graficos + visuales de noticia de un episodio existente (opcionalmente con un brief corregido). */
export const refreshEpisodeVisuals = async (
  engine: EngineConfig,
  ap: AutopilotConfig,
  episodeId: string,
  opts: { brief?: TopicBrief; offline?: boolean } = {},
): Promise<string[]> => {
  const projectDir = fromRepo("projects", episodeId);
  const apFile = path.join(projectDir, "autopilot.json");
  const state = JSON.parse(fs.readFileSync(apFile, "utf8")) as { plan: EpisodePlan } & Record<string, unknown>;
  const plan: EpisodePlan = opts.brief ? { ...state.plan, topic: opts.brief } : state.plan;
  const theme = ap.themes.themes[plan.theme]!;
  const graphics = await generateEpisodeGraphics(plan, theme, projectDir);
  const news = plan.topic.kind === "news" ? await generateNewsVisuals(plan, theme, projectDir, { capture: !opts.offline }) : { assets: [], visuals: [] };
  const projFile = path.join(projectDir, "project.json");
  const proj = JSON.parse(fs.readFileSync(projFile, "utf8")) as { assets?: Array<{ id: string }> };
  const generated = new Set([...graphics.assets, ...news.assets].map((a) => a.id));
  const kept = (proj.assets ?? []).filter((a) => !generated.has(a.id) && !/^(ep_main|ep_headline|news_(cap|card)_\d+)$/.test(a.id));
  writeJson(projFile, { ...proj, assets: [...kept, ...graphics.assets, ...news.assets] });
  writeJson(apFile, { ...state, plan });
  writeJson(path.join(projectDir, "sources.json"), { topic: plan.topic.id, sources: plan.topic.sources, articles: plan.topic.articles ?? [] });
  const project = loadProject(projectDir);
  const catalog = await buildCatalog(engine, project);
  const assets: WriterAssets = {
    ...(graphics.mainVisual ? { mainVisual: graphics.mainVisual } : {}),
    ...(graphics.headlineVisual ? { headlineVisual: graphics.headlineVisual } : {}),
    broll: pickBroll(catalog, plan),
    characterBroll: characterBroll(catalog, castOf(plan)),
    ...(project.config.background ? { background: project.config.background } : {}),
    ...(news.visuals.length ? { newsBroll: news.visuals } : {}),
  };
  fs.writeFileSync(path.join(projectDir, "writer-brief.md"), buildWriterBrief(plan, ap, assets, catalog, engine));
  return [...graphics.assets, ...news.assets].map((a) => a.id);
};

export const runAutopilotEpisode = async (
  engine: EngineConfig,
  ap: AutopilotConfig,
  opts: AutopilotOptions,
  history: History = loadHistory(),
): Promise<EpisodeResult> => {
  const now = opts.now ?? new Date();
  let provider: LLMProvider | null = opts.provider ?? null;
  const manual = opts.writer === "manual";
  if (!provider && opts.writer !== "template" && !manual) {
    const p = new AnthropicProvider();
    const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
    if (opts.writer === "llm" || hasKey) provider = p;
  }
  const canWriteNews = provider !== null || manual;
  const clusters = opts.mode !== "evergreen" && !opts.offline && !opts.topic && !opts.brief ? await gatherNews(ap, opts.date, now) : [];

  const plan = planEpisode({
    date: opts.date,
    ap,
    engine,
    history,
    clusters,
    mode: opts.mode,
    ...(opts.brief ? { forceBrief: opts.brief } : {}),
    ...(opts.format ? { format: opts.format } : {}),
    ...(opts.topic ? { forceTopic: opts.topic } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    allowPlaceholder: opts.allowPlaceholder,
    canWriteNews,
  });
  log.ok(`plan: ${plan.episodeId} | ${plan.topic.kind}:${plan.topic.id} | ${plan.format} | host=${plan.casting.host} foil=${plan.casting.foil}${plan.casting.guest ? ` guest=${plan.casting.guest}` : ""}${plan.casting.cameo ? ` cameo=${plan.casting.cameo}` : ""} | tema ${plan.theme}${plan.setting ? ` | escenario ${plan.setting}` : ""}`);

  // Proyecto
  const projectDir = fromRepo("projects", plan.episodeId);
  fs.mkdirSync(projectDir, { recursive: true });
  const theme = ap.themes.themes[plan.theme]!;
  const baseCatalog = await buildCatalog(engine);
  // El escenario (ADR 0012) manda sobre el fondo del tema visual; si su fondo no existe, el del tema.
  const settingBg = plan.setting ? ap.settings.settings[plan.setting]?.background : undefined;
  const wanted = settingBg && baseCatalog.entries[settingBg] ? settingBg : theme.background;
  if (settingBg && wanted !== settingBg) log.warn(`fondo del escenario ${settingBg} no existe (npm run graphics); se usa el del tema`);
  const background = baseCatalog.entries[wanted] ? wanted : "bg_tech_loop";
  if (background !== wanted) log.warn(`fondo ${wanted} no existe (npm run autopilot -- --make-backgrounds); se usa bg_tech_loop`);

  const graphics = opts.graphics === false ? { assets: [], files: [] } : await generateEpisodeGraphics(plan, theme, projectDir);
  const news =
    opts.graphics === false || plan.topic.kind !== "news"
      ? { assets: [], visuals: [] }
      : await generateNewsVisuals(plan, theme, projectDir, { capture: !opts.offline });
  writeJson(path.join(projectDir, "project.json"), {
    $schema: "../../schemas/project.schema.json",
    title: plan.topic.title.slice(0, 120),
    language: "es",
    durationTargetSec: plan.targetSec,
    background,
    director: "rules",
    tts: opts.tts,
    transcriber: "auto",
    assets: [...graphics.assets, ...news.assets],
  });
  writeJson(path.join(projectDir, "sources.json"), { topic: plan.topic.id, sources: plan.topic.sources, articles: plan.topic.articles ?? [] });

  const project = loadProject(projectDir);
  const catalog = await buildCatalog(engine, project);
  const assets: WriterAssets = {
    ...("mainVisual" in graphics && graphics.mainVisual ? { mainVisual: graphics.mainVisual } : {}),
    ...("headlineVisual" in graphics && graphics.headlineVisual ? { headlineVisual: graphics.headlineVisual } : {}),
    broll: pickBroll(catalog, plan),
    characterBroll: characterBroll(catalog, castOf(plan)),
    background,
    ...(news.visuals.length ? { newsBroll: news.visuals } : {}),
  };

  // Brief del escritor: la misma entrada para el escritor LLM y para quien escriba a mano.
  fs.writeFileSync(path.join(projectDir, "writer-brief.md"), buildWriterBrief(plan, ap, assets, catalog, engine));

  if (manual) {
    const skeleton = `${renderFrontMatter({
      title: plan.topic.title.slice(0, 120),
      hook_title: plan.topic.hookTitle,
      target: plan.targetSec,
      background,
      broll: assets.broll,
      language: "es",
    })}<!-- autopilot ${plan.episodeId} | formato ${plan.format} | escritor manual | brief: writer-brief.md | fuentes: ${plan.topic.sources.join(" ")} -->\n<!-- PENDIENTE: escribir el guion siguiendo writer-brief.md y prompts/writer.system.md -->\n`;
    if (!fs.existsSync(project.scriptPath)) fs.writeFileSync(project.scriptPath, skeleton);
    writeJson(path.join(projectDir, "autopilot.json"), { plan, writer: "manual", estimatedMs: null, lint: [], sfx: [], notes: [], status: "needs_script" });
    const titleLine = plan.topic.title;
    writePublishKit(fromRepo("output", plan.episodeId, "publish"), plan, buildPublishTexts(plan, { title: titleLine, hookTitle: plan.topic.hookTitle }), buildSchedule(plan, now));
    saveHistory(recordPlan(history, plan));
    log.ok(`esqueleto: ${toRepoRel(project.scriptPath)} (brief: ${toRepoRel(path.join(projectDir, "writer-brief.md"))})`);
    return { plan, projectDir, lint: [], sfx: [], notes: [], estimatedMs: null, publishDir: fromRepo("output", plan.episodeId, "publish"), draftOk: false };
  }

  // Guion
  const useLLM = provider !== null && (opts.writer === "llm" || plan.topic.kind === "news");
  let source: string;
  let notes: string[];
  let estimatedMs: number | null;
  if (useLLM) {
    log.info(`escritor LLM (${provider!.name})...`);
    const w = await writeLLMScript(plan, ap, assets, catalog, engine, provider!);
    ({ source, notes, estimatedMs } = w);
    notes.push(`escritor llm: ${w.attempts} intento(s); hashtags sugeridos: ${w.output.hashtags.join(", ")}`);
  } else {
    const w = writeTemplateScript(plan, ap, assets, catalog, engine);
    ({ source, notes, estimatedMs } = w);
  }
  const sfx = autoSfx(source, catalog, ap.sfx, plan.seed);
  source = sfx.source;
  const lint = lintScript(source, plan, catalog, engine, ap.humor);
  fs.writeFileSync(project.scriptPath, source);
  writeJson(path.join(projectDir, "autopilot.json"), {
    plan,
    writer: useLLM ? `llm:${provider!.name}` : "template",
    estimatedMs: lint.estimatedMs ?? estimatedMs,
    lint: lint.issues,
    sfx: sfx.decisions,
    notes,
    status: "needs_review",
  });

  // Validacion con el motor (mismo paso que npm run analyze)
  let draftOk = false;
  try {
    const ctx = { cfg: engine, project, catalog };
    const { validation } = await stepAnalyze(ctx, { director: "rules" });
    draftOk = validation.ok;
    for (const i of validation.issues) (i.level === "error" ? log.error : log.warn)(`borrador: [${i.code}] ${i.message}`);
  } catch (err) {
    log.error(`borrador: ${(err as Error).message}`);
  }

  // Kit de publicacion
  const titleLine = /^title: (.*)$/m.exec(source)?.[1] ?? plan.topic.title;
  const hookLine = /^hook_title: (.*)$/m.exec(source)?.[1] ?? plan.topic.hookTitle;
  const texts = buildPublishTexts(plan, { title: titleLine, hookTitle: hookLine });
  const publishDir = fromRepo("output", plan.episodeId, "publish");
  writePublishKit(publishDir, plan, texts, buildSchedule(plan, now));

  saveHistory(recordPlan(history, plan));
  for (const i of lint.issues) (i.level === "error" ? log.error : log.warn)(`lint: [${i.code}] ${i.message}`);
  log.ok(`guion: ${toRepoRel(project.scriptPath)} (~${Math.round((lint.estimatedMs ?? 0) / 1000)} s estimados)`);
  log.ok(`publicacion: ${toRepoRel(publishDir)}/`);
  return { plan, projectDir, lint: lint.issues, sfx: sfx.decisions, notes, estimatedMs: lint.estimatedMs, publishDir, draftOk };
};

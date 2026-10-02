// Escritor LLM: escribe el guion etiquetado a partir del brief del episodio (noticia o evergreen).
// Usa la interfaz LLMProvider (no acoplado a un proveedor). La salida se valida con el parser y el
// validador del motor + lint editorial; si falla, se reintenta con los errores como feedback.
import fs from "node:fs";
import type { Catalog, EngineConfig } from "../catalog/catalog";
import { beatsToDraftTimeline } from "../director/beats";
import { buildCatalogBrief } from "../director/llm/director";
import { LLMError, type LLMMessage, type LLMProvider } from "../director/llm/provider";
import { fromRepo } from "../utils/paths";
import { validateTimeline } from "../validation/timeline";
import { castOf, rankBroll, topicTagsOf } from "./broll-picker";
import type { AutopilotConfig } from "./config";
import { lintScript } from "./lint";
import { estimateScript, renderFrontMatter } from "./script-doc";
import type { WriterAssets, WrittenScript } from "./template-writer";
import type { EpisodePlan } from "./types";

export { castOf };

export interface LLMScriptOutput {
  title: string;
  hookTitle: string;
  keyword: string;
  body: string;
  hashtags: string[];
  factClaims: string[];
}

export const WRITER_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hookTitle", "keyword", "body", "hashtags", "factClaims"],
  properties: {
    title: { type: "string" },
    hookTitle: { type: "string" },
    keyword: { type: "string" },
    body: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    factClaims: { type: "array", items: { type: "string" } },
  },
};


/** Contexto (lore) de los personajes presentes + el compartido que aplica (ADR 0011). Pura. */
export const loreBrief = (cast: string[], lore: AutopilotConfig["lore"]): string[] => {
  const own = cast.flatMap((c) => (lore.characters[c] ?? []).map((f) => `- ${c}: ${f}`));
  const shared = lore.shared
    .filter((s) => s.characters.filter((c) => cast.includes(c)).length >= s.min)
    .flatMap((s) => s.facts.map((f) => `- (${s.characters.filter((c) => cast.includes(c)).join("+")}) ${f}`));
  const community = (lore.community ?? [])
    .filter((m) => m.characters.length === 0 || m.characters.some((c) => cast.includes(c)))
    .flatMap((m) => m.facts.map((f) => `- [meme] ${f}`));
  if (own.length + shared.length + community.length === 0) return [];
  return ["## Contexto de personajes (referencias PASIVAS)", ...lore.rules.map((r) => `> ${r}`), ...own, ...shared, ...(community.length ? ["Memes y canciones de la comunidad (con fines humoristicos):", ...community] : [])];
};

/** Escenario del episodio (ADR 0012): los personajes saben donde estan. Pura. */
export const settingBrief = (plan: EpisodePlan, ap: AutopilotConfig): string[] => {
  const s = plan.setting ? ap.settings?.settings[plan.setting] : undefined;
  if (!s) return [];
  return [
    "",
    `## Escenario: ${s.label}`,
    "Los personajes SABEN donde estan: 1-2 menciones o reacciones al lugar (en el gancho o en un chiste), ligadas al tema si se puede.",
    ...s.awareness.map((a) => `- ${a}`),
  ];
};

/** Narrativas secundarias activas (ADR 0012): etapa actual; el final nunca lo decide el escritor. Pura. */
export const arcBrief = (plan: EpisodePlan): string[] =>
  (plan.arcs ?? []).flatMap((a) => [
    "",
    `## Narrativa secundaria: ${a.label} (etapa "${a.stage}", ${a.appearances} apariciones previas)`,
    `- ${a.beat}`,
    "- Un solo momento breve por episodio; no resolver el arco.",
    a.finaleAvailable ? "- El final ya es posible, pero SOLO lo decide el usuario (capitulo especial)." : `- Final: no antes de cumplir el minimo de videos (${a.finale})`,
  ]);

/** Imagenes en pares cuyos personajes estan TODOS en el episodio (ADR 0011). Pura. */
export const pairsFor = (cast: string[], catalog: Catalog): Array<{ id: string; description: string }> =>
  Object.values(catalog.entries)
    .filter((e) => e.characters?.length && e.characters.every((c) => cast.includes(c)))
    .map((e) => ({ id: e.id, description: e.description ?? e.tags.join(", ") }))
    .sort((a, b) => a.id.localeCompare(b.id));

export const buildWriterBrief = (plan: EpisodePlan, ap: AutopilotConfig, assets: WriterAssets, catalog: Catalog, engine: EngineConfig): string => {
  const t = plan.topic;
  const cast = castOf(plan);
  const pairs = pairsFor(cast, catalog);
  const wps = engine.render.timing.estimatedWordsPerSecond;
  const budget = Math.round(plan.targetSec * wps * 0.85);
  const p = ap.casting.personalities;
  const lines = [
    `# Episodio ${plan.episodeId} (${plan.format}: ${ap.formats.formats[plan.format].label})`,
    `Duracion objetivo: ${plan.targetSec} s (minimo 65 s; puede pasar de 90 si el contenido lo justifica; maximo 120). Presupuesto: ~${budget} palabras de dialogo en total.`,
    "Gancho: los primeros 2 s van SOBRECARGADOS (golpe + sacudida al arrancar, SFX en la palabra clave, zoom) para que no deslicen.",
    `Estructura sugerida: ${plan.structure.join(" -> ")}`,
    "",
    "## Casting",
    `- host: ${plan.casting.host} — ${p[plan.casting.host] ?? ""}`,
    `- foil: ${plan.casting.foil} — ${p[plan.casting.foil] ?? ""}`,
    ...(plan.casting.guest ? [`- invitado (1-2 intervenciones): ${plan.casting.guest} — ${p[plan.casting.guest] ?? ""}`] : []),
    ...(plan.casting.cameo
      ? [`- cameo MUDO (sin dialogo; 1-3 apariciones como listener, reaccionando con su SFX de firma): ${plan.casting.cameo} — ${p[plan.casting.cameo] ?? ""}`]
      : []),
    "",
    ...settingBrief(plan, ap),
    ...arcBrief(plan),
    "",
    ...loreBrief(cast, ap.lore),
    "",
    "## Coherencia (anti 'AI slop')",
    "Personajes, tema, escenario, chistes y referencias deben estar relacionados (no al 100%, pero se debe notar): cada guiño o chiste sale del tema, del lugar o de quienes estan. Nada de chistes genericos intercambiables.",
    ...(pairs.length
      ? [
          "",
          "## Imagenes en pares (solo estas: sus personajes estan en el episodio)",
          "Usalas 0-1 vez, en un momento compartido (remate, cierre o reaccion conjunta) con [VISUAL: id] o {STICKER:id}:",
          ...pairs.map((x) => `- ${x.id}: ${x.description}`),
        ]
      : []),
    "",
    "## Tema",
    `Tipo: ${t.kind} / ${t.category}. Palabra clave: ${t.keyword}. Titulo: ${t.title}`,
    `Rotulo sugerido: ${t.hookTitle}`,
    "Puntos:",
    ...t.points.map((x) => `- ${x}`),
    ...(t.takeaway ? [`Idea final: ${t.takeaway}`] : []),
    ...(t.twist ? [`Giro: ${t.twist}`] : []),
    ...(t.articles?.length
      ? ["", "## Articulos (unica fuente de hechos para noticias)", ...t.articles.map((a) => `- [${a.feed}, ${a.publishedAt ?? "s/f"}] ${a.title} — ${a.summary} (${a.url})`)]
      : []),
    `Fuentes: ${t.sources.join(" ")}`,
    "",
    "## Recursos del episodio",
    `Visuales generados: ${[assets.mainVisual, assets.headlineVisual].filter(Boolean).join(", ") || "ninguno"}`,
    ...(assets.newsBroll?.length
      ? [
          "Relleno de noticia (usa [BROLL: id] en el bloque que cita esa fuente; reparte capturas y tarjetas, no repitas la misma seguida):",
          ...assets.newsBroll.map((v) => `- ${v.id}: ${v.description}`),
        ]
      : []),
    `Saludo: ${ap.humor.greeting}`,
    `Memes disponibles: ${ap.humor.memeBeats.map((m) => `[MEME:${m.meme}:${m.sfx}]`).join(" ")}`,
    "Stickers de reaccion (2-5 por video, {STICKER:id[:sfx][:personaje]} anclado a la palabra; ~1.3 s junto al personaje, sin flash; sfx_oohh es el favorito del canal):",
    ...Object.values(catalog.entries)
      .filter((e) => e.type === "meme" && e.tags.includes("sticker"))
      .map((e) => `- ${e.id}: ${e.description ?? e.tags.join(", ")}`),
    "",
    "Relleno de la parte superior (B-roll, docs/12_GUIA_PRODUCCION.md): pon [BROLL: id] (1-2 ids) en casi todos los bloques sin [VISUAL], ilustrando ESA linea. Prioriza los GIF de Vocaloid del elenco; si la linea nombra un objeto, lugar o meme, muestralo. Ordenados de mas a menos afines a este episodio:",
    ...rankBroll(catalog, castOf(plan), topicTagsOf(plan))
      .slice(0, 30)
      .map((r) => `- ${r.id}: ${r.description}`),
    "",
    `CTA (dos bloques finales, con [VISUAL: ${ap.humor.ctaVisual}]): ${ap.humor.ctaLines.map(([w, l]) => `${w.replace("{host}", plan.casting.host).replace("{foil}", plan.casting.foil)}: "${l}"`).join(" | ")}`,
    "",
    buildCatalogBrief(catalog, engine),
  ];
  return lines.join("\n");
};

export const writeLLMScript = async (
  plan: EpisodePlan,
  ap: AutopilotConfig,
  assets: WriterAssets,
  catalog: Catalog,
  engine: EngineConfig,
  provider: LLMProvider,
  maxAttempts = 3,
): Promise<WrittenScript & { output: LLMScriptOutput; attempts: number }> => {
  const system = [
    fs.readFileSync(fromRepo("prompts/writer.system.md"), "utf8"),
    "\n\n# Especificacion del formato de guion\n",
    fs.readFileSync(fromRepo("docs/06_SCRIPT_FORMAT.md"), "utf8"),
    "\n\n# Guion de ejemplo (formato de la casa)\n",
    fs.readFileSync(fromRepo("projects/demo_001/script.md"), "utf8"),
    "\n\n# Guion de referencia aprobado (estandar de calidad actual: 3 rondas de correcciones del usuario)\n",
    fs.readFileSync(fromRepo("projects/ep_20261002_log4shell/script.md"), "utf8"),
  ].join("");
  const messages: LLMMessage[] = [{ role: "user", content: buildWriterBrief(plan, ap, assets, catalog, engine) }];
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await provider.generateJson({ system, messages, schema: WRITER_SCHEMA, maxTokens: 16000 });
    const out = res.json as LLMScriptOutput;
    const fm = renderFrontMatter({
      title: (out.title || plan.topic.title).slice(0, 120),
      hook_title: (out.hookTitle || plan.topic.hookTitle).slice(0, 60),
      target: plan.targetSec,
      ...(assets.background ? { background: assets.background } : {}),
      ...(plan.backgroundStyle ? { background_style: plan.backgroundStyle } : {}),
      broll: assets.broll,
      language: "es",
    });
    const source = `${fm}<!-- autopilot ${plan.episodeId} | escritor ${provider.name}:${res.model} | fuentes: ${plan.topic.sources.join(" ")} -->\n\n${(out.body ?? "").trim()}\n`;
    const errors: string[] = [];
    const { parsed, estimatedMs } = estimateScript(source, catalog, engine);
    errors.push(...parsed.errors.map((e) => `[PARSE] linea ${e.line}: ${e.message}`));
    if (parsed.errors.length === 0) {
      const draft = beatsToDraftTimeline(parsed.beats, { title: out.title || plan.topic.title, durationTargetSec: plan.targetSec, language: "es", generator: "autopilot" }, engine);
      errors.push(...validateTimeline(draft, catalog, engine.render, { stage: "draft" }).issues.filter((i) => i.level === "error").map((i) => `[${i.code}] ${i.message}`));
      errors.push(...lintScript(source, plan, catalog, engine, ap.humor).issues.filter((i) => i.level === "error" || ["TURNS", "NO_GREETING", "SHORT", "LONG", "KEYWORD_LATE"].includes(i.code)).map((i) => `[${i.code}] ${i.message}`));
    }
    if (errors.length === 0) return { source, estimatedMs, notes: out.factClaims.map((c) => `verificar: ${c}`), output: out, attempts: attempt };
    lastErrors = errors;
    messages.push({ role: "assistant", content: res.raw });
    messages.push({ role: "user", content: `El guion no paso la validacion. Corrige estos problemas y devuelve el JSON completo:\n${errors.map((e) => `- ${e}`).join("\n")}` });
  }
  throw new LLMError(`El escritor LLM no produjo un guion valido tras ${maxAttempts} intentos:\n${lastErrors.map((e) => `  - ${e}`).join("\n")}`);
};

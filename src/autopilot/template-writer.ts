// Escritor de PLANTILLA (offline, determinista): convierte un tema evergreen en un guion con el
// formato de la casa: saludo + gancho con palabra clave, meme, explicacion por TURNOS (el host explica,
// el foil pregunta o reacciona), visual del episodio, remate propio del tema y CTA.
// No usa red ni LLM. Para noticias se necesita el escritor LLM (los resumenes de feeds no bastan).
import type { Catalog, EngineConfig } from "../catalog/catalog";
import { MUTE_BEAT_MS } from "../director/script-parser";
import { normalizeWord, splitWords } from "../timeline/normalize";
import { layoutTitle } from "../timeline/titlecard";
import type { AutopilotConfig } from "./config";
import { pick, shuffle } from "./random";
import { estimateScript, renderFrontMatter } from "./script-doc";
import { BEAT_SECTION, type BeatKind, type EpisodePlan } from "./types";

export interface WriterAssets {
  /** id del visual principal del episodio (grafico generado). */
  mainVisual?: string;
  /** id de una tarjeta de titular/tema (grafico generado). */
  headlineVisual?: string;
  broll: string[];
  background?: string;
  /** Capturas y tarjetas de titular (noticias): relleno contextual para la linea que cita cada fuente. */
  newsBroll?: Array<{ id: string; description: string }>;
  /** GIF de Vocaloid por personaje del elenco (broll-picker.ts): relleno de las lineas de cada uno. */
  characterBroll?: Record<string, string[]>;
}

export interface WrittenScript {
  source: string;
  estimatedMs: number | null;
  notes: string[];
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? `{${k}}`);

interface Block {
  kind: BeatKind;
  lines: string[];
}

export const writeTemplateScript = (
  plan: EpisodePlan,
  ap: AutopilotConfig,
  assets: WriterAssets,
  catalog: Catalog,
  engine: EngineConfig,
  minMs = 66_000,
): WrittenScript => {
  const { topic, casting } = plan;
  if (topic.kind !== "evergreen") throw new Error("El escritor de plantilla solo admite temas evergreen (usa --writer llm para noticias)");
  const host = casting.host;
  const foil = casting.foil;
  const s = (k: string) => `${plan.seed}:${k}`;
  const vars = { host, foil, keyword: topic.keyword, topic: topic.title };
  const humor = ap.humor;
  const notes: string[] = [];
  // Preguntas del tema: cada una va DESPUES del punto con el que mas palabras comparte (reacciona a lo
  // que acaba de oir). Los huecos restantes se llenan con preguntas genericas o reacciones cortas.
  const points = [...topic.points];
  const tokens = (x: string) => new Set(splitWords(x).map(normalizeWord).filter((w) => w.length > 3));
  const slotQuestion = new Map<number, string>();
  for (const q of topic.questions ?? []) {
    const qt = tokens(q);
    const ranked = points
      .map((p, i) => ({ i, score: [...tokens(p)].filter((w) => qt.has(w)).length }))
      .filter((x) => x.i < points.length - 1)
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const free = ranked.find((x) => !slotQuestion.has(x.i));
    if (free) slotQuestion.set(free.i, q);
  }
  const generic = shuffle(humor.foilQuestions, s("gq"));
  const reactions = shuffle(humor.foilReactions, s("r"));
  const say = (kind: BeatKind, who: string, reaction: string, text: string, extra: string[] = []): Block => ({
    kind,
    lines: [`[${who.toUpperCase()}:${reaction}]`, ...extra, text],
  });
  const listen = (who: string, reaction = "neutral") => `[LISTEN: ${who}:${reaction}]`;

  // El rotulo debe caber (HOOK_TITLE_TOO_LONG es error del motor): si no, uno corto con la palabra clave.
  const lay = layoutTitle(topic.hookTitle, engine.render);
  const hookTitle = lay && (lay.overflow || lay.fontScale < 0.7) ? `¿Qué es *${topic.keyword}*?` : topic.hookTitle;
  if (hookTitle !== topic.hookTitle) notes.push(`rotulo acortado: "${topic.hookTitle}" -> "${hookTitle}"`);

  const blocks: Block[] = [];
  const hookReaction = plan.format === "controversy_story" ? "shocked" : "sorprendido";
  const hookPrefix = plan.format === "myth_vs_fact" ? "¿Mito o realidad? " : "";
  blocks.push(say("hook", host, hookReaction, `${humor.greeting} ${hookPrefix}${hookTitle}`));
  const memes = humor.memeBeats.filter((b) => catalog.entries[b.meme] && catalog.entries[b.sfx]);
  if (memes.length > 0) {
    const m = pick(memes, s("meme"));
    blocks.push({ kind: "meme", lines: [`[MEME:${m.meme}:${m.sfx}]`] });
  }

  // Desarrollo: punto del host, intervencion del foil, siguiente punto...
  let gi = 0;
  let ri = 0;
  points.forEach((p, i) => {
    const isLast = i === points.length - 1;
    const extra = [listen(foil)];
    let text = p;
    let reaction = i % 2 === 0 ? "nerd" : "feliz";
    let kind: BeatKind = i === 0 ? "context" : "explain";
    if (i === 0 && assets.headlineVisual) extra.push(`[VISUAL: ${assets.headlineVisual}]`);
    if (i === 2 && assets.mainVisual) {
      extra.push(`[VISUAL: ${assets.mainVisual}]`);
      text = `{ZOOM}${p}`;
      kind = "visual";
    }
    if (isLast && plan.format === "controversy_story") reaction = "sorprendido";
    blocks.push(say(kind, host, reaction, text, extra));
    if (isLast) return;
    const q = slotQuestion.get(i) ?? (slotQuestion.size === 0 && i % 2 === 0 && gi < 2 ? generic[gi++] : undefined);
    if (q) blocks.push(say("question", foil, "confundido", q, [listen(host)]));
    else blocks.push(say("question", foil, ri % 2 === 0 ? "sorprendido" : "feliz", reactions[ri++ % reactions.length]!, [listen(host)]));
  });
  if (casting.guest) {
    blocks.push(say("twist", casting.guest, "nerd", `Y ojo con esto: ${topic.takeaway.charAt(0).toLowerCase()}${topic.takeaway.slice(1)}`, [listen(host, "sorprendido")]));
    notes.push(`invitado: ${casting.guest}`);
  }
  const punch = topic.punchline ?? { line: fill(pick(humor.punchlines, s("punch")), vars), reply: pick(humor.punchlineReplies, s("reply")) };
  blocks.push(say("punchline", foil, "shocked", punch.line, [listen(host)]));
  blocks.push(say("punchline", host, "riendo", punch.reply, [listen(foil, "riendo")]));
  // Cameo mudo (ADR 0011/0013): "contesta" el remate en SU PROPIO beat (ella + un oyente, lo que dura
  // su SFX de firma), en lugar de sumarse como tercer personaje en la escena de otro.
  const cameo = casting.cameo;
  const cameoSfx = cameo ? engine.characters.characters[cameo]?.voice?.signatureSfx : undefined;
  if (cameo && cameoSfx && catalog.entries[cameoSfx]) {
    blocks.push({ kind: "punchline", lines: [`[${cameo.toUpperCase()}:feliz]`, listen(host, "riendo"), `[SFX:${cameoSfx}]`, `[PAUSE:${MUTE_BEAT_MS}]`] });
    notes.push(`cameo mudo: ${cameo}`);
  }
  if (!casting.guest) blocks.push(say("takeaway", host, "feliz", topic.takeaway, [listen(foil, "feliz")]));
  for (const [who, line] of humor.ctaLines) {
    const id = fill(who, vars);
    const extra = [listen(id === host ? foil : host, "feliz")];
    if (catalog.entries[humor.ctaVisual]) extra.push(`[VISUAL: ${humor.ctaVisual}]`);
    blocks.push(say("cta", id, "feliz", line, extra));
  }

  // Relleno con GIF de Vocaloid del personaje que habla (docs/12_GUIA_PRODUCCION.md): en las lineas sin
  // visual del foil, invitado y cameo, y en una de cada dos del host (sin repetir el mismo GIF seguido).
  const withCharacterBroll = (bs: Block[]): Block[] => {
    const used = new Map<string, number>();
    let hostTurn = 0;
    return bs.map((b) => {
      if (b.kind === "meme" || b.kind === "cta" || b.lines.some((l) => l.startsWith("[VISUAL") || l.startsWith("[BROLL"))) return b;
      const who = /^\[([A-Z]+):/.exec(b.lines[0] ?? "")?.[1]?.toLowerCase();
      const list = who ? assets.characterBroll?.[who] : undefined;
      if (!who || !list?.length) return b;
      if (who === host && hostTurn++ % 2 === 1) return b;
      const i = used.get(who) ?? 0;
      used.set(who, i + 1);
      return { ...b, lines: [b.lines[0]!, `[BROLL: ${list[i % list.length]}]`, ...b.lines.slice(1)] };
    });
  };

  const render = (raw: Block[]) => {
    const bs = withCharacterBroll(raw);
    const out: string[] = [];
    let lastSection = "";
    for (const b of bs) {
      const section = BEAT_SECTION[b.kind];
      if (section !== lastSection) {
        out.push(`## ${section}`);
        lastSection = section;
      }
      out.push(...b.lines, "");
    }
    return out.join("\n");
  };

  const fm = renderFrontMatter({
    title: topic.title,
    hook_title: hookTitle,
    target: plan.targetSec,
    ...(assets.background ? { background: assets.background } : {}),
    broll: assets.broll,
    language: "es",
  });
  const header = `<!-- autopilot ${plan.episodeId} | formato ${plan.format} | tema ${topic.id} | fuentes: ${topic.sources.join(" ")} -->\n\n`;
  let source = fm + header + render(blocks);
  let est = estimateScript(source, catalog, engine).estimatedMs;
  // Relleno determinista si queda corto: malentendido del foil + correccion del host (antes del remate).
  const fillers = [
    [say("question", foil, "confundido", pick(humor.foilMisunderstandings, s("mis")), [listen(host)]), say("explain", host, "enojado", pick(humor.hostCorrections, s("corr")), [listen(foil, "confundido")])],
  ];
  while (est !== null && est < minMs && fillers.length > 0) {
    const pair = fillers.shift()!;
    const at = blocks.findIndex((b) => b.kind === "punchline");
    blocks.splice(at < 0 ? blocks.length : at, 0, ...pair);
    notes.push("relleno: malentendido + correccion");
    source = fm + header + render(blocks);
    est = estimateScript(source, catalog, engine).estimatedMs;
  }
  if (est !== null && est < minMs) notes.push(`duracion estimada ${Math.round(est / 1000)} s < ${minMs / 1000} s: agrega puntos al tema`);
  return { source, estimatedMs: est, notes };
};

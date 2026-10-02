// AUTOPILOTO: produce episodios completos con el formato de la casa a partir de noticias de IA e
// informatica (o, si no hay, de un banco de temas evergreen de Computer Science). Ver docs/11_AUTOPILOT.md.
//
//   npm run autopilot                                  # planifica + escribe 1 episodio y lo deja para revision
//   npm run autopilot -- --produce                     # ...y ademas lo produce (voces, render, QA)
//   npm run autopilot -- --episode ep_20261002_big_o --produce   # produce un episodio ya revisado (borrador 540x960)
//   npm run autopilot -- --episode <id> --produce --final        # render final 1080x1920 (SOLO tras la aprobacion)
//   npm run autopilot -- --batch 3                     # planifica 3 episodios (semana tipo)
//   npm run autopilot -- --mode evergreen --topic big_o --writer template --tts silent
//   npm run autopilot -- --brief projects/_autopilot/briefs/x.json --writer manual [--format myth_vs_fact]
//   npm run autopilot -- --episode <id> --refresh-visuals [--brief <json>]   # capturas + tarjetas de titular
//   npm run autopilot -- --check-feeds | --make-backgrounds | --list-topics [--category cs_concept]
import { spawn } from "node:child_process";
import fs from "node:fs";
import { ensureThemeBackgrounds } from "../src/autopilot/backgrounds";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { evergreenLastUsed, loadHistory, saveHistory, setStatus } from "../src/autopilot/history";
import { clusterNews, fetchFeeds, scoreItem } from "../src/autopilot/news";
import { parseBrief } from "../src/autopilot/planner";
import { autoExportReview } from "../src/review/run";
import { refreshEpisodeVisuals, runAutopilotEpisode } from "../src/autopilot/run";
import type { FormatId } from "../src/autopilot/types";
import { readJson } from "../src/utils/fs";
import { loadEngineConfig } from "../src/catalog/catalog";
import { main, parseCli } from "../src/utils/cli";
import { color, log } from "../src/utils/log";
import { fromRepo } from "../src/utils/paths";

const { values } = parseCli({
  date: { type: "string" },
  mode: { type: "string" },
  topic: { type: "string" },
  brief: { type: "string" },
  format: { type: "string" },
  category: { type: "string" },
  writer: { type: "string" },
  tts: { type: "string" },
  batch: { type: "string" },
  produce: { type: "boolean" },
  episode: { type: "string" },
  offline: { type: "boolean" },
  "allow-placeholder": { type: "boolean" },
  "no-graphics": { type: "boolean" },
  "check-feeds": { type: "boolean" },
  "make-backgrounds": { type: "boolean" },
  "refresh-visuals": { type: "boolean" },
  "list-topics": { type: "boolean" },
  "allow-missing-audio": { type: "boolean" },
  final: { type: "boolean" },
  full: { type: "boolean" },
});

const today = () => new Date().toISOString().slice(0, 10);

const produce = (episodeId: string, tts: string | undefined) =>
  new Promise<number>((resolve) => {
    const args = ["tsx", "scripts/generate.ts", "--project", `projects/${episodeId}`];
    if (tts) args.push("--tts", tts);
    if (values["allow-missing-audio"]) args.push("--allow-missing-audio");
    if (values.final) args.push("--final");
    if (values.full) args.push("--full");
    const child = spawn("npx", args, { cwd: fromRepo(), stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => resolve(code ?? 1));
  });

main(async () => {
  const ap = loadAutopilotConfig();
  const engine = loadEngineConfig();

  if (values["check-feeds"]) {
    const { items, errors } = await fetchFeeds(ap.sources);
    for (const f of ap.sources.feeds) {
      const n = items.filter((i) => i.feed === f.id).length;
      const err = errors.find((e) => e.feed === f.id);
      (err ? log.error : log.ok)(`${f.id.padEnd(14)} ${err ? err.error : `${n} items`}  ${f.url}`);
    }
    const clusters = clusterNews(items.map((i) => scoreItem(i, ap.sources, new Date())), ap.sources);
    log.step("N", "Top historias");
    for (const c of clusters.slice(0, 8)) log.info(`${String(c.score).padStart(6)}  ${c.items[0]!.title}  (${c.items.length} fuentes)`);
    return errors.length === ap.sources.feeds.length ? 1 : 0;
  }
  if (values["make-backgrounds"]) {
    const made = await ensureThemeBackgrounds(ap.themes);
    log.ok(made.length ? `fondos creados/registrados: ${made.join(", ")}` : "todos los fondos de tema ya existen");
    return;
  }
  if (values["list-topics"]) {
    const used = evergreenLastUsed(loadHistory());
    for (const t of ap.evergreen.filter((x) => !values.category || x.category === values.category)) {
      log.info(`${t.id.padEnd(22)} ${t.category.padEnd(12)} ${used.get(t.id) ?? color.gray("nunca")}  ${t.title}`);
    }
    return;
  }

  if (values.episode && values["refresh-visuals"]) {
    if (!fs.existsSync(fromRepo("projects", values.episode))) throw new Error(`No existe projects/${values.episode}`);
    const brief = values.brief ? parseBrief(readJson(fromRepo(values.brief)), values.brief) : undefined;
    log.step("V", `Visuales de ${values.episode}`);
    const ids = await refreshEpisodeVisuals(engine, ap, values.episode, { ...(brief ? { brief } : {}), offline: values.offline });
    log.ok(`visuales: ${ids.join(", ")}`);
    await autoExportReview(engine, [values.episode]);
    return;
  }
  if (values.episode) {
    if (!values.produce) throw new Error("--episode requiere --produce (o --refresh-visuals)");
    if (!fs.existsSync(fromRepo("projects", values.episode))) throw new Error(`No existe projects/${values.episode}`);
    log.step("P", `Produciendo ${values.episode}`);
    const code = await produce(values.episode, values.tts);
    if (code === 0) saveHistory(setStatus(loadHistory(), values.episode, "produced"));
    await autoExportReview(engine, [values.episode]);
    return code;
  }

  const n = Math.max(1, Number(values.batch ?? 1));
  const mode = (values.mode ?? "auto") as "auto" | "news" | "evergreen";
  const writer = (values.writer ?? "auto") as "auto" | "llm" | "template" | "manual";
  const brief = values.brief ? parseBrief(readJson(fromRepo(values.brief)), values.brief) : undefined;
  const tts = values.tts ?? "fish";
  const results = [];
  for (let i = 0; i < n; i++) {
    log.step(`A${i + 1}`, `Autopiloto (${mode}, escritor ${writer})`);
    const r = await runAutopilotEpisode(engine, ap, {
      date: values.date ?? today(),
      mode: i > 0 && mode === "auto" ? "evergreen" : mode, // en lote: 1 noticia como mucho, el resto evergreen
      writer,
      tts,
      ...(values.topic && i === 0 ? { topic: values.topic } : {}),
      ...(brief && i === 0 ? { brief } : {}),
      ...(values.format && i === 0 ? { format: values.format as FormatId } : {}),
      ...(values.category ? { category: values.category } : {}),
      offline: values.offline,
      allowPlaceholder: values["allow-placeholder"],
      graphics: !values["no-graphics"],
    });
    results.push(r);
  }

  log.step("R", "Revision humana requerida");
  for (const r of results) {
    if (writer === "manual") {
      log.info(`${color.yellow("✎")} ${r.plan.episodeId}: escribe projects/${r.plan.episodeId}/script.md (brief: writer-brief.md)`);
      continue;
    }
    const errors = r.lint.filter((i) => i.level === "error").length + (r.draftOk ? 0 : 1);
    log.info(`${errors ? color.red("✖") : color.green("✔")} ${r.plan.episodeId}: projects/${r.plan.episodeId}/script.md  (~${Math.round((r.estimatedMs ?? 0) / 1000)} s, ${r.lint.length} avisos)`);
  }
  log.info("Revisa script.md (hechos, tono, chistes) y autopilot.json; luego:");
  log.info(`  npm run autopilot -- --episode <id> --produce [--tts ${tts}]`);

  if (values.produce) {
    for (const r of results) {
      if (!r.draftOk) {
        log.error(`${r.plan.episodeId}: borrador invalido, no se produce`);
        continue;
      }
      log.step("P", `Produciendo ${r.plan.episodeId}`);
      const code = await produce(r.plan.episodeId, tts);
      if (code === 0) saveHistory(setStatus(loadHistory(), r.plan.episodeId, "produced"));
    }
  }
  await autoExportReview(engine, results.map((r) => r.plan.episodeId));
});

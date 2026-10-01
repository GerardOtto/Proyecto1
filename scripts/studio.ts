// Preview en Remotion Studio con el timeline de un proyecto (o un fixture).
// Uso: npm run studio -- --project projects/demo_001 [--draft] [--timeline ruta.json] [--safe-area]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildCatalog, loadEngineConfig, loadProject } from "../src/catalog/catalog";
import { stagePublicDir } from "../src/pipeline/render";
import { buildRenderPlan } from "../src/timeline/plan";
import type { Timeline } from "../src/timeline/types";
import { main, parseCli, resolveProjectDir } from "../src/utils/cli";
import { readJson, writeJson } from "../src/utils/fs";
import { log } from "../src/utils/log";
import { CACHE_DIR, fromRepo, toRepoRel } from "../src/utils/paths";

const { values } = parseCli({ project: { type: "string" }, timeline: { type: "string" }, draft: { type: "boolean" }, "safe-area": { type: "boolean" } });

main(async () => {
  const cfg = loadEngineConfig();
  const project = values.project ? loadProject(resolveProjectDir(values.project)) : undefined;
  const file = values.timeline
    ? fromRepo(values.timeline)
    : project
      ? values.draft
        ? project.paths.draft
        : project.paths.timeline
      : fromRepo("tests/fixtures/smoke.timeline.json");
  if (!fs.existsSync(file)) throw new Error(`No existe ${toRepoRel(file)}`);
  const catalog = await buildCatalog(cfg, project);
  const plan = buildRenderPlan(readJson<Timeline>(file), catalog.resolved, cfg.render, { showSafeArea: values["safe-area"] });
  const name = `studio-${project?.id ?? path.basename(file, ".json")}`;
  const publicDir = stagePublicDir(plan, name);
  const propsFile = path.join(CACHE_DIR, `${name}.props.json`);
  writeJson(propsFile, { plan });
  log.info(`Abriendo Remotion Studio con ${toRepoRel(file)}`);
  const child = spawn("npx", ["remotion", "studio", "src/index.ts", "--public-dir", publicDir, "--props", propsFile], {
    cwd: fromRepo(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  await new Promise<void>((resolve) => child.on("close", () => resolve()));
});

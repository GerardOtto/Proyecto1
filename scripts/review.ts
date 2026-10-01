// Exporta la version simple de los episodios a la carpeta de revision (REVIEW_DIR en .env o --dir).
//
//   npm run review                         # todos los episodios del autopiloto
//   npm run review -- --episode ep_a,ep_b  # solo esos (el Resumen.txt siempre incluye todos)
import { loadEngineConfig } from "../src/catalog/catalog";
import { exportReview } from "../src/review/run";
import { main, parseCli } from "../src/utils/cli";
import { log } from "../src/utils/log";

const { values } = parseCli({
  episode: { type: "string" },
  dir: { type: "string" },
});

main(async () => {
  const dir = values.dir ?? process.env.REVIEW_DIR;
  if (!dir) throw new Error("Define REVIEW_DIR en .env (carpeta de revision) o pasa --dir <carpeta>");
  const episodes = values.episode?.split(",").map((s) => s.trim()).filter(Boolean);
  const r = await exportReview(loadEngineConfig(), dir, episodes);
  for (const f of r.folders) log.ok(f);
  log.ok(`resumen: ${r.index}`);
  return r.failed.length ? 1 : 0;
});

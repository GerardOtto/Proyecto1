import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportEpisodeReview, renderReviewScript, safeName, usedVisualIds, type ReviewEpisode } from "../src/review/export";
import type { Timeline } from "../src/timeline/types";
import { engine } from "./helpers";

const timeline = {
  version: "1.0",
  meta: { title: "t", durationTargetSec: 80, language: "es", generator: "test" },
  scenes: [
    { id: "s01-hook", section: "hook", startMs: 0, endMs: 3000, character: "teto", avatar: "shocked", dialogue: "¡Papu papu! ¿*GitHub* filtró todo?", visuals: ["ep_main"], events: ["camera_zoom", { type: "sfx", sfx: "sfx_ding" }] },
    { id: "s02-reaction", section: "reaction", startMs: 3000, endMs: 4000, events: [{ type: "meme_explosion", meme: "meme_boom", sfx: "sfx_boom" }] },
    { id: "s03-context", section: "context", startMs: 4000, endMs: 9000, character: "miku", avatar: "confundido", dialogue: "¿Quién las subió?", broll: ["broll_robot"], events: [{ type: "visual_show", visual: "ep_headline", atWord: 0 }] },
  ],
} as unknown as Timeline;

const ep: ReviewEpisode = {
  episodeId: "ep_x",
  date: "2026-10-01",
  title: "Prueba",
  hookTitle: "*GitHub*: prueba",
  format: "news_explainer",
  casting: { host: "teto", foil: "miku" },
  status: "needs_review",
  sources: ["https://example.com/a"],
  timeline,
  estimatedSec: 9,
  audio: { "s03-context": "/x/s03-context.mp3" },
  audioInputDir: "/repo/projects/ep_x/audio/input",
  greetingText: "¡Papu papu!",
  videoFile: null,
};

describe("carpeta de revision", async () => {
  const { cfg } = await engine();

  it("guion simple: sin etiquetas ni asteriscos, con hablante, emocion, imagen y estado del audio", () => {
    const txt = renderReviewScript(ep);
    expect(txt).toContain("PRUEBA");
    expect(txt).toContain("Rotulo en pantalla: GitHub: prueba");
    expect(txt).toContain("Noticia explicada  |  Teto (explica), Miku (pregunta)");
    expect(txt).toContain("Audios grabados: 1/2");
    expect(txt).toMatch(/01\. Teto \(shock\)\s+FALTA AUDIO: s01-hook\.mp3/);
    expect(txt).toContain('"¡Papu papu! ¿GitHub filtró todo?"');
    expect(txt).toContain('graba solo desde "¿GitHub filtró todo?..."');
    expect(txt).toMatch(/02\. Miku \(confusion\)\s+audio OK: s03-context\.mp3/);
    expect(txt).toContain("[ MEME: meme_boom ]");
    expect(txt).toContain("Imagen: ep_headline");
    expect(txt).toContain("Relleno: broll_robot");
    expect(txt).not.toMatch(/\[[A-Z]+:|\{SFX|sfx_/);
  });

  it("assets usados y nombres de carpeta validos en Windows", () => {
    expect(usedVisualIds(timeline)).toEqual(["broll_robot", "ep_headline", "ep_main", "meme_boom"]);
    expect(safeName('2026-10-01 ¿Qué: "pasó"? <GitHub>')).toBe("2026-10-01 ¿Qué pasó GitHub");
  });

  it("exporta un episodio real: Guion.txt, imagenes, personajes y Notas.txt que no se sobrescribe", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-"));
    const id = "ep_20261001_github_agentes_de_ia_filtraron_1";
    const first = await exportEpisodeReview(cfg, id, dir);
    expect(fs.readFileSync(path.join(first.folder, "Guion.txt"), "utf8")).toContain("GITHUB");
    expect(fs.existsSync(path.join(first.folder, "Imagenes", "ep_main.png"))).toBe(true);
    expect(fs.readdirSync(path.join(first.folder, "Personajes")).length).toBeGreaterThan(0);
    fs.writeFileSync(path.join(first.folder, "Notas.txt"), "mi nota");
    const again = await exportEpisodeReview(cfg, id, dir);
    expect(fs.readFileSync(path.join(again.folder, "Notas.txt"), "utf8")).toBe("mi nota");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

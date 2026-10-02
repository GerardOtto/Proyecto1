import { describe, expect, it } from "vitest";
import { loadAutopilotConfig } from "../src/autopilot/config";
import { buildWriterBrief, loreBrief, pairsFor } from "../src/autopilot/llm-writer";
import { chooseCasting, planEpisode, silentCharacters } from "../src/autopilot/planner";
import { estimateScript } from "../src/autopilot/script-doc";
import { writeTemplateScript } from "../src/autopilot/template-writer";
import { beatsToDraftTimeline } from "../src/director/beats";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

const ap = loadAutopilotConfig();

describe("personajes mudos, pares y contexto (ADR 0011)", async () => {
  const { cfg, catalog } = await engine();
  const validate = (tl: ReturnType<typeof longTimeline>) => validateTimeline(tl, catalog, cfg.render, { stage: "draft", checkAudioFiles: false });

  it("Neru es muda: con dialogo es error; como listener no", () => {
    const tl = clone(longTimeline());
    const dev = tl.scenes.find((s) => s.id === "dev")!;
    dev.character = "neru";
    dev.avatar = "neutral";
    expect(validate(tl).issues.some((i) => i.code === "MUTE_CHARACTER_SPEAKS")).toBe(true);
    const ok = clone(longTimeline());
    ok.scenes.find((s) => s.id === "dev")!.listeners = [{ character: "neru", avatar: "broma" }];
    expect(validate(ok).issues.some((i) => i.code === "MUTE_CHARACTER_SPEAKS")).toBe(false);
  });

  it("una imagen en pares exige que sus dos personajes esten en el video", () => {
    const tl = clone(longTimeline()); // teto + miku
    tl.scenes.find((s) => s.id === "dev")!.visuals = ["pair_teto_miku_emocionadas"];
    expect(validate(tl).issues.some((i) => i.code === "PAIR_CHARACTER_ABSENT")).toBe(false);
    tl.scenes.find((s) => s.id === "dev")!.visuals = ["pair_miku_luka_cantando"];
    const bad = validate(tl).issues.find((i) => i.code === "PAIR_CHARACTER_ABSENT");
    expect(bad?.level).toBe("error");
    expect(bad?.message).toContain("luka");
  });

  it("pairsFor: solo pares cuyos personajes estan todos en el casting", () => {
    const ids = pairsFor(["miku", "teto"], catalog).map((p) => p.id);
    expect(ids).toEqual(["pair_miku_teto_preocupadas", "pair_miku_teto_reverencia", "pair_teto_miku_emocionadas"]);
    expect(pairsFor(["luka", "teto"], catalog)).toEqual([]);
  });

  it("loreBrief: contexto de los presentes + compartido si coinciden (Triple Baka con 2 de 3)", () => {
    const withBaka = loreBrief(["teto", "neru"], ap.lore).join("\n");
    expect(withBaka).toContain("PASIVAS");
    expect(withBaka).toContain("Triple Baka");
    expect(withBaka).toContain("teto:");
    expect(withBaka).not.toContain("luka:");
    expect(loreBrief(["luka", "kaito"], ap.lore).join("\n")).not.toContain("Triple Baka");
  });

  it("casting: Neru nunca tiene rol con dialogo; puede entrar como cameo mudo", () => {
    for (const r of ["host", "foil", "guest"] as const) expect(ap.casting.roles[r]).not.toContain("neru");
    expect(silentCharacters(cfg)).toEqual(["neru"]);
    const cameoAp = { ...ap, casting: { ...ap.casting, cameo: { characters: ["neru"], probability: 1 } } };
    const c = chooseCasting(cameoAp, ["luka", "miku", "teto"], { episodes: [] }, "s", ["neru"]);
    expect(c.cameo).toBe("neru");
    const none = chooseCasting({ ...cameoAp, casting: { ...cameoAp.casting, cameo: { characters: ["neru"], probability: 0 } } }, ["luka", "miku", "teto"], { episodes: [] }, "s", ["neru"]);
    expect(none.cameo).toBeUndefined();
  });

  it("plantilla con cameo: Neru escucha el remate y contesta con su celular; borrador valido", () => {
    const plan = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: "big_o", canWriteNews: false, date: "2026-10-02" });
    const withCameo = { ...plan, casting: { ...plan.casting, cameo: "neru" } };
    const w = writeTemplateScript(withCameo, ap, { broll: ["broll_cat_laptop"], background: "bg_tech_loop" }, catalog, cfg);
    expect(w.source).toContain("{SFX:sfx_neru_phone}");
    expect(w.source).not.toMatch(/^\[NERU:/m);
    const { parsed } = estimateScript(w.source, catalog, cfg);
    expect(parsed.errors).toEqual([]);
    const draft = beatsToDraftTimeline(parsed.beats, { title: "t", durationTargetSec: 80, language: "es", generator: "test" }, cfg);
    const issues = validateTimeline(draft, catalog, cfg.render, { stage: "draft" }).issues;
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(issues.some((i) => i.code === "SIGNATURE_SFX_WITHOUT_OWNER")).toBe(false);
    const brief = buildWriterBrief(withCameo, ap, { broll: [] }, catalog, cfg);
    expect(brief).toContain("cameo MUDO");
    expect(brief).toContain("Contexto de personajes");
  });
});

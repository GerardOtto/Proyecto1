import { describe, expect, it } from "vitest";
import { loadAutopilotConfig } from "../src/autopilot/config";
import type { History, HistoryEntry } from "../src/autopilot/history";
import { arcBrief, loreBrief, settingBrief } from "../src/autopilot/llm-writer";
import { arcBeats, chooseCasting, chooseSetting, planEpisode, topicFromEvergreen } from "../src/autopilot/planner";
import type { TopicBrief } from "../src/autopilot/types";
import { engine } from "./helpers";

const ap = loadAutopilotConfig();
const entry = (i: number, cameo?: string, setting?: string): HistoryEntry => ({
  episodeId: `ep_${i}`, date: "2026-10-01", kind: "evergreen", topicId: `t${i}`, title: "t", urls: [], format: "concept_lesson",
  casting: { host: "teto", foil: "miku", ...(cameo ? { cameo } : {}) }, theme: "ocean", ...(setting ? { setting } : {}), status: "produced",
});
const history = (n: number, cameo?: string): History => ({ episodes: Array.from({ length: n }, (_, i) => entry(i, cameo)) });

describe("autopiloto: escenarios, arcos y coherencia (ADR 0012)", async () => {
  const { cfg, catalog } = await engine();

  it("cada escenario tiene fondo existente en el catalogo", () => {
    for (const [id, s] of Object.entries(ap.settings.settings)) expect(catalog.entries[s.background]?.type, id).toMatch(/^background_/);
  });

  it("chooseSetting: elige por afinidad con el tema y no repite el anterior", () => {
    const topic = { id: "x", kind: "news", category: "news", keyword: "CrowdStrike", title: "t", hookTitle: "t", points: [], sources: [], entities: ["seguridad", "servidores"] } as unknown as TopicBrief;
    expect(chooseSetting(ap, topic, { episodes: [] }, "s")).toBe("servidores");
    const again = chooseSetting(ap, topic, { episodes: [entry(0, undefined, "servidores")] }, "s");
    expect(again).not.toBe("servidores");
  });

  it("planEpisode asigna escenario y, con Neru de cameo, la etapa de su arco", () => {
    const p = planEpisode({ ap, engine: cfg, history: { episodes: [] }, clusters: [], mode: "evergreen", forceTopic: "big_o", canWriteNews: false, date: "2026-10-02" });
    expect(p.setting && ap.settings.settings[p.setting]).toBeTruthy();
    // Fondos de color (ADR 0014): el usuario pidio no mencionar el entorno fisico (2026-10-02).
    expect(settingBrief(p, ap).join("\n")).toContain("NO menciones el entorno fisico");
  });

  it("arco de Neru: avanza con sus apariciones y el final solo es posible tras 10 videos (nunca automatico)", () => {
    const casting = { host: "teto", foil: "miku", cameo: "neru" };
    expect(arcBeats(ap, history(0), casting)[0]).toMatchObject({ id: "neru_voice", stage: "Solo celular", finaleAvailable: false });
    expect(arcBeats(ap, history(4, "neru"), casting)[0]!.stage).toBe("Intentos");
    expect(arcBeats(ap, history(7, "neru"), casting)[0]!.stage).toBe("Mensajes");
    const late = arcBeats(ap, history(12, "neru"), casting)[0]!;
    expect(late.stage).toBe("Casi");
    expect(late.finaleAvailable).toBe(true);
    expect(arcBrief({ arcs: [late] } as never).join("\n")).toContain("SOLO lo decide el usuario");
    expect(arcBeats(ap, history(3), { host: "teto", foil: "miku" })).toEqual([]); // sin Neru no hay arco
  });

  it("afinidad: el casting prefiere personajes ligados al tema", () => {
    const security = chooseCasting(ap, ["luka", "miku", "teto"], { episodes: [] }, "seed", [], ["seguridad", "privacidad"]);
    expect([security.host, security.foil]).toContain("luka");
  });

  it("memes de la comunidad: solo los de personajes presentes (Gumi siempre)", () => {
    const tetoMiku = loreBrief(["teto", "miku"], ap.lore).join("\n");
    expect(tetoMiku).toContain("Mesmerizer");
    expect(tetoMiku).toContain("Teto pera");
    expect(tetoMiku).toContain("Gumi");
    const luka = loreBrief(["luka", "kaito"], ap.lore).join("\n");
    expect(luka).not.toContain("Rabbit Hole");
    expect(luka).toContain("Luka Luka");
  });

  it("los temas evergreen siguen planificandose con escenario", () => {
    for (const t of ap.evergreen.slice(0, 5)) {
      expect(chooseSetting(ap, topicFromEvergreen(t), { episodes: [] }, t.id)).toBeTruthy();
    }
  });
});

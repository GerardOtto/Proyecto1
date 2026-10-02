import { describe, expect, it } from "vitest";
import { validateTimeline } from "../src/validation/timeline";
import { clone, engine, longTimeline } from "./helpers";

describe("validacion semantica del timeline", async () => {
  const { cfg, catalog } = await engine();
  const v = (t: ReturnType<typeof longTimeline>, stage: "draft" | "final" = "final") => validateTimeline(t, catalog, cfg.render, { stage });
  const codes = (t: ReturnType<typeof longTimeline>) => v(t).issues.filter((i) => i.level === "error").map((i) => i.code);

  it("el timeline base es valido", () => {
    expect(codes(longTimeline())).toEqual([]);
  });

  it("narrativa: exige hook, desarrollo y cierre", () => {
    const t = clone(longTimeline());
    t.scenes[0]!.section = "context";
    t.scenes[3]!.section = "development";
    expect(codes(t)).toEqual(expect.arrayContaining(["NO_HOOK", "NO_CLOSING"]));
    const t2 = clone(longTimeline());
    t2.scenes[2]!.section = "visual";
    expect(codes(t2)).toContain("NO_DEVELOPMENT");
  });

  it("una sola voz por personaje en el video: mezclar [VOICE:x] con su voz base avisa (ADR 0015)", () => {
    const warn = (t: ReturnType<typeof longTimeline>) => v(t).issues.filter((i) => i.code === "VOICE_MIXED");
    expect(warn(longTimeline())).toEqual([]);
    const mixed = clone(longTimeline());
    mixed.scenes.find((x) => x.id === "close")!.voiceVariant = "fluida"; // teto: hook base + cierre fluida
    expect(warn(mixed)).toHaveLength(1);
    expect(warn(mixed)[0]!.message).toMatch(/teto usa dos voces/);
    const all = clone(longTimeline());
    for (const x of all.scenes) if (x.character === "teto") x.voiceVariant = "fluida";
    expect(warn(all)).toEqual([]);
  });

  it("avatar: personaje y reaccion deben existir en el catalogo", () => {
    const t = clone(longTimeline());
    t.scenes[0]!.avatar = "sorpresa2";
    t.scenes[2]!.character = "gakupo"; // no esta en characters.json (kaito ya existe)
    expect(codes(t)).toEqual(expect.arrayContaining(["UNKNOWN_REACTION", "UNKNOWN_CHARACTER"]));
  });

  it("assets: IDs inexistentes o de tipo incorrecto son hard fail", () => {
    const t = clone(longTimeline());
    t.scenes[0]!.visuals = ["no_existe", "sfx_boom"];
    expect(codes(t)).toEqual(expect.arrayContaining(["UNKNOWN_ASSET", "ASSET_WRONG_TYPE"]));
  });

  it("no mas de 3 personajes en pantalla salvo crowd", () => {
    const t = clone(longTimeline());
    t.scenes[2]!.listeners = [{ character: "teto" }, { character: "rin" }, { character: "len" }];
    expect(codes(t)).toContain("TOO_MANY_ON_SCREEN");
    t.scenes[2]!.crowd = true;
    expect(codes(t)).not.toContain("TOO_MANY_ON_SCREEN");
  });

  it("escenas solapadas o con ids duplicados", () => {
    const t = clone(longTimeline());
    t.scenes[1]!.startMs = 3000;
    t.scenes[2]!.id = "hook";
    expect(codes(t)).toEqual(expect.arrayContaining(["SCENE_OVERLAP", "SCENE_DUPLICATE_ID"]));
  });

  it("eventos fuera de la escena o con atWord invalido", () => {
    const t = clone(longTimeline());
    t.scenes[0]!.events = [{ type: "camera_zoom", atMs: 99999 }, { type: "camera_shake", atWord: 50 }];
    expect(codes(t)).toEqual(expect.arrayContaining(["EVENT_OUT_OF_SCENE", "EVENT_BAD_WORD"]));
  });

  it("humor ausente es soft fail (warning)", () => {
    const t = clone(longTimeline());
    t.scenes[1]!.events = [];
    t.scenes[1]!.section = "development";
    t.scenes[0]!.avatar = "neutral";
    const res = v(t);
    expect(res.issues.find((i) => i.code === "NO_HUMOR")?.level).toBe("warning");
  });

  it("licencia unknown genera aviso de bloqueo comercial", () => {
    const res = v(longTimeline());
    expect(res.issues.some((i) => i.check === "license" && i.level === "error")).toBe(false);
  });

  it("audio referenciado inexistente es hard fail", () => {
    const t = clone(longTimeline());
    t.meta.audio = { master: "projects/nope/audio/master.wav", durationMs: 70000 };
    expect(codes(t)).toContain("AUDIO_MISSING");
  });
});

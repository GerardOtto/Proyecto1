import { describe, expect, it } from "vitest";
import type { ProjectContext } from "../src/catalog/catalog";
import type { CharacterConfig } from "../src/timeline/types";
import { resolveVoice } from "../src/tts";

const ch = { voice: { fish: { referenceId: "global-id", speed: 1 }, flite: { voice: "slt" } } } as CharacterConfig;
const project = (voices: ProjectContext["voices"]) => ({ voices }) as ProjectContext;

describe("resolveVoice", () => {
  it("usa el id global si el proyecto no lo define", () => {
    expect(resolveVoice("teto", ch, project({})).fishReferenceId).toBe("global-id");
  });

  it("un id vacio en requested_voices.json no tapa el global", () => {
    const v = resolveVoice("teto", ch, project({ voices: { teto: { fishReferenceId: "", speed: 1.05 } } }));
    expect(v.fishReferenceId).toBe("global-id");
    expect(v.speed).toBe(1.05);
  });

  it("el id del proyecto tiene prioridad sobre el global", () => {
    const v = resolveVoice("teto", ch, project({ voices: { teto: { fishReferenceId: "proj-id" } } }));
    expect(v.fishReferenceId).toBe("proj-id");
  });

  describe("variantes de voz por linea (ADR 0015)", () => {
    const luka = {
      voice: { fish: { referenceId: "base-id", speed: 1 }, tempo: 1.2, variants: { fluida: { fish: { referenceId: "fluida-id" }, tempo: 1 }, solo_ritmo: { tempo: 1.4 } } },
    } as unknown as CharacterConfig;

    it("[VOICE:x] cambia la voz de Fish y el ritmo; sin variante queda la base", () => {
      expect(resolveVoice("luka", luka, project({}))).toMatchObject({ fishReferenceId: "base-id", tempo: 1.2 });
      expect(resolveVoice("luka", luka, project({}), "fluida")).toMatchObject({ fishReferenceId: "fluida-id", tempo: 1 });
    });

    it("lo que la variante no define se hereda de la base", () => {
      expect(resolveVoice("luka", luka, project({}), "solo_ritmo")).toMatchObject({ fishReferenceId: "base-id", tempo: 1.4 });
    });

    it("una variante inexistente es un error claro (no cae en silencio a la voz base)", () => {
      expect(() => resolveVoice("luka", luka, project({}), "nope")).toThrow(/no existe la variante de voz "nope".*fluida, solo_ritmo/);
    });
  });
});

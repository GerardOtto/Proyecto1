// Compilador timeline -> RenderPlan.
// La IA decide QUE ocurre (timeline.json); este modulo decide COMO (frames, posiciones, escalas).
// Es una funcion pura y determinista: mismo timeline + mismo catalogo + misma config => mismo plan.
import { resolveEventAnchors } from "./anchors";
import { buildCaptionPages, layoutCaption, timelineWords } from "./captions";
import { msRangeToFrames, msToDurationInFrames, msToFrame } from "./frames";
import { resolveReaction, sceneEvents, timelineDurationMs } from "./normalize";
import type { RenderConfig, ResolvedCatalog, Timeline, VisualSlot } from "./types";
import { buildWatermark, type PlanWatermark } from "./watermark";

export type Side = "left" | "right" | "center";

export interface PlanActor {
  character: string;
  role: "speaker" | "listener";
  side: Side;
  scale: number;
  /** Escala al final del segmento anterior (para animar cambios de rol). */
  prevScale: number | null;
  dim: number;
  /** true si el personaje no estaba en escena en el segmento anterior. */
  entering: boolean;
  /** Cambios de avatar dentro del segmento (frames absolutos). El primero = from del segmento. */
  avatars: PlanAvatar[];
}

export interface PlanAvatar {
  from: number;
  src: string;
  reaction: string;
  /** true: otra imagen de la MISMA reaccion (variacion mientras habla), no un cambio semantico. */
  variant?: boolean;
}

/**
 * Intercala variantes de la misma reaccion cada `interval` frames dentro de cada tramo de avatar
 * (pura). Cada imagen se mantiene al menos `interval` frames; no se agrega una variante si no
 * queda un intervalo completo antes del siguiente cambio semantico o del fin del segmento.
 */
export const withAvatarVariants = (
  changes: PlanAvatar[],
  end: number,
  variants: Record<string, string[]> | undefined,
  interval: number,
): PlanAvatar[] => {
  if (!variants || interval <= 0) return changes;
  const out: PlanAvatar[] = [];
  changes.forEach((c, i) => {
    out.push(c);
    const list = variants[c.reaction];
    if (!list || list.length < 2 || c.src !== list[0]) return;
    const segEnd = i + 1 < changes.length ? changes[i + 1]!.from : end;
    for (let f = c.from + interval, k = 1; f + interval <= segEnd; f += interval, k++) {
      out.push({ from: f, src: list[k % list.length]!, reaction: c.reaction, variant: true });
    }
  });
  return out;
};

export interface PlanStageSegment {
  sceneId: string;
  from: number;
  to: number;
  actors: PlanActor[];
}

export interface PlanVisual {
  id: string;
  src: string;
  from: number;
  to: number;
  slot: VisualSlot;
}

export interface PlanCaptionPage {
  from: number;
  to: number;
  character: string;
  color: string;
  fontSize: number;
  tokens: Array<{ text: string; from: number; to: number; emphasis: boolean; emphasisColor?: string }>;
}

export interface PlanCamera {
  type: "zoom" | "shake";
  from: number;
  to: number;
  /** zoom: frames de rampa de entrada */
  rampFrames: number;
  scale: number;
  intensity: number;
  seed: string;
}

export interface PlanMeme {
  from: number;
  to: number;
  src: string | null;
  flashFrames: number;
  punchScale: number;
  seed: string;
  /** true: desaparece de golpe en `to` (estilo corte); false: se desvanece. */
  cut: boolean;
}

export interface PlanBroll {
  from: number;
  to: number;
  src: string;
  /** image: captura/imagen fija con zoom lento (Ken Burns) para que no quede estatica. */
  kind: "video" | "gif" | "image";
  /** Frame del clip desde el que empieza (varia entre usos del mismo clip). */
  startFrom: number;
  /** Si el clip es mas corto que el tramo: se repite en loop cada N frames. */
  loopFrames: number | null;
}

type Span = { from: number; to: number };

/** Huecos (>= minFrames) de [0, total) no cubiertos por `busy`. Pura. */
export const brollGaps = (busy: Span[], total: number, minFrames: number): Span[] => {
  const gaps: Span[] = [];
  let cursor = 0;
  for (const b of [...busy].filter((x) => x.to > x.from).sort((a, b) => a.from - b.from)) {
    if (b.from > cursor) gaps.push({ from: cursor, to: Math.min(b.from, total) });
    cursor = Math.max(cursor, b.to);
  }
  if (cursor < total) gaps.push({ from: cursor, to: total });
  return gaps.filter((g) => g.to - g.from >= minFrames);
};

/**
 * Rellena los huecos con clips en rotacion (orden dado, determinista), tramos de `clipFrames`.
 * Un resto menor que `minFrames` se suma al tramo anterior. Pura.
 */
type BrollClip = { src: string; kind: PlanBroll["kind"]; frames: number | null };

/**
 * Corta los huecos por escena. Cada trozo lleva la lista de la escena (`list`) o null (= pozo
 * global). Un trozo menor que `minFrames` se une al trozo vecino del mismo hueco. Pura.
 */
export const brollPieces = (
  gaps: Span[],
  scenes: Array<Span & { broll?: string[] }>,
  minFrames: number,
): Array<Span & { list: string[] | null }> => {
  const out: Array<Span & { list: string[] | null }> = [];
  for (const g of gaps) {
    const pieces = scenes
      .map((s) => ({ from: Math.max(g.from, s.from), to: Math.min(g.to, s.to), list: s.broll && s.broll.length ? s.broll : null }))
      .filter((p) => p.to > p.from)
      .sort((a, b) => a.from - b.from);
    const merged: typeof pieces = [];
    for (const p of pieces) {
      const prev = merged[merged.length - 1];
      if (prev && (p.to - p.from < minFrames || prev.to - prev.from < minFrames)) {
        // el trozo corto hereda la lista del mas largo de los dos
        const keep = p.to - p.from > prev.to - prev.from ? p.list : prev.list;
        prev.to = p.to;
        prev.list = keep;
      } else merged.push({ ...p });
    }
    out.push(...merged.filter((p) => p.to - p.from >= minFrames));
  }
  return out;
};

/** Reparte un tramo a partes iguales entre los clips de la lista (todos se ven, en orden). Pura. */
export const splitEven = (piece: Span, clips: BrollClip[], minFrames: number): PlanBroll[] => {
  const len = piece.to - piece.from;
  const k = Math.max(1, Math.min(clips.length, Math.floor(len / Math.max(1, minFrames))));
  return Array.from({ length: k }, (_, i) => {
    const from = piece.from + Math.round((len * i) / k);
    const to = piece.from + Math.round((len * (i + 1)) / k);
    const c = clips[i]!;
    return { from, to, src: c.src, kind: c.kind, startFrom: 0, loopFrames: c.frames && c.frames < to - from ? c.frames : null };
  });
};

/**
 * Frames donde suena el "pop" automatico al aparecer visuales/b-roll. Respeta un espaciado minimo
 * entre pops, no pisa SFX ya programados (explicitos o del meme) y calla durante los memes. Pura.
 */
export const autoPopFrames = (starts: number[], taken: number[], memes: Span[], minGap: number): number[] => {
  const out: number[] = [];
  let last = -Infinity;
  for (const f of [...new Set(starts)].sort((a, b) => a - b)) {
    if (f - last < minGap) continue;
    if (taken.some((t) => Math.abs(t - f) < minGap)) continue;
    if (memes.some((m) => f >= m.from && f < m.to)) continue;
    out.push(f);
    last = f;
  }
  return out;
};

export const fillBroll = (
  gaps: Span[],
  clips: BrollClip[],
  clipFrames: number,
  minFrames: number,
): PlanBroll[] => {
  const out: PlanBroll[] = [];
  if (clips.length === 0 || clipFrames <= 0) return out;
  const uses = new Map<string, number>();
  let k = 0;
  for (const g of gaps) {
    for (let f = g.from; f < g.to; ) {
      let end = Math.min(g.to, f + clipFrames);
      if (g.to - end < minFrames) end = g.to;
      const c = clips[k++ % clips.length]!;
      const len = end - f;
      const n = uses.get(c.src) ?? 0;
      uses.set(c.src, n + 1);
      // Cada reutilizacion del clip empieza en otro tramo (si el clip es mas largo que el hueco).
      const startFrom = c.frames && c.frames > len ? (n * clipFrames) % (c.frames - len + 1) : 0;
      const loopFrames = c.frames && c.frames < startFrom + len ? c.frames : null;
      out.push({ from: f, to: end, src: c.src, kind: c.kind, startFrom, loopFrames });
      f = end;
    }
  }
  return out;
};

export interface PlanAudioClip {
  src: string;
  from: number;
  volume: number;
  /** Si se define, el audio se corta en seco tras estos frames. */
  durationFrames?: number;
}

export interface RenderPlan {
  version: 1;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  background:
    | { kind: "video"; src: string; loopFrames: number | null; dim: number; volume: number }
    | { kind: "image"; src: string; dim: number }
    | { kind: "color"; color: string };
  fallbackColor: string;
  audio: {
    master: string | null;
    clips: PlanAudioClip[];
    sfx: PlanAudioClip[];
  };
  stage: PlanStageSegment[];
  visuals: PlanVisual[];
  captions: PlanCaptionPage[];
  camera: PlanCamera[];
  memes: PlanMeme[];
  /** Relleno del area de visuales cuando no hay visual ni meme. */
  broll: PlanBroll[];
  /** Marca de agua rebotando (handle segun idioma); null = sin marca. */
  watermark: PlanWatermark | null;
  colors: Record<string, string>;
  names: Record<string, string>;
  style: {
    captions: RenderConfig["captions"];
    safeArea: RenderConfig["safeArea"];
    visualArea: RenderConfig["layout"]["visualArea"];
    characterMarginX: number;
    /** Centro horizontal de los subtitulos: centro de la safe area (no del frame). */
    captionCenterX: number;
    visualPopInFrames: number;
    visualPopOutFrames: number;
  };
  debug: { showSafeArea: boolean };
}

export interface PlanOptions {
  showSafeArea?: boolean;
}

export class PlanError extends Error {}

export const captionCenterX = (cfg: RenderConfig): number =>
  Math.round(cfg.safeArea.left + (cfg.video.width - cfg.safeArea.left - cfg.safeArea.right) / 2);

const sideOrder = (anchor: "bottom-left" | "bottom-right"): Side[] =>
  anchor === "bottom-left" ? ["left", "right", "center"] : ["right", "left", "center"];

export const buildRenderPlan = (
  input: Timeline,
  catalog: ResolvedCatalog,
  cfg: RenderConfig,
  opts: PlanOptions = {},
): RenderPlan => {
  // atWord -> atMs con las palabras disponibles (reales o estimadas).
  const timeline = resolveEventAnchors(input);
  const fps = timeline.meta.fps;
  const totalMs = timelineDurationMs(timeline);
  const durationInFrames = msToDurationInFrames(totalMs, fps);
  const scenes = [...timeline.scenes].sort((a, b) => a.startMs - b.startMs);

  const avatarSrc = (character: string, avatar: string | undefined): { src: string; reaction: string } => {
    const ch = catalog.characters[character];
    if (!ch) throw new PlanError(`Personaje desconocido: ${character}`);
    const reaction = resolveReaction(avatar, catalog.reactionAliases);
    if (!reaction) throw new PlanError(`Reaccion desconocida "${avatar}" para ${character}`);
    const src = ch.avatars[reaction] ?? ch.avatars["neutral"];
    if (!src) throw new PlanError(`${character} no tiene avatar para "${reaction}" ni neutral`);
    return { src, reaction };
  };

  const asset = (id: string, types?: string[]) => {
    const a = catalog.assets[id];
    if (!a) throw new PlanError(`Asset desconocido: ${id}`);
    if (types && !types.includes(a.type)) {
      throw new PlanError(`Asset ${id} es de tipo ${a.type}, se esperaba ${types.join("/")}`);
    }
    return a;
  };

  // ---------------------------------------------------------------- stage
  // Lados estables: cada personaje conserva su lado durante todo el video (orden de aparicion).
  const sides = new Map<string, Side>();
  const assignSide = (character: string): Side => {
    const existing = sides.get(character);
    if (existing) return existing;
    const ch = catalog.characters[character];
    const order = sideOrder(ch?.anchor ?? "bottom-left");
    const used = new Set(sides.values());
    const side = order.find((s) => !used.has(s)) ?? "center";
    sides.set(character, side);
    return side;
  };

  const stage: PlanStageSegment[] = [];
  let prevActors: Map<string, { scale: number; avatar: string | undefined }> = new Map();
  let lastSpeaker: string | undefined;
  let prevOnScreen: Array<{ character: string; avatar?: string; role: "speaker" | "listener" }> = [];

  for (const scene of scenes) {
    const { from, to } = msRangeToFrames(scene.startMs, scene.endMs, fps);
    let onScreen: Array<{ character: string; avatar?: string; role: "speaker" | "listener" }>;

    if (scene.character) {
      onScreen = [{ character: scene.character, avatar: scene.avatar, role: "speaker" }];
      const listeners =
        scene.listeners ??
        (lastSpeaker && lastSpeaker !== scene.character ? [{ character: lastSpeaker, avatar: "neutral" }] : []);
      for (const l of listeners) {
        if (l.character !== scene.character) onScreen.push({ character: l.character, avatar: l.avatar, role: "listener" });
      }
    } else if (scene.listeners) {
      onScreen = scene.listeners.map((l) => ({ character: l.character, avatar: l.avatar, role: "listener" as const }));
    } else {
      // Escena sin dialogo (meme, pausa): se mantienen los personajes anteriores.
      onScreen = prevOnScreen.map((a) => ({ ...a, avatar: prevActors.get(a.character)?.avatar ?? a.avatar }));
    }

    const events = sceneEvents(scene);
    const actors: PlanActor[] = onScreen.map((a) => {
      const ch = catalog.characters[a.character];
      if (!ch) throw new PlanError(`Personaje desconocido: ${a.character} (escena ${scene.id})`);
      const first = avatarSrc(a.character, a.avatar);
      const changes: PlanActor["avatars"] = [{ from, ...first }];
      for (const e of events) {
        if (e.type !== "character_reaction" || e.character !== a.character) continue;
        const at = Math.min(to - 1, from + msToFrame(e.atMs ?? 0, fps));
        const next = avatarSrc(a.character, e.avatar);
        if (at <= from) changes[0] = { from, ...next };
        else changes.push({ from: at, ...next });
      }
      changes.sort((x, y) => x.from - y.from);
      // Mientras habla, la imagen alterna entre variantes de la misma reaccion (da vida a turnos largos).
      const variantInterval = msToDurationInFrames(cfg.timing.avatarVariantIntervalMs ?? 0, fps);
      const avatars = a.role === "speaker" ? withAvatarVariants(changes, to, ch.variants, variantInterval) : changes;
      const scale = a.role === "speaker" ? ch.defaultScale : ch.defaultScale * cfg.layout.listenerScaleFactor;
      const prev = prevActors.get(a.character);
      return {
        character: a.character,
        role: a.role,
        side: assignSide(a.character),
        scale,
        prevScale: prev ? prev.scale : null,
        dim: a.role === "listener" ? cfg.layout.listenerDim : 0,
        entering: prev === undefined,
        avatars,
      };
    });

    // Los eventos character_reaction de personajes que no estan en escena son un error de contrato.
    for (const e of events) {
      if (e.type === "character_reaction" && !onScreen.some((a) => a.character === e.character)) {
        throw new PlanError(
          `character_reaction para "${e.character}" en escena ${scene.id}, pero no esta en pantalla (agregalo a listeners)`,
        );
      }
    }

    // Orden de pintado: listeners detras, speaker delante.
    actors.sort((x, y) => (x.role === y.role ? 0 : x.role === "listener" ? -1 : 1));
    stage.push({ sceneId: scene.id, from, to, actors });

    prevActors = new Map(
      actors.map((a) => [a.character, { scale: a.scale, avatar: a.avatars[a.avatars.length - 1]?.reaction }]),
    );
    prevOnScreen = onScreen;
    if (scene.character) lastSpeaker = scene.character;
  }

  // ---------------------------------------------------------------- visuals
  const visuals: PlanVisual[] = [];
  const openVisuals = new Map<string, PlanVisual>();
  const visualTypes = ["image", "logo", "diagram", "meme"];
  for (const scene of scenes) {
    const { from: sFrom, to: sTo } = msRangeToFrames(scene.startMs, scene.endMs, fps);
    for (const id of scene.visuals ?? []) {
      const a = asset(id, visualTypes);
      const last = [...visuals].reverse().find((v) => v.id === id);
      if (last && last.to >= sFrom - 1 && last.slot === "auto") {
        last.to = Math.max(last.to, sTo); // escenas contiguas con el mismo visual: no re-animar
      } else {
        visuals.push({ id, src: a.path, from: sFrom, to: sTo, slot: "auto" });
      }
    }
    for (const e of sceneEvents(scene)) {
      if (e.type === "visual_show") {
        const a = asset(e.visual, visualTypes);
        const from = sFrom + msToFrame(e.atMs ?? 0, fps);
        const to = e.durationMs !== undefined ? from + msToDurationInFrames(e.durationMs, fps) : sTo;
        const v: PlanVisual = { id: e.visual, src: a.path, from, to: Math.max(from + 1, to), slot: e.slot ?? "auto" };
        visuals.push(v);
        if (e.durationMs === undefined) openVisuals.set(e.visual, v);
      } else if (e.type === "visual_hide") {
        const at = sFrom + msToFrame(e.atMs ?? 0, fps);
        const open = openVisuals.get(e.visual);
        const target = open ?? [...visuals].reverse().find((v) => v.id === e.visual && v.from <= at);
        if (target) {
          target.to = Math.max(target.from + 1, at);
          openVisuals.delete(e.visual);
        }
      }
    }
    // Un visual_show sin duracion ni hide termina con su escena (ya fijado en to = sTo).
    openVisuals.clear();
  }
  visuals.sort((a, b) => a.from - b.from || a.id.localeCompare(b.id));

  // ---------------------------------------------------------------- camera, memes, sfx
  const camera: PlanCamera[] = [];
  const memes: PlanMeme[] = [];
  const sfx: PlanAudioClip[] = [];
  for (const scene of scenes) {
    const { from: sFrom, to: sTo } = msRangeToFrames(scene.startMs, scene.endMs, fps);
    sceneEvents(scene).forEach((e, idx) => {
      const at = Math.min(sTo - 1, sFrom + msToFrame(e.atMs ?? 0, fps));
      const seed = `${scene.id}-${idx}`;
      switch (e.type) {
        case "camera_zoom": {
          const ramp = msToDurationInFrames(e.durationMs ?? cfg.events.cameraZoom.durationMs, fps);
          camera.push({ type: "zoom", from: at, to: sTo, rampFrames: ramp, scale: e.scale ?? cfg.events.cameraZoom.scale, intensity: 0, seed });
          break;
        }
        case "camera_shake": {
          const d = msToDurationInFrames(e.durationMs ?? cfg.events.cameraShake.durationMs, fps);
          camera.push({ type: "shake", from: at, to: at + d, rampFrames: 0, scale: 1, intensity: e.intensity ?? cfg.events.cameraShake.intensity, seed });
          break;
        }
        case "meme_explosion": {
          const me = cfg.events.memeExplosion;
          const cut = me.cutAtMs !== undefined;
          const d = msToDurationInFrames(e.durationMs ?? me.cutAtMs ?? me.durationMs, fps);
          const memeId = e.meme ?? me.defaultMeme;
          const memeAsset = catalog.assets[memeId] ? asset(memeId, ["meme", "image"]) : null;
          memes.push({ from: at, to: at + d, src: memeAsset?.path ?? null, flashFrames: msToDurationInFrames(me.flashMs, fps), punchScale: me.punchScale, seed, cut });
          // En estilo corte, la sacudida y el SFX terminan en el mismo frame que la imagen.
          const shake = msToDurationInFrames(cfg.events.cameraShake.durationMs, fps);
          camera.push({ type: "shake", from: at, to: at + (cut ? Math.min(shake, d) : shake), rampFrames: 0, scale: 1, intensity: cfg.events.cameraShake.intensity, seed });
          const sfxId = e.sfx ?? me.defaultSfx;
          if (catalog.assets[sfxId]) sfx.push({ src: asset(sfxId, ["sfx"]).path, from: at, volume: cfg.audio.sfxVolume, ...(cut ? { durationFrames: d } : {}) });
          break;
        }
        case "sfx":
          sfx.push({ src: asset(e.sfx, ["sfx"]).path, from: at, volume: e.volume ?? cfg.audio.sfxVolume });
          break;
        default:
          break;
      }
    });
  }

  // ---------------------------------------------------------------- b-roll
  // Estimulo constante en el area de visuales: los huecos sin visual ni meme se rellenan con clips.
  // Cada escena puede traer su propio relleno contextual (scene.broll); si no, pozo global (meta.broll).
  const brollCfg = cfg.events.broll ?? { clipMs: 4000, minMs: 1000 };
  const brollClip = (id: string): BrollClip => {
    const a = asset(id, ["broll"]);
    const p = a.path.toLowerCase();
    const kind = p.endsWith(".gif") ? "gif" : /\.(png|jpe?g|webp|svg)$/.test(p) ? "image" : "video";
    return { src: a.path, kind, frames: kind === "video" && a.durationMs ? msToDurationInFrames(a.durationMs, fps) : null };
  };
  const pool = (timeline.meta.broll ?? []).map(brollClip);
  const minBroll = msToDurationInFrames(brollCfg.minMs, fps);
  const pieces = brollPieces(
    brollGaps([...visuals, ...memes], durationInFrames, minBroll),
    scenes.map((s) => ({ ...msRangeToFrames(s.startMs, s.endMs, fps), ...(s.broll ? { broll: s.broll } : {}) })),
    minBroll,
  );
  const broll = [
    ...pieces.filter((p) => p.list).flatMap((p) => splitEven(p, p.list!.map(brollClip), minBroll)),
    ...fillBroll(pieces.filter((p) => !p.list), pool, msToDurationInFrames(brollCfg.clipMs, fps), minBroll),
  ].sort((a, b) => a.from - b.from);

  // Pop automatico al aparecer cada visual o tramo de b-roll: da pulso a los monologos largos.
  const pop = cfg.events.visual.sfx;
  if (pop && catalog.assets[pop.id]) {
    const src = asset(pop.id, ["sfx"]).path;
    const frames = autoPopFrames(
      [...visuals.map((v) => v.from), ...broll.map((b) => b.from)],
      sfx.map((s) => s.from),
      memes,
      msToDurationInFrames(pop.minGapMs, fps),
    );
    for (const f of frames) sfx.push({ src, from: f, volume: pop.volume });
    sfx.sort((a, b) => a.from - b.from);
  }

  // ---------------------------------------------------------------- captions
  const colors: Record<string, string> = Object.fromEntries(
    Object.entries(catalog.characters).map(([id, c]) => [id, c.color]),
  );
  const pages = buildCaptionPages(timelineWords(timeline), timeline, cfg.captions);
  const captions: PlanCaptionPage[] = pages.map((p) => {
    const color = colors[p.character];
    if (!color) throw new PlanError(`Caption de personaje desconocido: ${p.character}`);
    const { from, to } = msRangeToFrames(p.startMs, p.endMs, fps);
    const layout = layoutCaption(p.tokens.map((t) => t.text), cfg.captions);
    return {
      from,
      to,
      character: p.character,
      color,
      fontSize: layout.fontSize,
      tokens: p.tokens.map((t) => ({
        text: t.text,
        from: msToFrame(t.startMs, fps),
        to: msToFrame(t.endMs, fps),
        emphasis: t.emphasis,
        ...(t.emphasisColor ? { emphasisColor: t.emphasisColor } : {}),
      })),
    };
  });

  // ---------------------------------------------------------------- background & audio
  let background: RenderPlan["background"] = { kind: "color", color: cfg.background.fallbackColor };
  if (timeline.meta.background) {
    const bg = catalog.assets[timeline.meta.background];
    if (!bg) throw new PlanError(`Fondo desconocido: ${timeline.meta.background}`);
    if (bg.type === "background_video") {
      background = {
        kind: "video",
        src: bg.path,
        loopFrames: bg.durationMs ? msToDurationInFrames(bg.durationMs, fps) : null,
        dim: cfg.background.dim,
        volume: cfg.audio.backgroundVideoVolume,
      };
    } else if (bg.type === "background_image") {
      background = { kind: "image", src: bg.path, dim: cfg.background.dim };
    } else {
      throw new PlanError(`El asset ${bg.path} no es un fondo (tipo ${bg.type})`);
    }
  }

  const clips: PlanAudioClip[] = [];
  const master = timeline.meta.audio?.master ?? null;
  if (!master) {
    for (const scene of scenes) {
      if (scene.audio) {
        clips.push({ src: scene.audio.src, from: msToFrame(scene.startMs + (scene.audio.offsetMs ?? 0), fps), volume: 1 });
      }
    }
  }

  return {
    version: 1,
    title: timeline.meta.title,
    width: cfg.video.width,
    height: cfg.video.height,
    fps,
    durationInFrames,
    background,
    fallbackColor: cfg.background.fallbackColor,
    audio: { master, clips, sfx },
    stage,
    visuals,
    captions,
    camera,
    memes,
    broll,
    watermark: buildWatermark(cfg, timeline.meta.language, fps),
    colors,
    names: Object.fromEntries(Object.entries(catalog.characters).map(([id, c]) => [id, c.displayName])),
    style: {
      captions: cfg.captions,
      safeArea: cfg.safeArea,
      visualArea: cfg.layout.visualArea,
      characterMarginX: cfg.layout.characterMarginX,
      captionCenterX: captionCenterX(cfg),
      visualPopInFrames: msToDurationInFrames(cfg.events.visual.popInMs, fps),
      visualPopOutFrames: msToDurationInFrames(cfg.events.visual.popOutMs, fps),
    },
    debug: { showSafeArea: opts.showSafeArea ?? false },
  };
};


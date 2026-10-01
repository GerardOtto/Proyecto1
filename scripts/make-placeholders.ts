// Genera assets PLACEHOLDER deterministas para que el pipeline funcione de punta a punta sin
// ilustraciones reales: avatares por personaje/reaccion, logos de texto, diagramas, memes,
// un fondo en loop y SFX sinteticos. Reemplazarlos por material con licencia verificada.
//
// Uso: npm run assets:placeholders [-- --force] [-- --only characters|visuals|background|sfx]
// Requiere ffmpeg (con librsvg para rasterizar SVG -> PNG; si no, se dejan los .svg).
import fs from "node:fs";
import path from "node:path";
import { FFMPEG } from "../src/audio/ffmpeg";
import { loadEngineConfig } from "../src/catalog/catalog";
import { main, parseCli } from "../src/utils/cli";
import { run } from "../src/utils/exec";
import { log } from "../src/utils/log";
import { fromRepo, toRepoRel } from "../src/utils/paths";

const { values } = parseCli({
  force: { type: "boolean" },
  only: { type: "string" },
});

const HAIR: Record<string, { hair: string; style: "drills" | "twintails" | "long" | "short_bow" | "short_tail" }> = {
  teto: { hair: "#C8324B", style: "drills" },
  miku: { hair: "#2FB5AA", style: "twintails" },
  luka: { hair: "#E07AAE", style: "long" },
  rin: { hair: "#F2CF4A", style: "short_bow" },
  len: { hair: "#EBC03F", style: "short_tail" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const hairBack = (style: string, c: string): string => {
  switch (style) {
    case "drills":
      return `<ellipse cx="150" cy="420" rx="62" ry="150" fill="${c}"/><ellipse cx="450" cy="420" rx="62" ry="150" fill="${c}"/>
        <path d="M110 330 q40 30 80 0 M110 400 q40 30 80 0 M110 470 q40 30 80 0" stroke="#00000033" stroke-width="8" fill="none"/>
        <path d="M410 330 q40 30 80 0 M410 400 q40 30 80 0 M410 470 q40 30 80 0" stroke="#00000033" stroke-width="8" fill="none"/>`;
    case "twintails":
      return `<path d="M170 200 C40 260 40 640 90 820 L150 820 C120 640 140 330 210 250 Z" fill="${c}"/>
        <path d="M430 200 C560 260 560 640 510 820 L450 820 C480 640 460 330 390 250 Z" fill="${c}"/>`;
    case "long":
      return `<path d="M140 220 C100 420 110 640 150 820 L450 820 C490 640 500 420 460 220 Z" fill="${c}"/>`;
    default:
      return "";
  }
};

const hairFront = (style: string, c: string): string => {
  const bangs = `<path d="M175 250 C190 120 410 120 425 250 C400 205 370 230 345 200 C320 235 280 215 260 200 C240 230 205 215 175 250 Z" fill="${c}"/>`;
  switch (style) {
    case "short_bow":
      return `${bangs}<path d="M240 125 L300 150 L360 125 L345 175 L300 160 L255 175 Z" fill="#FFFFFF" stroke="#DDD" stroke-width="4"/>`;
    case "short_tail":
      return `${bangs}<path d="M300 130 C330 110 380 120 380 150 C350 140 330 150 300 145 Z" fill="${c}"/>`;
    default:
      return bangs;
  }
};

const face = (reaction: string): string => {
  const eye = (cx: number) => `<ellipse cx="${cx}" cy="300" rx="16" ry="22" fill="#2B2B3A"/><circle cx="${cx + 5}" cy="292" r="6" fill="#fff"/>`;
  const blush = `<ellipse cx="225" cy="340" rx="20" ry="9" fill="#FF8FA3" opacity="0.6"/><ellipse cx="375" cy="340" rx="20" ry="9" fill="#FF8FA3" opacity="0.6"/>`;
  switch (reaction) {
    case "feliz":
      return `<path d="M240 305 q20 -24 40 0 M320 305 q20 -24 40 0" stroke="#2B2B3A" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M265 345 q35 35 70 0" stroke="#2B2B3A" stroke-width="7" fill="#C2414F"/>${blush}`;
    case "sorprendido":
      return `<circle cx="260" cy="300" r="24" fill="#fff" stroke="#2B2B3A" stroke-width="6"/><circle cx="260" cy="300" r="10" fill="#2B2B3A"/>
        <circle cx="340" cy="300" r="24" fill="#fff" stroke="#2B2B3A" stroke-width="6"/><circle cx="340" cy="300" r="10" fill="#2B2B3A"/>
        <ellipse cx="300" cy="365" rx="16" ry="22" fill="#C2414F" stroke="#2B2B3A" stroke-width="5"/>
        <path d="M232 262 q28 -18 56 0 M312 262 q28 -18 56 0" stroke="#2B2B3A" stroke-width="5" fill="none"/>`;
    case "confundido":
      return `${eye(260)}<ellipse cx="340" cy="300" rx="11" ry="14" fill="#2B2B3A"/>
        <path d="M270 360 q15 -12 30 0 t30 0" stroke="#2B2B3A" stroke-width="6" fill="none"/>
        <text x="430" y="200" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="110" fill="#FFD84D" stroke="#2B2B3A" stroke-width="5">?</text>`;
    case "enojado":
      return `<path d="M232 270 L285 290 M368 270 L315 290" stroke="#2B2B3A" stroke-width="8" stroke-linecap="round"/>
        ${eye(260)}${eye(340)}<path d="M270 370 q30 -25 60 0" stroke="#2B2B3A" stroke-width="7" fill="none"/>
        <path d="M410 200 l20 -20 m-10 30 l30 -5 m-35 -5 l5 -30" stroke="#E0303A" stroke-width="9" stroke-linecap="round"/>`;
    case "riendo":
      return `<path d="M240 300 l20 10 l-20 10 M360 300 l-20 10 l20 10" stroke="#2B2B3A" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M255 340 q45 65 90 0 Z" fill="#C2414F" stroke="#2B2B3A" stroke-width="6"/>${blush}
        <path d="M228 330 q-8 20 2 30 M372 330 q8 20 -2 30" stroke="#6EC6FF" stroke-width="8" fill="none"/>`;
    case "nerd":
      return `${eye(260)}${eye(340)}
        <circle cx="260" cy="300" r="34" fill="none" stroke="#2B2B3A" stroke-width="7"/><circle cx="340" cy="300" r="34" fill="none" stroke="#2B2B3A" stroke-width="7"/>
        <path d="M294 300 h12" stroke="#2B2B3A" stroke-width="7"/><path d="M280 360 q20 12 40 0" stroke="#2B2B3A" stroke-width="6" fill="none"/>`;
    case "shocked":
      return `<circle cx="258" cy="298" r="28" fill="#fff" stroke="#2B2B3A" stroke-width="6"/><circle cx="258" cy="298" r="5" fill="#2B2B3A"/>
        <circle cx="342" cy="298" r="28" fill="#fff" stroke="#2B2B3A" stroke-width="6"/><circle cx="342" cy="298" r="5" fill="#2B2B3A"/>
        <ellipse cx="300" cy="375" rx="30" ry="38" fill="#7A1E2A" stroke="#2B2B3A" stroke-width="6"/>
        <path d="M200 230 l-30 -40 M400 230 l30 -40 M300 190 v-50" stroke="#2B2B3A" stroke-width="6"/>
        <path d="M418 300 q10 25 0 40 q-10 -15 0 -40" fill="#6EC6FF"/>`;
    default:
      return `${eye(260)}${eye(340)}<path d="M280 360 q20 10 40 0" stroke="#2B2B3A" stroke-width="6" fill="none"/>`;
  }
};

const avatarSvg = (id: string, displayName: string, color: string, reaction: string): string => {
  const h = HAIR[id] ?? { hair: color, style: "long" as const };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  ${hairBack(h.style, h.hair)}
  <path d="M150 900 C150 620 200 520 300 520 C400 520 450 620 450 900 Z" fill="${color}" stroke="#2B2B3A" stroke-width="6"/>
  <path d="M250 530 L300 600 L350 530" fill="#2B2B3A" opacity="0.85"/>
  <rect x="270" y="440" width="60" height="90" fill="#FBE3D3"/>
  <ellipse cx="300" cy="300" rx="135" ry="150" fill="#FDEBDD" stroke="#2B2B3A" stroke-width="6"/>
  ${hairFront(h.style, h.hair)}
  ${face(reaction)}
  <rect x="170" y="700" width="260" height="70" rx="18" fill="#FFFFFFE6"/>
  <text x="300" y="748" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="40" fill="#2B2B3A">${esc(displayName)}</text>
  <text x="300" y="815" text-anchor="middle" font-family="DejaVu Sans, Arial" font-size="30" fill="#FFFFFF" stroke="#2B2B3A" stroke-width="1.5">${esc(reaction)}</text>
</svg>`;
};

const cardSvg = (title: string, subtitle: string, bg: string, fg = "#FFFFFF"): string => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect x="10" y="10" width="780" height="580" rx="48" fill="${bg}" stroke="#FFFFFF" stroke-width="10"/>
  <text x="400" y="300" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="96" fill="${fg}">${esc(title)}</text>
  <text x="400" y="390" text-anchor="middle" font-family="DejaVu Sans, Arial" font-size="40" fill="${fg}" opacity="0.85">${esc(subtitle)}</text>
  <text x="400" y="545" text-anchor="middle" font-family="DejaVu Sans, Arial" font-size="26" fill="${fg}" opacity="0.6">PLACEHOLDER</text>
</svg>`;

const barsSvg = (title: string, labels: string[], values: number[], colors: string[]): string => {
  const bars = values
    .map((v, i) => {
      const w = 140;
      const x = 120 + i * 200;
      const h = v * 3.4;
      return `<rect x="${x}" y="${500 - h}" width="${w}" height="${h}" rx="14" fill="${colors[i % colors.length]}"/>
      <text x="${x + w / 2}" y="${490 - h}" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="36" fill="#fff">${v}</text>
      <text x="${x + w / 2}" y="550" text-anchor="middle" font-family="DejaVu Sans, Arial" font-size="32" fill="#fff">${esc(labels[i] ?? "")}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect x="10" y="10" width="780" height="580" rx="40" fill="#1E2240" stroke="#FFFFFF" stroke-width="8"/>
  <text x="400" y="80" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="44" fill="#fff">${esc(title)}</text>
  <line x1="90" y1="500" x2="720" y2="500" stroke="#ffffff88" stroke-width="4"/>
  ${bars}
</svg>`;
};

const memeSvg = (text: string, fill: string): string => {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 380 : 250;
    const a = (i / 24) * Math.PI * 2;
    pts.push(`${(400 + Math.cos(a) * r).toFixed(1)},${(400 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <polygon points="${pts.join(" ")}" fill="${fill}" stroke="#2B2B3A" stroke-width="14"/>
  <text x="400" y="450" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="bold" font-size="150" fill="#FFFFFF" stroke="#2B2B3A" stroke-width="10" paint-order="stroke">${esc(text)}</text>
</svg>`;
};

const gradientSvg = (): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B1F3B"/><stop offset="0.5" stop-color="#3A1C71"/><stop offset="1" stop-color="#0F4C5C"/></linearGradient></defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
</svg>`;

let hasRsvg: boolean | null = null;
const svgToPng = async (svg: string, outPng: string): Promise<string> => {
  const svgPath = outPng.replace(/\.png$/, ".svg");
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  fs.writeFileSync(svgPath, svg);
  if (hasRsvg === null) {
    const res = await run(FFMPEG, ["-hide_banner", "-decoders"], { allowFail: true });
    hasRsvg = /librsvg/.test(res.stdout);
    if (!hasRsvg) log.warn("ffmpeg sin librsvg: se dejan los placeholders en .svg (el catalogo los resuelve por extension)");
  }
  if (!hasRsvg) return svgPath;
  await run(FFMPEG, ["-y", "-v", "error", "-i", svgPath, "-frames:v", "1", "-pix_fmt", "rgba", outPng]);
  fs.rmSync(svgPath);
  return outPng;
};

const shouldWrite = (p: string) => values.force || (!fs.existsSync(p) && !fs.existsSync(p.replace(/\.png$/, ".svg")));

main(async () => {
  const cfg = loadEngineConfig();
  const only = values.only;
  let count = 0;

  if (!only || only === "characters") {
    for (const [id, ch] of Object.entries(cfg.characters.characters)) {
      for (const [reaction, file] of Object.entries(ch.reactions)) {
        const out = fromRepo(ch.avatarDir, file.replace(/\.(jpg|jpeg|webp|svg)$/, ".png"));
        if (!shouldWrite(out)) continue;
        await svgToPng(avatarSvg(id, ch.displayName, ch.subtitleColor, reaction), out);
        count++;
      }
    }
    log.ok("avatares placeholder");
  }

  if (!only || only === "visuals") {
    const visuals: Array<[string, string]> = [
      ["assets/logos/chatgpt_logo.png", cardSvg("ChatGPT", "logo (placeholder)", "#10A37F")],
      ["assets/logos/claude_logo.png", cardSvg("Claude", "logo (placeholder)", "#D97757")],
      ["assets/logos/deepseek_logo.png", cardSvg("DeepSeek", "logo (placeholder)", "#4D6BFE")],
      ["assets/visuals/headline_card.png", cardSvg("¡TITULAR!", "\"China destruyó a la IA\"", "#B3261E")],
      ["assets/visuals/chart_benchmarks.png", barsSvg("Benchmarks (ilustrativo)", ["A", "B", "C"], [82, 88, 85], ["#10A37F", "#D97757", "#4D6BFE"])],
      ["assets/visuals/diagram_competition.png", cardSvg("Competencia", "más modelos → mejores precios", "#5B3CC4")],
      ["assets/visuals/diagram_cost_down.png", barsSvg("Costo por consulta", ["2023", "2024", "2025"], [100, 45, 12], ["#E0503A", "#F2A93B", "#39C5BB"])],
      ["assets/memes/meme_boom.png", memeSvg("BOOM!", "#FF7A1A")],
      ["assets/memes/meme_question.png", memeSvg("¿¡QUÉ!?", "#7A5CFF")],
      ["assets/backgrounds/bg_dark_gradient.png", gradientSvg()],
    ];
    for (const [rel, svg] of visuals) {
      const out = fromRepo(rel);
      if (!shouldWrite(out)) continue;
      await svgToPng(svg, out);
      count++;
    }
    log.ok("visuales placeholder");
  }

  if (!only || only === "background") {
    const out = fromRepo("assets/backgrounds/bg_tech_loop.mp4");
    if (values.force || !fs.existsSync(out)) {
      // 10 s en loop: gradiente animado + rejilla tenue. Bajo bitrate (es un fondo atenuado).
      await run(FFMPEG, [
        "-y", "-v", "error",
        "-f", "lavfi", "-i",
        "gradients=s=540x960:c0=0x1b1f3b:c1=0x3a1c71:c2=0x0f4c5c:c3=0x2a0f3b:n=4:speed=0.015:d=10:r=30:seed=7",
        "-vf", "drawgrid=w=60:h=60:t=1:c=white@0.06,scale=1080:1920:flags=bicubic",
        "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
        out,
      ]);
      count++;
    }
    log.ok("fondo placeholder");
  }

  if (!only || only === "sfx") {
    const sfx: Array<[string, string, number]> = [
      ["assets/sfx/sfx_boom.wav", "0.9*sin(2*PI*(90-60*t)*t)*exp(-4*t)+0.35*(random(0)*2-1)*exp(-10*t)", 0.9],
      ["assets/sfx/sfx_whoosh.wav", "0.5*(random(0)*2-1)*sin(PI*t/0.6)", 0.6],
      ["assets/sfx/sfx_ding.wav", "0.5*sin(2*PI*1320*t)*exp(-5*t)+0.25*sin(2*PI*2640*t)*exp(-7*t)", 1.0],
      ["assets/sfx/sfx_pop.wav", "0.8*sin(2*PI*(500+1800*t)*t)*exp(-28*t)", 0.2],
    ];
    for (const [rel, expr, d] of sfx) {
      const out = fromRepo(rel);
      if (!values.force && fs.existsSync(out)) continue;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await run(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", `aevalsrc='${expr}':s=48000:d=${d}`, "-af", "lowpass=f=9000", "-ac", "1", "-c:a", "pcm_s16le", out]);
      count++;
    }
    log.ok("sfx placeholder");
  }

  log.info(`${count} archivos generados en ${toRepoRel(fromRepo("assets"))}/`);
});

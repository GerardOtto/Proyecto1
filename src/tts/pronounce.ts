// Diccionario de pronunciacion (ADR 0013): reescribe SOLO el texto que se envia al TTS. Los
// subtitulos siguen mostrando el texto del guion ("Log4Shell" se lee "Log four shell"). Pura.

export interface PronunciationRule {
  /** Termino tal como aparece en el guion (sin distinguir mayusculas). */
  term: string;
  /** Como debe decirlo la voz. */
  say: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Sustituye cada termino por su pronunciacion, solo como palabra completa. Los terminos mas largos
 * se aplican primero ("Log4Shell" antes que "Log4j").
 */
export const applyPronunciations = (text: string, rules: PronunciationRule[]): string => {
  let out = text;
  for (const r of [...rules].sort((a, b) => b.term.length - a.term.length)) {
    if (!r.term.trim()) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(r.term)}(?![\\p{L}\\p{N}_])`, "giu");
    out = out.replace(re, r.say);
  }
  return out;
};

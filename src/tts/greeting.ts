// Saludo recurrente ("¡Papu papu!"): audio propio por personaje, grabado una vez y reutilizado en
// todos los videos. En el guion se escribe al inicio de la linea; el motor lo separa, genera (o
// busca) solo el resto y une saludo + pausa + resto. Pura.
import { normalizeWord, splitWords } from "../timeline/normalize";

/**
 * Si `dialogue` empieza con el saludo (ignorando mayusculas, tildes y signos), devuelve el resto
 * de la linea (puede quedar vacio). Si no empieza con el saludo, null.
 */
export const splitGreeting = (dialogue: string, greetingText: string): { rest: string } | null => {
  const target = splitWords(greetingText).map(normalizeWord).filter(Boolean);
  if (target.length === 0) return null;
  const words = splitWords(dialogue);
  const head = words.slice(0, target.length).map(normalizeWord);
  if (head.length < target.length || head.some((w, i) => w !== target[i])) return null;
  // Corta el texto original justo despues de la ultima palabra del saludo y su puntuacion de cierre.
  let pos = 0;
  for (let i = 0; i < target.length; i++) {
    const w = words[i]!;
    const at = dialogue.indexOf(w, pos);
    pos = at + w.length;
  }
  const rest = dialogue.slice(pos).replace(/^[\s!¡.,…:;]+/, "");
  return { rest: rest.trim() };
};

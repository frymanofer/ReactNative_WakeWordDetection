// Speech-recognition noise (2026-11-10 phone: "The.", "But.", "Boy.", "Alma Alma." between real commands). Such a fragment is
// answered with "didn't catch that" instead of going to the model, which declined them ("not available in this app") or handed
// them over ("not available in this demo, contact ...").

/** Words that alone never make a request (articles, conjunctions, fillers), en + pt. */
const FILLERS = new Set([
  'the', 'a', 'an', 'and', 'but', 'or', 'so', 'then', 'um', 'uh', 'uhm', 'hmm', 'mm', 'oh', 'ah', 'eh', 'boy', 'well', 'like', 'just', 'okay so',
  'o', 'os', 'as', 'e', 'é', 'mas', 'ou', 'então', 'entao', 'tipo', 'né', 'ne', 'hã', 'ha', 'hum', 'ahn', 'ué', 'ue', 'peraí', 'perai', 'bom',
]);

/** True for a transcript that is only noise: filler words, or one word said twice ("Alma Alma."). */
export function isNoiseFragment(text: string): boolean {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  if (words.length > 2 || words.some((w) => /\d/.test(w))) return false;
  if (words.every((w) => FILLERS.has(w))) return true;
  return words.length === 2 && words[0] === words[1];
}

/** A very short request (two words or fewer, no number): too little to be a real "can't do that". */
export function isTooShortForDecline(text: string): boolean {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean);
  return words.length <= 2 && !words.some((w) => /\d/.test(w));
}

/** A bare "Done." (en / pt): in the car demo every real action is confirmed by the app's own sentence from the tool result, so
 * the model saying only "Done." means nothing was done (2026-11-10 phone: "Eh?", "Can.", "You do." -> "Done."). */
export function isBareDone(sentence: string): boolean {
  return /^\s*(done|all set|okay,? done|ok,? done|pronto|prontinho|feito|ok,? feito|tudo certo)\s*[.!]?\s*$/i.test(sentence);
}

export const DID_NOT_CATCH: Record<string, string> = {
  en: "Sorry, I didn't catch that. Could you say it again?",
  'pt-BR': 'Desculpe, não entendi. Pode repetir?',
  'pt-PT': 'Desculpe, não percebi. Pode repetir?',
};

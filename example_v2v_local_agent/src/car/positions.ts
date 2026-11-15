// Windows and doors by place (2026-11-10, user): front_left / front_right / rear_left / rear_right, the relative driver / passenger
// (resolved from the car's steering-wheel side, never assumed), the sides front / rear / left / right, and all. Pure functions (the
// language is a parameter) so the replies can be tested without the app.

export type Pos = 'front_left' | 'front_right' | 'rear_left' | 'rear_right';
export type Target = Pos | 'all' | 'driver' | 'passenger' | 'front' | 'rear' | 'left' | 'right';
export type Steering = 'left' | 'right';
export type Lang = 'en' | 'pt-BR';
export type Obj = 'window' | 'door';

export const POSITIONS: Pos[] = ['front_left', 'front_right', 'rear_left', 'rear_right'];

/** The physical positions a target means in this car, or null for a value the car doesn't know. */
export function resolve(target: unknown, steering: Steering): Pos[] | null {
  const t = target === undefined || target === null || target === '' ? 'all' : String(target);
  const driver: Pos = steering === 'right' ? 'front_right' : 'front_left';
  const passenger: Pos = steering === 'right' ? 'front_left' : 'front_right';
  switch (t) {
    case 'all': return [...POSITIONS];
    case 'driver': return [driver];
    case 'passenger': return [passenger];
    case 'front': return ['front_left', 'front_right'];
    case 'rear': return ['rear_left', 'rear_right'];
    case 'left': return ['front_left', 'rear_left'];
    case 'right': return ['front_right', 'rear_right'];
    default: return (POSITIONS as string[]).includes(t) ? [t as Pos] : null;
  }
}

/** How the reply names it: the user's own words for the target (driver stays "the driver's window", not a place). */
export interface Name { text: string; plural: boolean; fem: boolean }

const EN_ONE: Record<string, string> = { driver: "the driver's", passenger: 'the passenger', front_left: 'the front left', front_right: 'the front right',
  rear_left: 'the rear left', rear_right: 'the rear right' };
const EN_MANY: Record<string, string> = { all: 'all the', front: 'the front', rear: 'the rear', left: 'the left', right: 'the right' };
const PT_PLACE: Record<string, [string, string]> = {   // [masc, fem]
  front_left: ['dianteiro esquerdo', 'dianteira esquerda'], front_right: ['dianteiro direito', 'dianteira direita'],
  rear_left: ['traseiro esquerdo', 'traseira esquerda'], rear_right: ['traseiro direito', 'traseira direita'] };
const PT_SIDE: Record<string, string> = { front: 'da frente', rear: 'de trás', left: 'do lado esquerdo', right: 'do lado direito' };

export function name(target: unknown, obj: Obj, lang: Lang): Name {
  const t = target === undefined || target === null || target === '' ? 'all' : String(target);
  const fem = lang === 'pt-BR' && obj === 'door';
  if (lang === 'en') {
    if (EN_MANY[t]) return { text: `${EN_MANY[t]} ${obj}s`, plural: true, fem };
    return { text: `${EN_ONE[t] ?? 'the'} ${obj}`, plural: false, fem };
  }
  const noun = obj === 'door' ? 'porta' : 'vidro';
  if (t === 'all') return { text: fem ? 'todas as portas' : 'todos os vidros', plural: true, fem };
  if (PT_SIDE[t]) return { text: `${fem ? 'as' : 'os'} ${noun}s ${PT_SIDE[t]}`, plural: true, fem };
  if (t === 'driver' || t === 'passenger') return { text: `${fem ? 'a' : 'o'} ${noun} do ${t === 'driver' ? 'motorista' : 'passageiro'}`, plural: false, fem };
  if (PT_PLACE[t]) return { text: `${fem ? 'a' : 'o'} ${noun} ${PT_PLACE[t][fem ? 1 : 0]}`, plural: false, fem };
  return { text: `${fem ? 'a' : 'o'} ${noun}`, plural: false, fem };
}

/** A position's own name (for "the front left door is locked"). */
export const placeName = (p: Pos, obj: Obj, lang: Lang): Name => name(p, obj, lang);

/** pt-BR adjective agreement: adj("fechad", n) -> fechado / fechada / fechados / fechadas. */
export const adj = (stem: string, n: Name) => stem + (n.fem ? 'a' : 'o') + (n.plural ? 's' : '');
export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** "is" / "are", "está" / "estão". */
export const be = (n: Name, lang: Lang) => (lang === 'en' ? (n.plural ? 'are' : 'is') : n.plural ? 'estão' : 'está');

// Emotion / style tags for voices that have style variants ("abilities").
// Speech.getVoiceAbilities(voice) lists a voice's abilities (e.g. "whisper",
// "military_sergeant_hard"); [] when it has none. To use one, put free text in
// square brackets before the words it applies to, until the next tag:
//   "[drill sergeant] Give me 50 push-ups! [regular] Thanks."
// Tags in Portuguese work too ("[sussurrando] ...", "[a sussurrar] ..."), and are never spoken.

import type { AppLanguage } from "../appflow";

export type VoiceStyleExample = {
  ability: string;
  label: string;
  text: string;
};

type ExampleText = { label: string; text: string };

// One example per known ability, per language. Every tag below is checked to
// select its own ability when the voice has all of them.
// Hebrew (TTS v1) voices have no styles, so it has no examples here.
const STYLE_EXAMPLES: Record<string, Partial<Record<AppLanguage, ExampleText>>> = {
  whisper: {
    en: {
      label: "Whisper",
      text: "[whispering confidentially] Quiet, this is a secret! Do not tell anyone!",
    },
    "pt-BR": {
      label: "Sussurro",
      text: "[sussurrando em segredo] Silêncio, isso é um segredo! Não conte para ninguém!",
    },
    "pt-PT": {
      label: "Sussurro",
      text: "[a sussurrar em segredo] Silêncio, isto é um segredo! Não contes a ninguém!",
    },
    de: {
      label: "Flüstern",
      text: "[vertraulich flüsternd] Leise, das ist ein Geheimnis! Sag es niemandem!",
    },
    es: {
      label: "Susurro",
      text: "[susurrando confidencialmente] Silencio, ¡esto es un secreto! ¡No se lo digas a nadie!",
    },
    fr: {
      label: "Murmure",
      text: "[murmurant confidentiellement] Chut, c’est un secret ! Ne le dis à personne !",
    },
    it: {
      label: "Sussurro",
      text: "[sussurrando in confidenza] Piano, è un segreto! Non dirlo a nessuno!",
    },
    nl: {
      label: "Fluisteren",
      text: "[vertrouwelijk fluisterend] Stil, dit is een geheim! Vertel het aan niemand!",
    },
  },
  soft_whisper: {
    en: {
      label: "Soft whisper",
      text: "[soft gentle whisper] Close your eyes and rest. Everything is going to be fine.",
    },
    "pt-BR": {
      label: "Sussurro suave",
      text: "[sussurro suave e terno] Feche os olhos e descanse. Vai ficar tudo bem.",
    },
    "pt-PT": {
      label: "Sussurro suave",
      text: "[sussurro suave e terno] Fecha os olhos e descansa. Vai correr tudo bem.",
    },
    de: {
      label: "Sanftes Flüstern",
      text: "[sanft und beruhigend flüsternd] Schließe die Augen und ruhe dich aus. Alles wird gut.",
    },
    es: {
      label: "Susurro suave",
      text: "[susurro suave y tierno] Cierra los ojos y descansa. Todo va a estar bien.",
    },
    fr: {
      label: "Murmure doux",
      text: "[murmure doux et tendre] Ferme les yeux et repose-toi. Tout va bien se passer.",
    },
    it: {
      label: "Sussurro dolce",
      text: "[sussurro dolce e tenero] Chiudi gli occhi e riposati. Andrà tutto bene.",
    },
    nl: {
      label: "Zacht gefluister",
      text: "[zacht en teder gefluister] Sluit je ogen en rust uit. Alles komt goed.",
    },
  },
  strong_whisper: {
    en: {
      label: "Strong whisper",
      text: "[strong urgent whisper] Get down, now! They are right behind the door!",
    },
    "pt-BR": {
      label: "Sussurro forte",
      text: "[sussurro forte e urgente] Abaixe agora! Eles estão atrás da porta!",
    },
    "pt-PT": {
      label: "Sussurro forte",
      text: "[sussurro forte e urgente] Baixa-te já! Eles estão atrás da porta!",
    },
    de: {
      label: "Kräftiges Flüstern",
      text: "[dringend und kräftig flüsternd] Runter, sofort! Sie sind direkt hinter der Tür!",
    },
    es: {
      label: "Susurro intenso",
      text: "[susurro fuerte y urgente] ¡Agáchate, ahora! ¡Están justo detrás de la puerta!",
    },
    fr: {
      label: "Murmure intense",
      text: "[murmure fort et urgent] Baisse-toi, tout de suite ! Ils sont juste derrière la porte !",
    },
    it: {
      label: "Sussurro intenso",
      text: "[sussurro forte e urgente] Abbassati, subito! Sono proprio dietro la porta!",
    },
    nl: {
      label: "Krachtig gefluister",
      text: "[krachtig en dringend gefluister] Duik weg, nu! Ze staan vlak achter de deur!",
    },
  },
  extremly_quiet_whisper: {
    en: {
      label: "Very quiet whisper",
      text: "[barely audible whisper] Shh... the baby is finally asleep.",
    },
    "pt-BR": {
      label: "Sussurro bem baixo",
      text: "[sussurro quase inaudível] Psiu... o bebê finalmente dormiu.",
    },
    "pt-PT": {
      label: "Sussurro muito baixo",
      text: "[sussurro quase inaudível] Chiu... o bebé finalmente adormeceu.",
    },
    de: {
      label: "Sehr leises Flüstern",
      text: "[kaum hörbares Flüstern] Psst ... das Baby schläft endlich.",
    },
    es: {
      label: "Susurro muy bajo",
      text: "[susurro casi inaudible] Shh... el bebé por fin se ha dormido.",
    },
    fr: {
      label: "Murmure très discret",
      text: "[murmure à peine audible] Chut... le bébé dort enfin.",
    },
    it: {
      label: "Sussurro molto piano",
      text: "[sussurro appena udibile] Shh... il bambino finalmente dorme.",
    },
    nl: {
      label: "Heel zacht gefluister",
      text: "[bijna onhoorbaar gefluister] Ssst... de baby slaapt eindelijk.",
    },
  },
  angry_whisper: {
    en: {
      label: "Angry whisper",
      text: "[angry whisper] I told you not to touch that. Put it back right now.",
    },
    "pt-BR": {
      label: "Sussurro bravo",
      text: "[sussurrando com raiva] Eu falei para não mexer nisso. Coloque de volta agora.",
    },
    "pt-PT": {
      label: "Sussurro zangado",
      text: "[a sussurrar com raiva] Eu disse-te para não mexeres nisso. Põe isso no sítio já.",
    },
    de: {
      label: "Wütendes Flüstern",
      text: "[wütend flüsternd] Ich habe dir gesagt, dass du das nicht anfassen sollst. Leg es sofort zurück.",
    },
    es: {
      label: "Susurro enfadado",
      text: "[susurrando con enfado] Te dije que no tocaras eso. Vuélvelo a poner ahora mismo.",
    },
    fr: {
      label: "Murmure furieux",
      text: "[murmurant avec colère] Je t’ai dit de ne pas toucher à ça. Remets-le tout de suite.",
    },
    it: {
      label: "Sussurro arrabbiato",
      text: "[sussurrando con rabbia] Ti ho detto di non toccarlo. Rimettilo subito a posto.",
    },
    nl: {
      label: "Boos gefluister",
      text: "[boos fluisterend] Ik zei dat je dat niet mocht aanraken. Leg het onmiddellijk terug.",
    },
  },
  happy_laughing: {
    en: {
      label: "Happy",
      text: "[happy and enjoying life] What a funny joke! I could not stop laughing.",
    },
    "pt-BR": {
      label: "Feliz",
      text: "[feliz e sorrindo] Que piada engraçada! Eu não consegui parar de rir.",
    },
    "pt-PT": {
      label: "Feliz",
      text: "[feliz e a sorrir] Que piada tão engraçada! Não consegui parar de rir.",
    },
    de: {
      label: "Fröhlich",
      text: "[fröhlich und lebensfroh] Was für ein lustiger Witz! Ich musste einfach lachen.",
    },
    es: {
      label: "Feliz",
      text: "[alegre y disfrutando de la vida] ¡Qué chiste tan gracioso! No podía parar de reírme.",
    },
    fr: {
      label: "Joyeux",
      text: "[joyeux et plein de vie] Quelle blague amusante ! Je n’arrivais plus à m’arrêter de rire.",
    },
    it: {
      label: "Felice",
      text: "[felice e pieno di gioia] Che battuta divertente! Non riuscivo a smettere di ridere.",
    },
    nl: {
      label: "Vrolijk",
      text: "[vrolijk en levenslustig] Wat een grappige grap! Ik kon niet ophouden met lachen.",
    },
  },
  strong_happy_laughing: {
    en: {
      label: "Laughing hard",
      text: "[laughing hysterically] Oh no, you did not just say that! That is hilarious!",
    },
    "pt-BR": {
      label: "Gargalhada",
      text: "[gargalhando histericamente] Não acredito que você disse isso! Que hilário!",
    },
    "pt-PT": {
      label: "Gargalhada",
      text: "[às gargalhadas histéricas] Não acredito que disseste isso! Que hilariante!",
    },
    de: {
      label: "Hysterisches Lachen",
      text: "[hysterisch lachend] Oh nein, das hast du jetzt nicht wirklich gesagt! Das ist ja unglaublich lustig!",
    },
    es: {
      label: "Risa descontrolada",
      text: "[riendo histéricamente] ¡No puede ser, no acabas de decir eso! ¡Es divertidísimo!",
    },
    fr: {
      label: "Rire aux éclats",
      text: "[riant aux éclats] Oh non, tu n’as pas vraiment dit ça ! C’est hilarant !",
    },
    it: {
      label: "Risata sfrenata",
      text: "[ridendo istericamente] Oh no, non puoi averlo detto davvero! È esilarante!",
    },
    nl: {
      label: "Hysterisch lachen",
      text: "[hysterisch lachend] O nee, dat heb je toch niet echt gezegd! Dat is hilarisch!",
    },
  },
  motivating: {
    en: {
      label: "Motivating",
      text: "[motivating coach] You are stronger than you think. One more step, you can do it!",
    },
    "pt-BR": {
      label: "Motivador",
      text: "[treinador motivador] Você é mais forte do que imagina. Só mais um passo, você consegue!",
    },
    "pt-PT": {
      label: "Motivador",
      text: "[treinador motivador] És mais forte do que imaginas. Só mais um passo, tu consegues!",
    },
    de: {
      label: "Motivierend",
      text: "[motivierender Coach] Du bist stärker, als du denkst. Noch ein Schritt, du schaffst das!",
    },
    es: {
      label: "Motivador",
      text: "[entrenador motivador] Eres más fuerte de lo que crees. ¡Un paso más, tú puedes!",
    },
    fr: {
      label: "Motivant",
      text: "[coach motivant] Tu es plus fort que tu ne le penses. Encore un pas, tu peux y arriver !",
    },
    it: {
      label: "Motivante",
      text: "[allenatore motivante] Sei più forte di quanto pensi. Ancora un passo, ce la puoi fare!",
    },
    nl: {
      label: "Motiverend",
      text: "[motiverende coach] Je bent sterker dan je denkt. Nog één stap, je kunt het!",
    },
  },
  shouting_encouraging: {
    en: {
      label: "Shouting encouragement",
      text: "[shouting encouragement] Come on! Faster! You are almost there!",
    },
    "pt-BR": {
      label: "Gritando incentivo",
      text: "[gritando e encorajando] Vamos lá! Mais rápido! Você está quase lá!",
    },
    "pt-PT": {
      label: "Grito de incentivo",
      text: "[a gritar e a encorajar] Vamos lá! Mais depressa! Estás quase lá!",
    },
    de: {
      label: "Lauter Ansporn",
      text: "[laut anfeuernd] Los! Schneller! Du bist fast da!",
    },
    es: {
      label: "Grito de ánimo",
      text: "[gritando para animar] ¡Vamos! ¡Más rápido! ¡Ya casi llegas!",
    },
    fr: {
      label: "Encouragement crié",
      text: "[criant des encouragements] Allez ! Plus vite ! Tu y es presque !",
    },
    it: {
      label: "Incoraggiamento urlato",
      text: "[incoraggiando a gran voce] Forza! Più veloce! Ci sei quasi!",
    },
    nl: {
      label: "Luid aanmoedigen",
      text: "[luid aanmoedigend] Kom op! Sneller! Je bent er bijna!",
    },
  },
  disappointed: {
    en: {
      label: "Disappointed",
      text: "[disappointed and sad] I really thought you would come today. Oh well.",
    },
    "pt-BR": {
      label: "Decepcionado",
      text: "[decepcionado e triste] Eu realmente achei que você viria hoje. Que pena.",
    },
    "pt-PT": {
      label: "Desiludido",
      text: "[desiludido e triste] Pensei mesmo que vinhas hoje. Que pena.",
    },
    de: {
      label: "Enttäuscht",
      text: "[enttäuscht und traurig] Ich dachte wirklich, dass du heute kommst. Na ja.",
    },
    es: {
      label: "Decepcionado",
      text: "[decepcionado y triste] De verdad pensé que vendrías hoy. En fin.",
    },
    fr: {
      label: "Déçu",
      text: "[déçu et triste] Je pensais vraiment que tu viendrais aujourd’hui. Tant pis.",
    },
    it: {
      label: "Deluso",
      text: "[deluso e triste] Pensavo davvero che saresti venuto oggi. Pazienza.",
    },
    nl: {
      label: "Teleurgesteld",
      text: "[teleurgesteld en verdrietig] Ik dacht echt dat je vandaag zou komen. Jammer dan.",
    },
  },
  military_sergeant_hard: {
    en: {
      label: "Drill sergeant",
      text: "[drill sergeant] Get down and give me 50 push-ups!",
    },
    "pt-BR": {
      label: "Sargento",
      text: "[sargento militar durão] Ao chão e faça cinquenta flexões!",
    },
    "pt-PT": {
      label: "Sargento",
      text: "[sargento militar duro] Para o chão e faz cinquenta flexões!",
    },
    de: {
      label: "Drill-Sergeant",
      text: "[harter Drill-Sergeant] Auf den Boden und 50 Liegestütze, sofort!",
    },
    es: {
      label: "Sargento instructor",
      text: "[sargento instructor] ¡Al suelo y haz 50 flexiones!",
    },
    fr: {
      label: "Sergent instructeur",
      text: "[sergent instructeur] À terre, et fais 50 pompes !",
    },
    it: {
      label: "Sergente istruttore",
      text: "[sergente istruttore] A terra, e fai 50 flessioni!",
    },
    nl: {
      label: "Drillinstructeur",
      text: "[drillinstructeur] Naar de grond en doe vijftig keer opdrukken!",
    },
  },
  military_sergeant_soft: {
    en: {
      label: "Friendly sergeant",
      text: "[friendly army sergeant] Good work, soldier. Take five and drink some water.",
    },
    "pt-BR": {
      label: "Sargento gentil",
      text: "[sargento do exército gentil] Bom trabalho, soldado. Descanse um pouco e beba água.",
    },
    "pt-PT": {
      label: "Sargento gentil",
      text: "[sargento do exército gentil] Bom trabalho, soldado. Descansa um pouco e bebe água.",
    },
    de: {
      label: "Freundlicher Feldwebel",
      text: "[freundlicher Feldwebel] Gute Arbeit, Soldat. Ruh dich fünf Minuten aus und trink etwas Wasser.",
    },
    es: {
      label: "Sargento amable",
      text: "[sargento amable] Buen trabajo, soldado. Descansa cinco minutos y bebe agua.",
    },
    fr: {
      label: "Sergent bienveillant",
      text: "[sergent bienveillant] Beau travail, soldat. Repose-toi cinq minutes et bois un peu d’eau.",
    },
    it: {
      label: "Sergente gentile",
      text: "[sergente gentile] Ottimo lavoro, soldato. Riposati cinque minuti e bevi un po’ d’acqua.",
    },
    nl: {
      label: "Vriendelijke sergeant",
      text: "[vriendelijke sergeant] Goed gedaan, soldaat. Neem vijf minuten rust en drink wat water.",
    },
  },
};

// An ability without a written example: its own name works as the tag.
function genericExample(ability: string, language: AppLanguage): ExampleText {
  const words = ability.replace(/_/g, " ").trim();
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  const textByLanguage: Record<AppLanguage, string> = {
    en: `[${words}] Hello! This is my voice in this style.`,
    "pt-BR": `[${words}] Olá! Esta é a minha voz com este estilo.`,
    "pt-PT": `[${words}] Olá! Esta é a minha voz com este estilo.`,
    de: `[${words}] Hallo! So klingt meine Stimme in diesem Stil.`,
    es: `[${words}] ¡Hola! Así suena mi voz con este estilo.`,
    fr: `[${words}] Bonjour ! Voici ma voix avec ce style.`,
    it: `[${words}] Ciao! Questa è la mia voce con questo stile.`,
    nl: `[${words}] Hallo! Zo klinkt mijn stem in deze stijl.`,
    he: `[${words}] שלום! ככה נשמע הקול שלי בסגנון הזה.`,
    da: `[${words}] Hej! Sådan lyder min stemme i denne stil.`,
    sv: `[${words}] Hej! Så här låter min röst i den här stilen.`,
    el: `[${words}] Γεια σας! Έτσι ακούγεται η φωνή μου σε αυτό το ύφος.`,
  };
  return { label, text: textByLanguage[language] };
}

// Shown first, in this order; the other abilities follow in the voice's order.
const FIRST_ABILITIES = ["military_sergeant_hard", "whisper"];
// Shown last.
const LAST_ABILITIES = ["disappointed"];
// Abilities without examples in a language.
const HIDDEN_ABILITIES: Record<AppLanguage, string[]> = {
  en: [],
  "pt-BR": [],
  "pt-PT": [],
  de: [],
  es: [],
  fr: [],
  it: [],
  nl: [],
  he: [],
  da: [],
  sv: [],
  el: [],
};

function abilityRank(ability: string): number {
  const name = ability.toLowerCase();
  if (FIRST_ABILITIES.includes(name))
    return FIRST_ABILITIES.indexOf(name) - FIRST_ABILITIES.length;
  return LAST_ABILITIES.includes(name) ? 1 + LAST_ABILITIES.indexOf(name) : 0;
}

/** One example per ability of the voice, in the app's language. */
export function voiceStyleExamples(
  abilities: string[],
  language: AppLanguage
): VoiceStyleExample[] {
  return abilities
    .filter(
      (ability) => !HIDDEN_ABILITIES[language].includes(ability.toLowerCase())
    )
    .map((ability, index) => ({ ability, index }))
    .sort(
      (a, b) =>
        abilityRank(a.ability) - abilityRank(b.ability) || a.index - b.index
    )
    .map(({ ability }) => {
      const example =
        STYLE_EXAMPLES[ability.toLowerCase()]?.[language] ??
        genericExample(ability, language);
      return { ability, ...example };
    });
}

/** The abilities of each voice (voices without any are left out). */
export async function loadVoiceAbilities(
  Speech: { getVoiceAbilities?: (name: string) => Promise<string[]> },
  voices: string[]
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (typeof Speech.getVoiceAbilities !== "function") return result;
  for (const voice of voices) {
    try {
      const abilities = await Speech.getVoiceAbilities(voice);
      if (abilities.length > 0) result[voice] = abilities;
    } catch {
      // A voice that can't be queried is listed without styles.
    }
  }
  return result;
}

export const STYLE_TAG_HINT: Record<AppLanguage, string> = {
  en: "Put a tag in square brackets before the words it applies to, e.g. [happy] Hello! or [whispering] Listen. [regular] goes back to the normal voice.",
  "pt-BR":
    "Coloque uma etiqueta entre colchetes antes das palavras, por exemplo [feliz] Olá! ou [sussurrando] Escute. [normal] volta à voz normal.",
  "pt-PT":
    "Coloca uma etiqueta entre parênteses retos antes das palavras, por exemplo [feliz] Olá! ou [a sussurrar] Ouve. [normal] volta à voz normal.",
  de: "Setze ein Tag in eckigen Klammern vor die Wörter, zum Beispiel [fröhlich] Hallo! Mit [normal] kehrst du zur normalen Stimme zurück.",
  es: "Pon una etiqueta entre corchetes antes de las palabras, por ejemplo [feliz] ¡Hola! [normal] vuelve a la voz normal.",
  fr: "Placez une balise entre crochets avant les mots, par exemple [joyeux] Bonjour ! [normal] revient à la voix normale.",
  it: "Inserisci un tag tra parentesi quadre prima delle parole, ad esempio [felice] Ciao! [normale] torna alla voce normale.",
  nl: "Zet een tag tussen vierkante haakjes voor de woorden, bijvoorbeeld [vrolijk] Hallo! [normaal] keert terug naar de normale stem.",
  he: "שימו תגית בסוגריים מרובעים לפני המילים, למשל [happy] שלום! [regular] מחזיר לקול הרגיל.",
  da: "Sæt et mærke i firkantede parenteser foran ordene, f.eks. [happy] Hej! [regular] går tilbage til den normale stemme.",
  sv: "Sätt en tagg inom hakparenteser före orden, t.ex. [happy] Hej! [regular] återgår till den vanliga rösten.",
  el: "Βάλτε μια ετικέτα σε αγκύλες πριν από τις λέξεις, π.χ. [happy] Γεια σας! Το [regular] επαναφέρει την κανονική φωνή.",
};

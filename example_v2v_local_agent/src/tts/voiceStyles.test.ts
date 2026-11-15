import { voiceStyleExamples } from "./voiceStyles";

const LANGUAGES = ["en", "pt-BR", "pt-PT", "de", "es", "fr", "it", "nl", "he", "da", "sv", "el"] as const;
const KNOWN_ABILITIES = [
  "military_sergeant_hard",
  "whisper",
  "soft_whisper",
  "strong_whisper",
  "extremly_quiet_whisper",
  "angry_whisper",
  "happy_laughing",
  "strong_happy_laughing",
  "motivating",
  "shouting_encouraging",
  "disappointed",
];

describe("voice style examples", () => {
  it.each(LANGUAGES)("has every known style in %s", (language) => {
    const examples = voiceStyleExamples(KNOWN_ABILITIES, language);

    expect(examples).toHaveLength(KNOWN_ABILITIES.length);
    expect(examples.map(({ ability }) => ability).sort()).toEqual(
      [...KNOWN_ABILITIES].sort()
    );

    for (const example of examples) {
      expect(example.label).not.toHaveLength(0);
      expect(example.text).toMatch(/^\[[^\]]+\] .+/);
      expect(example.text).not.toContain("_");
    }
  });
});

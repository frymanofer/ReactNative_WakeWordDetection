// local_llm.md Stage 7 — deterministic command layer. Checked before any
// utterance reaches the LLM provider; known commands execute instantly
// without touching the model. Unchanged from the plan's sketch.

export type LocalLLMCommand = 'PAUSE' | 'RESUME' | 'REPEAT' | 'ADJUST';

interface CommandRule {
  patterns: RegExp[];
  handler: LocalLLMCommand;
}

const COMMANDS: CommandRule[] = [
  { patterns: [/^(pause|stop|quiet)$/i], handler: 'PAUSE' },
  { patterns: [/^(continue|resume|go)$/i], handler: 'RESUME' },
  { patterns: [/^repeat that$/i], handler: 'REPEAT' },
  { patterns: [/^(louder|quieter|faster|slower)$/i], handler: 'ADJUST' },
];

export function matchCommand(text: string): LocalLLMCommand | null {
  const trimmed = text.trim();
  for (const rule of COMMANDS) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return rule.handler;
    }
  }
  return null;
}

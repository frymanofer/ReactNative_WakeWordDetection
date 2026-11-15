import type { ChatTemplate } from './types';

// Presets for the common chat-template families. A model's GGUF page on
// Hugging Face (or its tokenizer_config.json "chat_template") says which one
// it was trained on. Users adding a custom model pick one of these, or edit
// the fields directly when none fits.

export type ChatTemplatePresetId = 'gemma' | 'chatml' | 'qwen3' | 'llama3' | 'phi3';

export interface ChatTemplatePreset {
  id: ChatTemplatePresetId;
  label: string;
  /** Which model families use it, shown in the picker. */
  usedBy: string;
  template: ChatTemplate;
}

export const CHAT_TEMPLATE_PRESETS: Record<ChatTemplatePresetId, ChatTemplatePreset> = {
  gemma: {
    id: 'gemma',
    label: 'Gemma',
    usedBy: 'Gemma 2 / 3 / 3n',
    template: {
      // Gemma has no system role; its official template folds the system
      // prompt into the first user turn.
      systemPrefix: '',
      userPrefix: '<start_of_turn>user\n',
      assistantPrefix: '<start_of_turn>model\n',
      turnSuffix: '<end_of_turn>\n',
      systemMode: 'merge-into-first-user',
      stopSequences: ['<end_of_turn>'],
    },
  },
  chatml: {
    id: 'chatml',
    label: 'ChatML',
    usedBy: 'Qwen 2 / 2.5, SmolLM2, Hermes',
    template: {
      systemPrefix: '<|im_start|>system\n',
      userPrefix: '<|im_start|>user\n',
      assistantPrefix: '<|im_start|>assistant\n',
      turnSuffix: '<|im_end|>\n',
      systemMode: 'role',
      stopSequences: ['<|im_end|>'],
    },
  },
  qwen3: {
    id: 'qwen3',
    label: 'Qwen3',
    usedBy: 'Qwen3, DaVoice Agent',
    template: {
      // ChatML with thinking off, as Qwen3's own template renders it
      // (enable_thinking false): the reply opens with an empty think block.
      systemPrefix: '<|im_start|>system\n',
      userPrefix: '<|im_start|>user\n',
      assistantPrefix: '<|im_start|>assistant\n',
      turnSuffix: '<|im_end|>\n',
      systemMode: 'role',
      stopSequences: ['<|im_end|>'],
      generationPrefix: '<think>\n\n</think>\n\n',
      spacedToolJson: true,
    },
  },
  llama3: {
    id: 'llama3',
    label: 'Llama 3',
    usedBy: 'Llama 3 / 3.1 / 3.2',
    template: {
      systemPrefix: '<|start_header_id|>system<|end_header_id|>\n\n',
      userPrefix: '<|start_header_id|>user<|end_header_id|>\n\n',
      assistantPrefix: '<|start_header_id|>assistant<|end_header_id|>\n\n',
      turnSuffix: '<|eot_id|>',
      systemMode: 'role',
      stopSequences: ['<|eot_id|>'],
    },
  },
  phi3: {
    id: 'phi3',
    label: 'Phi-3',
    usedBy: 'Phi-3 / 3.5',
    template: {
      systemPrefix: '<|system|>\n',
      userPrefix: '<|user|>\n',
      assistantPrefix: '<|assistant|>\n',
      turnSuffix: '<|end|>\n',
      systemMode: 'role',
      stopSequences: ['<|end|>'],
    },
  },
};

/** The preset `template` matches exactly, if any — lets the UI show a
 * custom model's template by name instead of as raw fields. */
export function findMatchingPreset(template: ChatTemplate): ChatTemplatePresetId | null {
  for (const preset of Object.values(CHAT_TEMPLATE_PRESETS)) {
    const t = preset.template;
    if (
      t.systemPrefix === template.systemPrefix &&
      t.userPrefix === template.userPrefix &&
      t.assistantPrefix === template.assistantPrefix &&
      t.turnSuffix === template.turnSuffix &&
      t.systemMode === template.systemMode &&
      t.stopSequences.join('\u0000') === template.stopSequences.join('\u0000') &&
      (t.generationPrefix ?? '') === (template.generationPrefix ?? '') &&
      !!t.spacedToolJson === !!template.spacedToolJson
    ) {
      return preset.id;
    }
  }
  return null;
}

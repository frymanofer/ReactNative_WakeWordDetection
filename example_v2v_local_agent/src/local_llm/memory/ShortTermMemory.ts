import type { ChatMessage } from '../types';

/**
 * Bounded in-RAM ring buffer of the current conversation's turns. Real
 * implementation (not a stub) — this is cheap and needed regardless of
 * whether the LLM inference underneath it works yet.
 *
 * Intentionally NOT wired into src/aichat/index.ts's existing history array
 * in this pass — that file keeps its own history today
 * (`AIChatHistoryMessage[]`) and swapping it to delegate to this class is
 * app-flow work (Stage 6, deferred). When that happens, this class should
 * become the canonical turn buffer and aichat/index.ts should read from it,
 * not duplicate it.
 */
export class ShortTermMemory {
  private turns: ChatMessage[] = [];

  constructor(private readonly maxTurns: number = 40) {}

  push(message: ChatMessage): void {
    this.turns.push(message);
    if (this.turns.length > this.maxTurns) {
      this.turns.splice(0, this.turns.length - this.maxTurns);
    }
  }

  getRecent(maxTurns: number = this.maxTurns): ChatMessage[] {
    if (maxTurns >= this.turns.length) return [...this.turns];
    return this.turns.slice(this.turns.length - maxTurns);
  }

  clear(): void {
    this.turns = [];
  }
}

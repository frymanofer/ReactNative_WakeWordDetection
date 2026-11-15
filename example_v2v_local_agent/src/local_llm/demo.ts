// The two Local AI Chat demos (2026-11-10): each loads its own agent pack (system prompt + skills), tool registry, card and model.
//   calories  DaVoice Personal Agent: the calorie tracker skill + memory, no car tools (agent/)
//   car       DaVoice Automotive Agent: the simulated VW car's tools, no calorie skill (agent_automotive/, the pack the automotive
//             model is trained with)
// The choice is persisted with the model registry; this module holds the current value for synchronous readers (LocalAgent).
export type LocalDemo = 'calories' | 'car';

let current: LocalDemo = 'car';

export function currentLocalDemo(): LocalDemo {
  return current;
}

export function setCurrentLocalDemo(demo: LocalDemo): void {
  current = demo;
}

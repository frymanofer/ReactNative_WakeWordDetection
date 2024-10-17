import { createMachine, assign } from 'xstate';

// Define the context type, which includes the state stack
interface StateMachineContext {
  stateStack: string[];  // Array to keep track of state history
}

// Define event types that will be used to transition between states
interface EventSchema {
  type: 'TO_STATE2_1' | 'TO_STATE2_2' | 'TO_STATE3_1' | 'TO_STATE3_2' | 'BACK';  // All event types the state machine will handle
}

// Create the state machine using createMachine (replaces Machine in v5)
export const stateMachine = createMachine<StateMachineContext, EventSchema>({
  id: 'appState',
  initial: 'state1',
  context: {
    stateStack: [] // Stack to store the history of states
  },
  states: {
    state1: {
      on: {
        TO_STATE2_1: { target: 'state2_1', actions: 'pushStateToStack' },
        TO_STATE2_2: { target: 'state2_2', actions: 'pushStateToStack' }
      }
    },
    state2_1: {
      on: {
        TO_STATE3_1: { target: 'state3_1', actions: 'pushStateToStack' },
        BACK: { target: 'state1', actions: 'popStateFromStack' }
      }
    },
    state2_2: {
      on: {
        TO_STATE3_2: { target: 'state3_2', actions: 'pushStateToStack' },
        BACK: { target: 'state1', actions: 'popStateFromStack' }
      }
    },
    state3_1: {
      on: {
        BACK: { target: 'state2_1', actions: 'popStateFromStack' }
      }
    },
    state3_2: {
      on: {
        BACK: { target: 'state2_2', actions: 'popStateFromStack' }
      }
    }
  }
}, {
  actions: {
    // Action to push the current state to the stack using assign
    pushStateToStack: assign({
      stateStack: ({ stateStack }, event) => [...stateStack, event.type] // Push the event (state transition) onto the stack
    }),
    // Action to pop the last state from the stack using assign
    popStateFromStack: assign({
      stateStack: ({ stateStack }) => stateStack.slice(0, -1) // Remove the last state from the stack
    })
  }
});

// Undo (core 2026-11-14, configure "undo"): every state-changing car call returns the calls that put the car back exactly as it
// was (the recorded state, not "the opposite action"); actions without a way back return undo: false; lookups and "already" return
// none. Running the returned calls (as the agent does on "desfaz") restores the previous state; an undo never unlocks while driving.

let mockLang = 'en';
jest.mock('../src/tts', () => ({ getTTSLanguage: () => mockLang }));
jest.mock('react-native-davoice-llm', () => ({ toolReply: (result: any, say: string) => ({ result, say }) }));

import { carTools, setCarUndoResults } from '../src/car/carTools';
import { getCarState, resetCar, setDriving, setSteering } from '../src/car/CarState';

const tools = () => Object.fromEntries(carTools('vw_demo', 'h3d').map((t: any) => [t.name, t]));
const run = (name: string, args: Record<string, unknown>, context: Record<string, unknown> = {}) =>
  (tools()[name] as any).handler(args, context) as { result: any; say: string };
/** what the agent does on "desfaz": the recorded calls, with context.undo */
const undo = (u: any) => u.calls.map((c: any) => run(c.name, c.arguments, { undo: true }));

beforeEach(() => {
  resetCar();
  setDriving(false);
  setSteering('left');
  mockLang = 'en';
  setCarUndoResults(true);
});

test('volume: back to the recorded level (12 -> 15 -> 12), not "down by 3"', () => {
  run('set_volume', { action: 'set', level: 20 });
  const r = run('set_volume', { action: 'up' });
  expect(getCarState().volume).toBe(23);
  expect(r.result.undo.calls).toEqual([{ name: 'set_volume', arguments: { action: 'set', level: 20 } }]);
  const said = undo(r.result.undo);
  expect(getCarState().volume).toBe(20);
  expect(said[0].say).toMatch(/^Undone\. /);
});

test('mute is undone by unmute; a level change while muted comes back muted', () => {
  const r = run('set_volume', { action: 'mute' });
  expect(r.result.undo.calls).toEqual([{ name: 'set_volume', arguments: { action: 'unmute' } }]);
  undo(r.result.undo);
  expect(getCarState().muted).toBe(false);
});

test('windows: each window back to its own position', () => {
  run('set_window', { window: 'front_left', position: 'half' });
  const before = getCarState().windows;
  const r = run('set_window', { window: 'all', position: 'open' });
  undo(r.result.undo);
  expect(getCarState().windows).toEqual(before);
});

test('dual-zone temperature and comfort_feeling (several parts of the car) are restored', () => {
  run('set_dual_zone_temperature', { driver: 19, passenger: 24 });
  const before = { t: getCarState().temperature, h: getCarState().seatHeater, v: getCarState().seatVentilation };
  const r = run('comfort_feeling', { feeling: 'hot' });
  undo(r.result.undo);
  expect({ t: getCarState().temperature, h: getCarState().seatHeater, v: getCarState().seatVentilation }).toEqual(before);
});

test('locks: undo of a lock unlocks only when parked (vehicle policy)', () => {
  const r = run('lock_car', { door: 'all' });
  expect(r.result.undo.calls).toEqual([{ name: 'unlock_car', arguments: { door: 'all' } }]);
  setDriving(true);
  const said = undo(r.result.undo);
  expect(getCarState().locked).toBe(true);
  expect(said[0].result.ok).toBe(false);
  setDriving(false);
  undo(r.result.undo);
  expect(getCarState().locked).toBe(false);
});

test('seat climate, fan, airflow, defrost, sunroof', () => {
  for (const [name, args] of [['set_seat_climate', { seat: 'passenger', feature: 'heater', level: 'high' }], ['set_fan_speed', { level: 6 }],
    ['set_airflow', { mode: 'feet' }], ['set_defrost', { target: 'rear', on: true }], ['set_sunroof', { action: 'tilt' }]] as const) {
    const before = JSON.stringify(getCarState());
    const r = run(name, args as any);
    expect(r.result.undo).toBeTruthy();
    undo(r.result.undo);
    expect(JSON.stringify(getCarState())).toBe(before);
  }
});

test('no way back: navigation is undo false; lookups and "already" carry no undo', () => {
  expect(run('navigate_to', { destination: 'Ibirapuera' }).result.undo).toBe(false);
  expect(run('get_trip_eta', {}).result.undo).toBeUndefined();
  expect(run('set_window', { window: 'all', position: 'close' }).result.undo).toBeUndefined();   // already closed
});

test('off unless the provider enables it (an older core would show it to the model)', () => {
  setCarUndoResults(false);
  expect(run('set_volume', { action: 'up' }).result.undo).toBeUndefined();
});

test('pt-BR undo sentence', () => {
  mockLang = 'pt-BR';
  const r = run('set_fan_speed', { level: 5 });
  expect(undo(r.result.undo)[0].say).toMatch(/^Desfeito\. Coloquei a ventilação no nível 3\./);
});

test('a refused state-changing call is still the last action: ok false + undo false (core g29zk); nothing changed', () => {
  const before = JSON.stringify(getCarState());
  const r = run('set_temperature', { temperature: 99 });
  expect(r.result.ok).toBe(false);
  expect(r.result.undo).toBe(false);
  expect(JSON.stringify(getCarState())).toBe(before);
  setCarUndoResults(false);
  expect(run('set_temperature', { temperature: 99 }).result.undo).toBeUndefined();   // undo off: nothing extra for older cores
});

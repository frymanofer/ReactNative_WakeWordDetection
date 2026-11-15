// Undo for the simulated car (core 2026-11-14, configure "undo"): every state-changing car call returns, next to its result,
// how to put the car back exactly as it was before the call: {"undo": {"calls": [...], "previous": {...}}}, or {"undo": false}
// when that can't be done (a new destination, a radio station, a message). The agent keeps it (never shows it to the model) and,
// when the user says "desfaz" / "undo that", runs those calls through these same tools, so every check still applies
// (driving, ranges). The calls restore the recorded state; they are not "the opposite action" (a volume that went 12 -> 15 goes
// back to 12, not down by 3).

import type { CarState } from './CarState';
import type { Pos } from './positions';

export type RestoreCall = { name: string; arguments: Record<string, unknown> };

const POS: Pos[] = ['front_left', 'front_right', 'rear_left', 'rear_right'];
const SEATS = ['driver', 'passenger', 'rear_left', 'rear_right'] as const;

/** One call per position that changed, or one for all four when they all go back to the same value. */
function perPosition<T>(before: Record<Pos, T>, after: Record<Pos, T>, call: (target: string, value: T) => RestoreCall): RestoreCall[] {
  const changed = POS.filter((p) => before[p] !== after[p]);
  if (changed.length === 0) return [];
  if (changed.length === 4 && POS.every((p) => before[p] === before.front_left)) return [call('all', before.front_left)];
  return changed.map((p) => call(p, before[p]));
}

/** What changed between two states, as the calls that restore `before`; false: something changed that can't be restored. */
export function restoreCalls(before: CarState, after: CarState): { calls: RestoreCall[]; previous: Record<string, unknown> } | false | undefined {
  const calls: RestoreCall[] = [];
  const previous: Record<string, unknown> = {};
  let irreversible = false;
  const changed = (k: keyof CarState) => JSON.stringify(before[k]) !== JSON.stringify(after[k]);

  if (changed('temperature')) {
    previous.temperature = before.temperature;
    const t = before.temperature;
    if (t.driver === t.passenger && t.passenger === t.rear) {
      calls.push({ name: 'set_temperature', arguments: { temperature: t.driver, unit: t.unit } });
    } else {
      if (t.driver !== after.temperature.driver || t.passenger !== after.temperature.passenger || t.unit !== after.temperature.unit) {
        calls.push({ name: 'set_dual_zone_temperature', arguments: { driver: t.driver, passenger: t.passenger, unit: t.unit } });
      }
      if (t.rear !== after.temperature.rear) calls.push({ name: 'set_temperature', arguments: { temperature: t.rear, zone: 'rear', unit: t.unit } });
    }
  }
  if (changed('fan')) { previous.fan = before.fan; calls.push({ name: 'set_fan_speed', arguments: { level: before.fan } }); }
  if (changed('airflow')) { previous.airflow = before.airflow; calls.push({ name: 'set_airflow', arguments: { mode: before.airflow } }); }
  if (changed('defrost')) {
    previous.defrost = before.defrost;
    (['windshield', 'rear'] as const).forEach((target) => {
      if (before.defrost[target] !== after.defrost[target]) calls.push({ name: 'set_defrost', arguments: { target, on: before.defrost[target] } });
    });
  }
  if (changed('windows')) {
    previous.windows = before.windows;
    calls.push(...perPosition(before.windows, after.windows, (window, position) => ({ name: 'set_window', arguments: { window, position } })));
  }
  if (changed('doors')) {
    previous.doors = before.doors;
    calls.push(...perPosition(before.doors, after.doors, (door, v) => ({ name: v === 'open' ? 'open_door' : 'close_doors', arguments: { door } })));
  }
  if (changed('doorLocks')) {
    previous.doorLocks = before.doorLocks;
    calls.push(...perPosition(before.doorLocks, after.doorLocks, (door, locked) => ({ name: locked ? 'lock_car' : 'unlock_car', arguments: { door } })));
  }
  if (changed('sunroof')) { previous.sunroof = before.sunroof; calls.push({ name: 'set_sunroof', arguments: { action: before.sunroof } }); }
  if (changed('sunshade')) { previous.sunshade = before.sunshade; calls.push({ name: 'set_sunshade', arguments: { action: before.sunshade } }); }
  (['seatHeater', 'seatVentilation'] as const).forEach((k) => {
    if (!changed(k)) return;
    previous[k] = before[k];
    SEATS.forEach((seat) => {
      if (before[k][seat] !== after[k][seat]) {
        calls.push({ name: 'set_seat_climate', arguments: { seat, feature: k === 'seatHeater' ? 'heater' : 'ventilation', level: before[k][seat] } });
      }
    });
  });
  if (changed('volume') || changed('muted')) {
    previous.volume = before.volume;
    previous.muted = before.muted;
    if (before.volume !== after.volume) calls.push({ name: 'set_volume', arguments: { action: 'set', level: before.volume } });
    if (before.muted && (!after.muted || before.volume !== after.volume)) calls.push({ name: 'set_volume', arguments: { action: 'mute' } });
    else if (!before.muted && after.muted) calls.push({ name: 'set_volume', arguments: { action: 'unmute' } });
  }
  if (changed('wheelHeater')) { previous.wheelHeater = before.wheelHeater; calls.push({ name: 'set_steering_wheel_heater', arguments: { on: before.wheelHeater } }); }
  // No way back here (no "cancel the route" / "previous station" tool in the demo): the user hears that it can't be undone.
  (['destination', 'avoid', 'radio', 'media', 'source', 'audioFocus', 'call', 'scenario', 'trunk', 'frunk', 'chargePort', 'screen', 'massage',
    'ambient', 'readingLights'] as const).forEach((k) => { if (changed(k)) irreversible = true; });
  if (irreversible) return false;
  if (calls.length === 0) return undefined;
  return { calls, previous };
}

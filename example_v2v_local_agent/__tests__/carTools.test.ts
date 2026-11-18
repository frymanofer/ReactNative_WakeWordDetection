// Confirmed action replies of the simulated car (2026-11-10): success, already in that state, blocked / failed, unsupported, in English
// and Brazilian Portuguese; positions by place, driver / passenger from the steering-wheel side; the dual-zone tool. Nothing here
// claims an action the handler did not do.

let mockLang = 'en';
jest.mock('../src/tts', () => ({ getTTSLanguage: () => mockLang }));
jest.mock('react-native-davoice-llm', () => ({ toolReply: (result: any, say: string) => ({ result, say }) }));

import { carTools } from '../src/car/carTools';
import { getCarState, resetCar, setDriving, setSteering } from '../src/car/CarState';

const tools = () => Object.fromEntries(carTools('vw_demo', 'h3').map((t: any) => [t.name, t]));
const run = (name: string, args: Record<string, unknown>) => (tools()[name] as any).handler(args) as { result: any; say: string };
const say = (name: string, args: Record<string, unknown>) => run(name, args).say;

beforeEach(() => {
  resetCar();
  setDriving(false);
  setSteering('left');
  mockLang = 'en';
});

test('the h3 VW demo profile has the dual-zone tool; the v1 fallback does not', () => {
  expect(Object.keys(tools())).toContain('set_dual_zone_temperature');
  expect(carTools('vw_demo', 'v1').map((t: any) => t.name)).not.toContain('set_dual_zone_temperature');
});

describe('windows by place', () => {
  test('success / already, en', () => {
    expect(say('set_window', { window: 'front_left', position: 'open' })).toBe('I opened the front left window.');
    expect(getCarState().windows.front_left).toBe('open');
    expect(say('set_window', { window: 'front_left', position: 'open' })).toBe('The front left window is already open.');
    expect(say('set_window', { window: 'rear', position: 'half' })).toBe('I opened the rear windows halfway.');
    expect(say('set_window', { window: 'all', position: 'close' })).toBe('I closed all the windows.');
    expect(say('set_window', { window: 'all', position: 'close' })).toBe('All the windows are already closed.');
  });
  test('success / already, pt-BR (agreement)', () => {
    mockLang = 'pt-BR';
    expect(say('set_window', { window: 'rear_right', position: 'open' })).toBe('Abri o vidro traseiro direito.');
    expect(say('set_window', { window: 'rear_right', position: 'open' })).toBe('O vidro traseiro direito já está aberto.');
    expect(say('set_window', { window: 'left', position: 'close' })).toBe('Os vidros do lado esquerdo já estão fechados.');
    expect(say('set_window', { window: 'left', position: 'crack' })).toBe('Deixei os vidros do lado esquerdo com uma fresta.');
    expect(say('set_window', { window: 'left', position: 'close' })).toBe('Fechei os vidros do lado esquerdo.');
    expect(say('set_window', { window: 'front', position: 'close' })).toBe('Os vidros da frente já estão fechados.');
  });
  test('driver / passenger follow the steering wheel', () => {
    say('set_window', { window: 'driver', position: 'open' });
    expect(getCarState().windows.front_left).toBe('open');
    setSteering('right');
    say('set_window', { window: 'driver', position: 'crack' });
    expect(getCarState().windows.front_right).toBe('crack');
    say('set_window', { window: 'passenger', position: 'half' });
    expect(getCarState().windows.front_left).toBe('half');
  });
  test('blocked while driving (all open) and an unknown window', () => {
    setDriving(true);
    const r = run('set_window', { window: 'all', position: 'open' });
    expect(r.say).toBe("I can't do that while the car is moving.");
    expect(r.result.ok).toBe(false);
    expect(getCarState().windows.front_left).toBe('close');
    expect(run('set_window', { window: 'sunroof', position: 'open' }).result.ok).toBe(false);
  });
});

describe('doors and locks are separate operations', () => {
  test('open / close one door, already, en + pt', () => {
    expect(say('open_door', { door: 'rear_left' })).toBe('I opened the rear left door.');
    expect(say('open_door', { door: 'rear_left' })).toBe('The rear left door is already open.');
    mockLang = 'pt-BR';
    expect(say('close_doors', { door: 'rear_left' })).toBe('Fechei a porta traseira esquerda.');
    expect(say('close_doors', {})).toBe('Todas as portas já estão fechadas.');
    expect(getCarState().windows.rear_left).toBe('close');   // a door never moves a window
  });
  test('a locked door: the app asks, nothing opens, nothing is unlocked', () => {
    say('lock_car', {});
    const r = run('open_door', { door: 'all' });
    expect(r.say).toBe('The car is locked. Should I unlock it?');
    expect(r.result.ok).toBe(false);
    expect(getCarState().locked).toBe(true);
    expect(Object.values(getCarState().doors).every((d) => d === 'closed')).toBe(true);
  });
  test('one door locked, en + pt', () => {
    expect(say('lock_car', { door: 'front_right' })).toBe('I locked the front right door.');
    expect(getCarState().doorLocks.front_right).toBe(true);
    expect(getCarState().locked).toBe(false);
    expect(say('open_door', { door: 'passenger' })).toBe('The front right door is locked. Should I unlock it?');
    mockLang = 'pt-BR';
    expect(say('lock_car', { door: 'front_right' })).toBe('A porta dianteira direita já está trancada.');
    expect(say('unlock_car', { door: 'passenger' })).toBe('Destranquei a porta do passageiro.');
    expect(say('unlock_car', {})).toBe('O carro já está destrancado.');
  });
  test('no locking with a door open', () => {
    say('open_door', { door: 'front_left' });
    expect(say('lock_car', {})).toBe("I can't lock it while the front left door is open. Close it first?");
    expect(getCarState().locked).toBe(false);
  });
});

describe('temperature', () => {
  test('one zone: success / already / out of range', () => {
    expect(say('set_temperature', { temperature: 22, zone: 'driver' })).toBe("I set the driver's side to 22°C.");
    expect(say('set_temperature', { temperature: 22, zone: 'driver' })).toBe("The driver's side is already at 22°C.");
    const r = run('set_temperature', { temperature: 40 });
    expect(r.result.ok).toBe(false);
    expect(r.say).toBe("I didn't change it: the temperature must be between 16 and 30.");
  });
  test('dual zone: both, already, partial, none (en + pt)', () => {
    expect(say('set_dual_zone_temperature', { driver: 20, passenger: 23 })).toBe("I set the driver's side to 20°C and the passenger side to 23°C.");
    expect(getCarState().temperature.driver).toBe(20);
    expect(getCarState().temperature.passenger).toBe(23);
    expect(say('set_dual_zone_temperature', { driver: 20, passenger: 23 })).toBe("The driver's side is already at 20°C and the passenger side at 23°C.");
    mockLang = 'pt-BR';
    expect(say('set_dual_zone_temperature', { driver: 21, passenger: 35 })).toBe('Coloquei o lado do motorista em 21°C, mas não o do passageiro: precisa ficar entre 16 e 30.');
    expect(getCarState().temperature.passenger).toBe(23);   // the failed side is unchanged
    const r = run('set_dual_zone_temperature', { driver: 5, passenger: 50 });
    expect(r.result.ok).toBe(false);
    expect(r.say).toBe('Não mudei a temperatura: os dois valores precisam ficar entre 16 e 30.');
  });
});

describe('other operations name what they did, or that nothing changed', () => {
  test('seat, defrost, volume, fan', () => {
    expect(say('set_seat_climate', { feature: 'heater', level: 'off' })).toBe("The heater in the driver's seat is already off.");
    expect(say('set_seat_climate', { feature: 'heater', level: 'medium' })).toBe("I set the heater in the driver's seat to medium.");
    expect(say('set_defrost', { target: 'rear', on: false })).toBe('The rear defogger is already off.');
    expect(say('set_volume', { action: 'unmute' })).toBe('The sound is already on, volume 12.');
    expect(say('set_volume', { action: 'mute' })).toBe('I muted the sound.');
  });
  test('volume: a step of the size the user said, a target, the default step', () => {
    // "change" = the step the agent core writes from the user's words (execution.stepArgument)
    expect(say('set_volume', { action: 'up', change: 5 })).toBe('I turned the volume up to 17.');
    expect(say('set_volume', { action: 'down', change: -2 })).toBe('I turned the volume down to 15.');
    expect(say('set_volume', { action: 'down', change: 4 })).toBe('I turned the volume down to 11.');
    expect(say('set_volume', { action: 'set', change: 3 })).toBe('I turned the volume up to 14.');
    expect(say('set_volume', { action: 'up', change: 50 })).toBe('I turned the volume up to 30.');
    expect(say('set_volume', { action: 'set', level: 12 })).toBe('I set the volume to 12.');
    // "up" with a level below the volume / "down" with one above it cannot be a target: the step
    expect(say('set_volume', { action: 'up', level: 2 })).toBe('I turned the volume up to 14.');
    expect(say('set_volume', { action: 'down', level: 20 })).toBe('I turned the volume down to 0.');
    expect(say('set_volume', { action: 'set', level: 12 })).toBe('I set the volume to 12.');
    // a target stays a target ("turn the volume down to 5", "up to 20"), the plain step stays 3
    expect(say('set_volume', { action: 'down', level: 5 })).toBe('I turned the volume down to 5.');
    expect(say('set_volume', { action: 'up', level: 20 })).toBe('I turned the volume up to 20.');
    expect(say('set_volume', { action: 'up' })).toBe('I turned the volume up to 23.');
    expect(say('set_volume', { action: 'down' })).toBe('I turned the volume down to 20.');
    expect(say('set_volume', { action: 'set', level: 12 })).toBe('I set the volume to 12.');
  });
  test('fan and the rest in Portuguese', () => {
    mockLang = 'pt-BR';
    expect(say('set_fan_speed', { level: 3 })).toBe('A ventilação já está no nível 3.');
    expect(say('set_fan_speed', { level: 5 })).toBe('Coloquei a ventilação no nível 5.');
  });
  test('lookups answer with the value', () => {
    expect(say('get_vehicle_status', { item: 'range' })).toBe('You have about 312 km of range left.');
    expect(say('get_trip_eta', {})).toBe("There's no active route. Where do you want to go?");
  });
  // Unsupported capabilities (no tool in the car: trunk, hazards ...) are refused by the core's capability guard with the pack's
  // "not available" reply (the agent's guard tests); every catalog tool here has a handler.
});

test('a fan level outside 1-7 goes to the nearest end and says so (2026-11-10 round 2)', () => {
  mockLang = 'pt-BR';
  expect(say('set_fan_speed', { level: 9 })).toBe('A ventilação vai até o nível 7, então coloquei no nível 7.');
  expect(say('set_fan_speed', { change: 2 })).toBe('A ventilação vai até o nível 7, e já está nele.');
  mockLang = 'en';
  expect(say('set_fan_speed', { level: 0 })).toBe('The lowest fan level is 1, so I set it to level 1.');
  expect(say('set_fan_speed', { level: 4 })).toBe('I set the fan to level 4.');
});

test('airflow sentences use the article in pt-BR ("para os pés"; 2026-11-12 S20)', () => {
  mockLang = 'pt-BR';
  expect(say('set_airflow', { mode: 'feet' })).toBe('O ar agora vai para os pés.');
  expect(say('set_airflow', { mode: 'feet' })).toBe('O ar já vai para os pés.');
  expect(say('set_airflow', { mode: 'face_and_feet' })).toBe('O ar agora vai para o rosto e os pés.');
  expect(say('set_airflow', { mode: 'windshield' })).toBe('O ar agora vai para o para-brisa.');
});

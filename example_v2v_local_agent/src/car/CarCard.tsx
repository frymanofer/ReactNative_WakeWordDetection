import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getTTSLanguage } from '../tts';
import { getCarActions, getCarState, onCarChange, resetCar, setDriving } from './CarState';
import type { CarAction, CarState } from './CarState';

/** "tool(arg: value, ...)": exactly what the AI called. */
function callText(action: CarAction): string {
  const args = Object.entries(action.args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ');
  return `${action.tool}(${args})`;
}

function windowsText(s: CarState): string {
  const open = Object.entries(s.windows).filter(([, p]) => p !== 'close');
  if (open.length === 0) return 'closed';
  if (open.length === 4 && open.every(([, p]) => p === open[0][1])) return `all ${open[0][1]}`;
  return open.map(([w, p]) => `${w.replace('_', ' ')} ${p}`).join(', ');
}

/**
 * "Car" card for Local AI Chat (next to the calories): the latest action the
 * AI took in the simulated car (DaVoice Car tools, the DaVoice car command list)
 * with the exact tool call, the two before it, and a one-line car state.
 */
export default function CarCard() {
  const [, setVersion] = useState(0);
  useEffect(() => onCarChange(() => setVersion((v) => v + 1)), []);

  const s = getCarState();
  const pt = getTTSLanguage() === 'pt-BR';
  const actions = getCarActions();
  const latest = actions[actions.length - 1];
  const earlier = actions.slice(-3, -1).reverse();
  const unit = s.temperature.unit === 'fahrenheit' ? '°F' : '°C';
  const chips = [
    // two sides (2026-11-10): one value when both sides match, else driver | passenger
    s.temperature.driver === s.temperature.passenger
      ? `${s.temperature.driver}${unit}`
      : `${pt ? 'mot.' : 'driver'} ${s.temperature.driver}${unit} | ${pt ? 'pass.' : 'passenger'} ${s.temperature.passenger}${unit}`,
    `${pt ? 'vent.' : 'fan'} ${s.fan}`,
    `${pt ? 'vidros' : 'windows'} ${windowsText(s)}`,
    Object.values(s.doors).some((d) => d === 'open')
      ? `${pt ? 'portas' : 'doors'} ${Object.entries(s.doors).filter(([, d]) => d === 'open').map(([k]) => k.replace('_', ' ')).join(', ')} ${pt ? 'abertas' : 'open'}`
      : null,
    s.locked
      ? (pt ? '🔒 trancado' : '🔒 locked')
      : Object.values(s.doorLocks).some(Boolean)
        ? `🔒 ${Object.entries(s.doorLocks).filter(([, l]) => l).map(([k]) => k.replace('_', ' ')).join(', ')}`
        : (pt ? 'destrancado' : 'unlocked'),
    s.sunroof !== 'close' ? `${pt ? 'teto' : 'sunroof'} ${s.sunroof}` : null,
    s.seatHeater.driver !== 'off' ? `${pt ? 'banco' : 'seat heat'} ${s.seatHeater.driver}` : null,
    s.destination ? `→ ${s.destination}` : null,
    s.radio ?? (s.media ? `♪ ${s.media}` : null),
    s.muted ? (pt ? 'mudo' : 'muted') : `vol ${s.volume}`,
    s.call ? `${pt ? 'ligação' : 'call'}: ${s.call}` : null,
    s.scenario ? `${s.scenario.replace('_', ' ')} mode` : null,
  ].filter(Boolean) as string[];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{pt ? 'Carro' : 'Car'}</Text>
        <TouchableOpacity
          style={[styles.resetButton, s.driving && styles.drivingOn]}
          activeOpacity={0.7}
          onPress={() => setDriving(!s.driving)}>
          <Text style={styles.resetText}>{s.driving ? (pt ? 'Em movimento' : 'Driving') : pt ? 'Parado' : 'Parked'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.resetButton, styles.gap]} activeOpacity={0.7} onPress={resetCar}>
          <Text style={styles.resetText}>{pt ? 'Reiniciar' : 'Reset'}</Text>
        </TouchableOpacity>
      </View>
      {latest ? (
        <>
          <Text style={[styles.summary, !latest.ok && styles.failed]} numberOfLines={2}>
            {latest.ok ? '✓ ' : pt ? '⛔ Bloqueado: ' : '⛔ Blocked: '}
            {latest.summary.charAt(0).toUpperCase() + latest.summary.slice(1)}
          </Text>
          <Text style={styles.call} numberOfLines={2}>
            {callText(latest)}
          </Text>
          {earlier.map((a) => (
            <Text key={a.id} style={styles.earlier} numberOfLines={1}>
              {a.summary}  ·  {a.tool}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.hint}>
          {pt
            ? 'Tente: "coloca o ar em 22 graus", "abre o vidro do motorista", "me leva pra casa", "toca a 98,5", "quanto tem de combustível?"'
            : 'Try: "set the AC to 22", "open my window", "take me home", "tune to 98.5", "how much fuel do I have?"'}
        </Text>
      )}
      <Text style={styles.state} numberOfLines={2}>
        {chips.join('  ·  ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.45)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.65)',
    textTransform: 'uppercase',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  resetText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  drivingOn: { backgroundColor: 'rgba(255, 159, 10, 0.45)', borderColor: 'rgba(255, 159, 10, 0.8)' },
  gap: { marginLeft: 8 },
  summary: { marginTop: 6, fontSize: 17, fontWeight: '700', color: '#ffffff' },
  failed: { color: '#ff9f9f' },
  call: { marginTop: 3, fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'Courier' },
  earlier: { marginTop: 4, fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: 'rgba(255, 255, 255, 0.7)' },
  state: { marginTop: 8, fontSize: 12, color: 'rgba(255, 255, 255, 0.75)' },
});

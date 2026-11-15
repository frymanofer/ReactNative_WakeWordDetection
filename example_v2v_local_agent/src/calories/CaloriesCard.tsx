import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getLocalAgent, onLocalAgentEvent } from '../agent/LocalAgent';

/** One line of today's calorie log (the agent core's calories skill). */
interface CalorieEntry {
  id: string;
  label: string;
  /** Negative for removals and downward corrections. */
  calories: number;
}

interface CalorieLog {
  total: number;
  entries: CalorieEntry[];
  canUndo: boolean;
}

/**
 * "Calories today" card for Local AI Chat. The on-device AI changes it by
 * voice through the calorie tools (in the native agent core, which keeps the
 * log in SQLite); every change shows here immediately and can be undone with
 * the button (or by saying "undo that").
 */
export default function CaloriesCard() {
  const [total, setTotal] = useState(0);
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    const show = (log: CalorieLog) => {
      setEntries(log.entries);
      setTotal(log.total);
      setCanUndo(log.canUndo);
    };
    const unsubscribe = onLocalAgentEvent((event) => {
      if (event.type === 'skill' && event.skill === 'calories') show(event as unknown as CalorieLog);
    });
    getLocalAgent()
      .then((agent) => agent.skill<CalorieLog>('calories', 'log.get'))
      .then(show)
      .catch((error) => console.log('[Calories] could not read the log:', error));
    return unsubscribe;
  }, []);

  const recent = entries.slice(-3).reverse();
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.label}>Calories today</Text>
          <Text style={styles.total}>{total.toLocaleString('en-US')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.undoButton, !canUndo && styles.undoDisabled]}
          activeOpacity={0.7}
          disabled={!canUndo}
          onPress={() => void getLocalAgent().then((agent) => agent.skill('calories', 'log.undo'))}>
          <Text style={styles.undoText}>Undo</Text>
        </TouchableOpacity>
      </View>
      {recent.length === 0 ? (
        <Text style={styles.hint}>Try: "I had two eggs", "remove 200", "set it to 1500", "how much have I eaten?"</Text>
      ) : (
        recent.map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
            <Text style={styles.entryLabel} numberOfLines={1}>
              {entry.label}
            </Text>
            <Text style={styles.entryCalories}>
              {entry.calories >= 0 ? '+' : '−'}
              {Math.abs(entry.calories)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(52, 199, 89, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.45)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.65)',
    textTransform: 'uppercase',
  },
  total: { fontSize: 32, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  undoButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  undoDisabled: { opacity: 0.4 },
  undoText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: 'rgba(255, 255, 255, 0.7)' },
  entryRow: { flexDirection: 'row', marginTop: 6 },
  entryLabel: { flex: 1, fontSize: 15, color: '#ffffff' },
  entryCalories: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginLeft: 8 },
});

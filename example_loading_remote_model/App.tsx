/**
 * DaVoice wake word + speaker verification example.
 *
 * 1. Say the wake word ("Hey Coach") - every detection is listed below.
 * 2. Enroll your voice (5 short samples: you read the wake word several times and a few other sentences) and turn on
 *    "Only my voice": now the wake word fires only for you.
 * 3. "Test my voice" scores your voice against the saved profile, live, while you talk.
 * 4. The wake word model is updated from a CDN: at startup and with "Check for model update" (no app restart).
 *    The demo CDN serves a different phrase on purpose: after the update say "Hey Look Deep" (src/modelSource.ts).
 *
 * The code that talks to the library is in src/wakeword.ts, src/speakerVerification.ts and src/modelSource.ts
 * (downloads: src/modelUpdater.ts).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import type { KeyWordRNBridgeInstance } from 'react-native-wakeword';
import { createWakewordDetector, detectionLabel, ensureMicrophonePermission, startListening, stopListening } from './src/wakeword';
import type { WakewordDetector } from './src/wakeword';
import {
  deleteVoiceProfile,
  enrollVoice,
  enrollmentScript,
  loadVoiceProfilePath,
  readVoiceProfile,
  saveVoiceProfile,
  startVoiceTest,
} from './src/speakerVerification';
import type { VoiceTestScore } from './src/speakerVerification';
import { SV_DECISION_THRESHOLD, SV_ENROLLMENT_SAMPLES, WAKEWORD_PHRASE } from './src/config';
import { SUPPORTS_MODEL_UPDATES, checkForModelUpdate, modelOnStartup } from './src/modelSource';
import type { ModelInfo } from './src/modelSource';

type Detection = { at: string; label: string; verified: boolean };
type Screen = 'main' | 'enroll' | 'test';

export default function App() {
  const detectorRef = useRef<WakewordDetector | null>(null);
  const svOnRef = useRef(false);
  const modelRef = useRef<ModelInfo | null>(null);
  const testStopRef = useRef<null | (() => Promise<void>)>(null);
  const [screen, setScreen] = useState<Screen>('main');
  const [status, setStatus] = useState('Starting...');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [profilePath, setProfilePath] = useState<string | null>(null);
  const [svOn, setSvOn] = useState(false);
  const [enrolled, setEnrolled] = useState(0);
  const [enrollStep, setEnrollStep] = useState('');
  const [lastScore, setLastScore] = useState<VoiceTestScore | null>(null);
  const [lastScoreAt, setLastScoreAt] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [detections, setDetections] = useState<Detection[]>([]);

  const phrase = model?.phrase ?? WAKEWORD_PHRASE;
  const instance = (): KeyWordRNBridgeInstance | null => detectorRef.current?.instance ?? null;

  const onDetected = useCallback((event: unknown) => {
    const at = new Date().toLocaleTimeString();
    // one model per detector here: show its phrase (a downloaded model keeps the bundled model's file name)
    const label = modelRef.current?.phrase ?? detectionLabel(event);
    setDetections((list) => [{ at, label, verified: svOnRef.current }, ...list].slice(0, 20));
  }, []);

  /** (Re)starts listening with or without the voice profile. */
  const listen = useCallback(async (withProfile: string | null) => {
    const inst = detectorRef.current?.instance;
    if (!inst) return;
    await startListening(inst, withProfile);
    svOnRef.current = !!withProfile;
    setListening(true);
    setStatus(withProfile ? 'Listening: only your voice can wake the app.' : 'Listening for the wake word.');
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!(await ensureMicrophonePermission())) {
          setStatus('Microphone permission is needed. Enable it in Settings and restart the app.');
          return;
        }
        setStatus('Loading the wake word model...');
        const m = await modelOnStartup();
        const detector = await createWakewordDetector(m.modelPath, onDetected);
        if (!alive) {
          await detector.remove();
          return;
        }
        detectorRef.current = detector;
        modelRef.current = m;
        setModel(m);
        const saved = await loadVoiceProfilePath();
        setProfilePath(saved);
        setSvOn(!!saved);
        await listen(saved);
      } catch (e: any) {
        setStatus(`Could not start: ${e?.message ?? e}`);
      }
    })();
    return () => {
      alive = false;
      testStopRef.current?.();
      detectorRef.current?.remove();
      detectorRef.current = null;
    };
  }, [listen, onDetected]);

  // "Since last" clock on the voice test screen
  useEffect(() => {
    if (screen !== 'test') return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [screen]);

  /** Stops wake word detection (one microphone user at a time). */
  const releaseMicrophone = async (): Promise<boolean> => {
    const inst = instance();
    if (!inst || busy) return false;
    setBusy(true);
    await stopListening(inst);
    setListening(false);
    return true;
  };

  /** Listens for the wake word again (with `profile` when "only my voice" is on). */
  const resumeListening = async (profile: string | null) => {
    await listen(profile).catch((e) => setStatus(`Could not restart listening: ${e?.message ?? e}`));
    setBusy(false);
  };

  const toggleListening = async () => {
    const inst = instance();
    if (!inst || busy) return;
    if (listening) {
      await stopListening(inst);
      setListening(false);
      setStatus('Stopped.');
    } else {
      await listen(svOn ? profilePath : null);
    }
  };

  const enroll = async () => {
    if (!(await releaseMicrophone())) return;
    let next = svOn ? profilePath : null;
    setEnrolled(0);
    setEnrollStep('Get ready: read the first line out loud when you are ready.');
    setScreen('enroll');
    try {
      const profile = await enrollVoice((n, target) => {
        setEnrolled(n);
        setEnrollStep(n < target ? `Sample ${n} saved. Keep going with the next line.` : 'All samples captured. Saving your voice profile...');
      });
      next = await saveVoiceProfile(profile);
      setProfilePath(next);
      setSvOn(true);
      setStatus('Your voice is enrolled. Try "Test my voice".');
    } catch (e: any) {
      setStatus(`Enrollment failed: ${e?.message ?? e}`);
    } finally {
      setScreen('main');
      await resumeListening(next);
    }
  };

  const testMyVoice = async () => {
    if (!profilePath) return;
    if (!(await releaseMicrophone())) return;
    setLastScore(null);
    setLastScoreAt(null);
    setTestMessage(`Listening... say “${phrase}” or anything else in your normal voice.`);
    setScreen('test');
    try {
      testStopRef.current = await startVoiceTest(
        await readVoiceProfile(profilePath),
        (result) => {
          setLastScore(result);
          setLastScoreAt(Date.now());
          setTestMessage(result.isMatch ? 'That is your voice ✅' : 'Not recognised as your voice ❌');
        },
        (message) => setTestMessage(message),
      );
    } catch (e: any) {
      setTestMessage(`Could not start the test: ${e?.message ?? e}`);
    }
  };

  const endTest = async () => {
    const stop = testStopRef.current;
    testStopRef.current = null;
    await stop?.();
    setScreen('main');
    await resumeListening(svOn ? profilePath : null);
  };

  const removeProfile = async () => {
    if (!(await releaseMicrophone())) return;
    try {
      await deleteVoiceProfile();
      setProfilePath(null);
      setSvOn(false);
    } catch (e: any) {
      setStatus(String(e?.message ?? e));
    } finally {
      await resumeListening(null);
    }
  };

  const setOnlyMyVoice = async (on: boolean) => {
    if (!profilePath || busy) return;
    setSvOn(on);
    await listen(on ? profilePath : null);
  };

  const updateModel = async () => {
    const inst = instance();
    if (!inst || !model || busy) return;
    setBusy(true);
    try {
      setStatus('Checking the CDN for a newer wake word model...');
      const { model: next, message } = await checkForModelUpdate(inst, model);
      modelRef.current = next;
      setModel(next);
      setStatus(message);
      await listen(svOn ? profilePath : null);
    } catch (e: any) {
      setStatus(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'enroll') {
    const script = enrollmentScript(phrase);
    const progress = Math.min(1, enrolled / SV_ENROLLMENT_SAMPLES);
    const fill: DimensionValue = `${Math.max(6, Math.round(progress * 100))}%`;
    return (
      <FullScreen>
        <Text style={styles.eyebrow}>Voice signature setup</Text>
        <Text style={styles.screenTitle}>Capture your voice</Text>
        <Text style={styles.screenSubtitle}>
          Read the lines below out loud, one after another, in your normal voice. Say “{phrase}” several times and the
          other sentences too. Keep talking until all {SV_ENROLLMENT_SAMPLES} samples are captured.
        </Text>
        <View style={styles.circle}>
          <View style={[styles.circleFill, { height: fill }]} />
          <Text style={styles.circlePercent}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.circleLabel}>
            {enrolled} of {SV_ENROLLMENT_SAMPLES} samples
          </Text>
        </View>
        <View style={styles.scriptCard}>
          <Text style={styles.metricLabel}>Say out loud</Text>
          {script.map((line, i) => {
            const done = i < enrolled;
            const current = i === enrolled;
            return (
              <Text key={i} style={[styles.scriptLine, done && styles.scriptDone, current && styles.scriptCurrent]}>
                {done ? '✓ ' : current ? '▶ ' : '   '}“{line}”
              </Text>
            );
          })}
        </View>
        <View style={styles.messageCard}>
          <Text style={styles.metricLabel}>Current step</Text>
          <Text style={styles.messageText}>{enrollStep}</Text>
        </View>
      </FullScreen>
    );
  }

  if (screen === 'test') {
    const shownScore = lastScore && Number.isFinite(lastScore.score) ? lastScore.score.toFixed(3) : 'N/A';
    const since = lastScoreAt === null ? 'N/A' : formatSince(now - lastScoreAt);
    return (
      <FullScreen>
        <Text style={styles.eyebrow}>Speaker verification</Text>
        <Text style={styles.screenTitle}>Test my voice</Text>
        <Text style={styles.screenSubtitle}>
          Talk normally. The score updates while you speak. Ask someone else to talk too: their voice should show NO.
        </Text>
        <View style={[styles.messageCard, lastScore?.isMatch ? styles.matchCard : lastScore ? styles.noMatchCard : null]}>
          <Text style={styles.messageText}>{testMessage}</Text>
        </View>
        <View style={styles.metricsRow}>
          <Metric label="Last score" value={shownScore} />
          <Metric label="Match" value={lastScore ? (lastScore.isMatch ? 'YES' : 'NO') : 'N/A'} />
          <Metric label="Since last" value={since} />
        </View>
        <Text style={styles.testNote}>A score of {SV_DECISION_THRESHOLD} or higher counts as your voice.</Text>
        <Pressable onPress={endTest} style={({ pressed }) => [styles.doneButton, pressed && styles.buttonDim]}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </FullScreen>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Wake Word + Speaker Verification</Text>
        <Text style={styles.status}>{status}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wake word</Text>
          <Text style={styles.big}>“{model?.phrase ?? '...'}”</Text>
          <Text style={styles.note}>
            Model: {model?.source ?? '...'} · {listening ? 'listening' : 'stopped'}
          </Text>
          <View style={styles.row}>
            <Button label={listening ? 'Stop' : 'Start'} onPress={toggleListening} disabled={busy || !model} />
            {SUPPORTS_MODEL_UPDATES && <Button label="Check for model update" onPress={updateModel} disabled={busy || !model} />}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Speaker verification</Text>
          <Text style={styles.note}>
            {profilePath
              ? 'Your voice is enrolled.'
              : `Enroll your voice so that only you can wake the app. You will say “${phrase}” several times and a few other sentences.`}
          </Text>
          <View style={styles.row}>
            <Button label={profilePath ? 'Enroll again' : 'Enroll my voice'} onPress={enroll} disabled={busy || !model} />
            {profilePath && <Button label="Test my voice" onPress={testMyVoice} disabled={busy} />}
            {profilePath && <Button label="Delete" onPress={removeProfile} disabled={busy} />}
          </View>
          {profilePath && (
            <View style={styles.switchRow}>
              <Text style={styles.label}>Only my voice wakes the app</Text>
              <Switch value={svOn} onValueChange={setOnlyMyVoice} disabled={busy} />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detections</Text>
          {detections.length === 0 ? (
            <Text style={styles.note}>None yet. Say “{model?.phrase ?? 'the wake word'}”.</Text>
          ) : (
            detections.map((d, i) => (
              <Text key={`${d.at}-${i}`} style={styles.detection}>
                {d.at}  {d.label}{d.verified ? '  · your voice' : ''}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function formatSince(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  return sec < 60 ? `${sec.toFixed(1)}s` : `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.fullContent}>
        <View style={styles.fullCard}>{children}</View>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, (disabled || pressed) && styles.buttonDim]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f1724', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 50 },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  status: { color: '#9ecbff', fontSize: 14, marginBottom: 14 },
  card: { backgroundColor: '#1b2638', borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { color: '#8aa0bd', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  big: { color: '#ffffff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  note: { color: '#c9d4e3', fontSize: 14 },
  testNote: { color: '#c9d4e3', fontSize: 14, textAlign: 'center' },
  label: { color: '#ffffff', fontSize: 15 },
  detection: { color: '#ffffff', fontSize: 15, paddingVertical: 3 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  button: { backgroundColor: '#2f6fed', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, marginBottom: 8 },
  buttonDim: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },

  // enrollment + voice test screens (same look as the full DaVoice example app)
  fullContent: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: 40 },
  fullCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 12, 26, 0.92)',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  eyebrow: { color: '#7fb2ff', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  screenTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  screenSubtitle: { marginTop: 10, color: 'rgba(255, 255, 255, 0.75)', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  circle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginTop: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 2,
    borderColor: 'rgba(127, 178, 255, 0.6)',
  },
  circleFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(46, 134, 222, 0.55)' },
  circlePercent: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  circleLabel: { marginTop: 2, color: 'rgba(255, 255, 255, 0.8)', fontSize: 12, fontWeight: '700' },
  scriptCard: {
    width: '100%',
    marginTop: 20,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  scriptLine: { color: 'rgba(255, 255, 255, 0.55)', fontSize: 15, lineHeight: 24 },
  scriptDone: { color: '#7ee2a8' },
  scriptCurrent: { color: '#ffffff', fontWeight: '700' },
  messageCard: {
    width: '100%',
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  matchCard: { borderColor: 'rgba(126, 226, 168, 0.8)' },
  noMatchCard: { borderColor: 'rgba(255, 138, 128, 0.8)' },
  messageText: { color: '#ffffff', fontSize: 15, lineHeight: 22, fontWeight: '500', textAlign: 'center' },
  metricsRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 14 },
  metric: {
    flex: 1,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  metricLabel: { color: 'rgba(255, 255, 255, 0.55)', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' },
  metricValue: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  doneButton: { marginTop: 18, backgroundColor: '#2E86DE', borderRadius: 14, paddingVertical: 14, minWidth: 180 },
});

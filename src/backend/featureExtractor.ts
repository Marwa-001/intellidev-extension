/**
 * featureExtractor.ts
 * Mirrors Python backend/feature_engine/extractor.py
 * Extracts 18 behavioral features from a raw session JSON.
 */

export interface FeatureVector {
  avg_kpm: number;
  typing_variability: number;
  avg_pause_duration_ms: number;
  pause_count: number;
  backspace_rate: number;

  avg_error_rate: number;
  max_error_rate: number;
  error_burst_count: number;
  debug_session_count: number;

  avg_switch_frequency: number;
  max_switch_frequency: number;
  rapid_switch_count: number;
  avg_unique_files: number;

  session_duration_minutes: number;
  idle_ratio: number;
  longest_deep_work_minutes: number;
  night_time_minutes: number;
  is_night_session: boolean;
}

interface SessionEvent {
  timestamp: number;
  sessionId: string;
  eventType: string;
  data: Record<string, number | string | boolean>;
}

interface SessionLog {
  sessionId: string;
  startTime: number;
  events: SessionEvent[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function filterEvents(events: SessionEvent[], type: string): SessionEvent[] {
  return events.filter(e => e.eventType === type);
}

function mean(arr: number[]): number {
  if (!arr.length) { return 0; }
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) { return 0; }
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── Sub-extractors ────────────────────────────────────────────────────────────

function extractTyping(events: SessionEvent[]): Partial<FeatureVector> {
  const keystrokes = filterEvents(events, 'keystroke');
  const backspaces = filterEvents(events, 'backspace');
  const pauses     = filterEvents(events, 'pause');

  const kpmVals = keystrokes.map(e => Number(e.data.kpm ?? 0));
  const avg_kpm = mean(kpmVals);

  const varVals = keystrokes
    .map(e => Number(e.data.variability ?? 0))
    .filter(v => v > 0);
  const typing_variability = mean(varVals);

  const pauseDurs = pauses.map(e => Number(e.data.durationMs ?? 0));
  const avg_pause_duration_ms = mean(pauseDurs);
  const pause_count = pauses.length;

  const totalKeys = keystrokes.length;
  const totalBack = backspaces.length;
  const backspace_rate = totalKeys > 0 ? (totalBack / totalKeys) * 100 : 0;

  return { avg_kpm, typing_variability, avg_pause_duration_ms, pause_count, backspace_rate };
}

function extractErrors(events: SessionEvent[]): Partial<FeatureVector> {
  const errorEvents = filterEvents(events, 'error');
  const debugEvents = filterEvents(events, 'debug');

  const rates = errorEvents.map(e => Number(e.data.errorRate ?? 0));
  const avg_error_rate = mean(rates);
  const max_error_rate = rates.length ? Math.max(...rates) : 0;

  const bursts = errorEvents.filter(e => e.data.isBurst === true);
  const error_burst_count = bursts.length;

  const debugStarts = debugEvents.filter(
    e => !String(e.data.event ?? '').includes('terminated')
  );
  const debug_session_count = debugStarts.length;

  return { avg_error_rate, max_error_rate, error_burst_count, debug_session_count };
}

function extractContext(events: SessionEvent[]): Partial<FeatureVector> {
  const switches = filterEvents(events, 'fileSwitch');

  const freqs = switches.map(e => Number(e.data.switchFrequency ?? 0));
  const avg_switch_frequency = mean(freqs);
  const max_switch_frequency = freqs.length ? Math.max(...freqs) : 0;

  const rapids = switches.filter(e => e.data.isRapidSwitch === true);
  const rapid_switch_count = rapids.length;

  const uniqueCounts = switches.map(e => Number(e.data.uniqueFilesInWindow ?? 0));
  const avg_unique_files = mean(uniqueCounts);

  return { avg_switch_frequency, max_switch_frequency, rapid_switch_count, avg_unique_files };
}

function extractSession(session: SessionLog): Partial<FeatureVector> {
  const sessionEvents = filterEvents(session.events, 'session');

  if (!sessionEvents.length) {
    const durationMs = session.events.length
      ? Math.max(...session.events.map(e => e.timestamp)) - session.startTime
      : 0;
    return {
      session_duration_minutes: durationMs / 60000,
      idle_ratio: 0,
      longest_deep_work_minutes: 0,
      night_time_minutes: 0,
      is_night_session: false,
    };
  }

  const last = sessionEvents[sessionEvents.length - 1].data;
  return {
    session_duration_minutes: Number(last.sessionDurationMs ?? 0) / 60000,
    idle_ratio:                Number(last.idleRatio ?? 0),
    longest_deep_work_minutes: Number(last.longestDeepWorkMs ?? 0) / 60000,
    night_time_minutes:        Number(last.nightTimeMinutes ?? 0),
    is_night_session:          Boolean(last.isNightSession ?? false),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function extractFeatures(session: SessionLog): FeatureVector {
  const typing  = extractTyping(session.events);
  const errors  = extractErrors(session.events);
  const context = extractContext(session.events);
  const sess    = extractSession(session);

  return {
    avg_kpm:                   round(typing.avg_kpm ?? 0),
    typing_variability:        round(typing.typing_variability ?? 0),
    avg_pause_duration_ms:     round(typing.avg_pause_duration_ms ?? 0),
    pause_count:               Math.round(typing.pause_count ?? 0),
    backspace_rate:            round(typing.backspace_rate ?? 0),

    avg_error_rate:            round(errors.avg_error_rate ?? 0),
    max_error_rate:            round(errors.max_error_rate ?? 0),
    error_burst_count:         Math.round(errors.error_burst_count ?? 0),
    debug_session_count:       Math.round(errors.debug_session_count ?? 0),

    avg_switch_frequency:      round(context.avg_switch_frequency ?? 0),
    max_switch_frequency:      round(context.max_switch_frequency ?? 0),
    rapid_switch_count:        Math.round(context.rapid_switch_count ?? 0),
    avg_unique_files:          round(context.avg_unique_files ?? 0),

    session_duration_minutes:  round(sess.session_duration_minutes ?? 0),
    idle_ratio:                round(sess.idle_ratio ?? 0),
    longest_deep_work_minutes: round(sess.longest_deep_work_minutes ?? 0),
    night_time_minutes:        round(sess.night_time_minutes ?? 0),
    is_night_session:          Boolean(sess.is_night_session),
  };
}

function round(v: number, decimals = 3): number {
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}
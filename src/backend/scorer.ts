import type { FeatureVector } from './featureExtractor';

// ── Score levels
export interface ScoreLevel {
  label: string;
  color: string;
  emoji: string;
  description: string;
  recommendation: string;
}

export const SCORE_LEVELS: ScoreLevel[] = [
  {
    label: 'Stable Focus', color: '#27AE60', emoji: '🟢',
    description: 'Cognitive load is within healthy range.',
    recommendation: 'Keep it up. You are in a productive flow state.',
  },
  {
    label: 'Mild Strain', color: '#F39C12', emoji: '🟡',
    description: 'Early signs of cognitive strain detected.',
    recommendation: 'Consider a short break or simplify your current task.',
  },
  {
    label: 'High Cognitive Load', color: '#E67E22', emoji: '🟠',
    description: 'Significant cognitive strain detected across multiple dimensions.',
    recommendation: 'Take a 10-15 minute break. Step away from the screen.',
  },
  {
    label: 'Burnout Risk', color: '#E74C3C', emoji: '🔴',
    description: 'Critical cognitive overload detected. Burnout risk is high.',
    recommendation: 'Stop coding immediately. Rest for at least 30 minutes.',
  },
];

export function getScoreLevel(score: number): ScoreLevel {
  if (score < 30) { return SCORE_LEVELS[0]; }
  if (score < 60) { return SCORE_LEVELS[1]; }
  if (score < 80) { return SCORE_LEVELS[2]; }
  return SCORE_LEVELS[3];
}

// ── Rule interfaces

export interface ScoringRule {
  name: string;
  points: number;
  category: 'typing' | 'error' | 'context' | 'session';
}

export interface ScoringResult {
  raw_score: number;
  capped_score: number;
  level: ScoreLevel;
  triggered_rules: ScoringRule[];
  category_scores: { typing: number; error: number; context: number; session: number };
  feature_snapshot: Record<string, number | boolean>;
  reading_mode: boolean;   // true when reading/debugging dampening was applied
}

// ── Reading-mode detection 

function isReadingMode(f: FeatureVector): boolean {
  return (
    f.avg_kpm < 5 &&                    // near-zero typing
    f.avg_switch_frequency < 15 &&      // not frantically jumping around
    f.rapid_switch_count <= 5           // switches are deliberate, not frantic
  );
}

// ── Scoring functions

function scoreTyping(f: FeatureVector): [number, ScoringRule[]] {
  let s = 0;
  const rules: ScoringRule[] = [];

  if (f.typing_variability > 300) { s += 10; rules.push({ name: 'high_typing_variability',      points: 10, category: 'typing' }); }
  if (f.typing_variability > 600) { s +=  8; rules.push({ name: 'very_high_typing_variability', points:  8, category: 'typing' }); }
  if (f.backspace_rate > 10)      { s +=  8; rules.push({ name: 'high_backspace_rate',           points:  8, category: 'typing' }); }
  if (f.backspace_rate > 20)      { s +=  7; rules.push({ name: 'very_high_backspace_rate',      points:  7, category: 'typing' }); }
  if (f.avg_kpm > 0 && f.avg_kpm < 15) { s += 5; rules.push({ name: 'low_kpm',               points:  5, category: 'typing' }); }
  if (f.pause_count > 10)         { s +=  7; rules.push({ name: 'high_pause_count',              points:  7, category: 'typing' }); }

  return [s, rules];
}

function scoreErrors(f: FeatureVector): [number, ScoringRule[]] {
  let s = 0;
  const rules: ScoringRule[] = [];

  if (f.avg_error_rate > 5)       { s += 15; rules.push({ name: 'high_error_rate',          points: 15, category: 'error' }); }
  if (f.avg_error_rate > 12)      { s += 10; rules.push({ name: 'very_high_error_rate',     points: 10, category: 'error' }); }
  if (f.error_burst_count >= 2)   { s += 10; rules.push({ name: 'error_bursts_detected',    points: 10, category: 'error' }); }
  if (f.debug_session_count >= 3) { s +=  8; rules.push({ name: 'repeated_debug_sessions',  points:  8, category: 'error' }); }

  return [s, rules];
}

function scoreContext(f: FeatureVector, readingMode: boolean): [number, ScoringRule[]] {
  let s = 0;
  const rules: ScoringRule[] = [];

  // In reading mode, apply a 0.4× dampening multiplier to context penalties.
  // The developer is intentionally navigating files; this is focused work,
  // not cognitive fragmentation.
  const dampen = readingMode ? 0.4 : 1.0;

  if (f.avg_switch_frequency > 8) {
    const pts = Math.round(10 * dampen);
    if (pts > 0) { s += pts; rules.push({ name: readingMode ? 'high_switch_frequency_reading' : 'high_switch_frequency', points: pts, category: 'context' }); }
  }
  if (f.avg_switch_frequency > 15) {
    const pts = Math.round(8 * dampen);
    if (pts > 0) { s += pts; rules.push({ name: readingMode ? 'very_high_switch_frequency_reading' : 'very_high_switch_frequency', points: pts, category: 'context' }); }
  }
  if (f.rapid_switch_count > 5) {
    // Rapid switches in reading mode are still a mild signal but dampened
    const pts = Math.round(7 * dampen);
    if (pts > 0) { s += pts; rules.push({ name: readingMode ? 'rapid_switches_reading' : 'rapid_switches_detected', points: pts, category: 'context' }); }
  }
  if (f.avg_unique_files > 6)      { s +=  5; rules.push({ name: 'high_unique_files', points: 5, category: 'context' }); }

  return [s, rules];
}

function scoreSession(f: FeatureVector, readingMode: boolean): [number, ScoringRule[]] {
  let s = 0;
  const rules: ScoringRule[] = [];

  if (f.session_duration_minutes > 120) { s += 10; rules.push({ name: 'long_session',               points: 10, category: 'session' }); }
  if (f.session_duration_minutes > 240) { s += 10; rules.push({ name: 'very_long_session',          points: 10, category: 'session' }); }
  if (f.idle_ratio > 0.4)               { s +=  5; rules.push({ name: 'high_idle_ratio',            points:  5, category: 'session' }); }
  if (f.night_time_minutes > 0)         { s += 10; rules.push({ name: 'night_activity',             points: 10, category: 'session' }); }
  if (f.night_time_minutes > 30)        { s +=  8; rules.push({ name: 'extended_night_activity',    points:  8, category: 'session' }); }

  // Skip the no_deep_work rule entirely in reading mode — reading IS deep work,
  // it just doesn't produce keystrokes. Firing this rule during a debugging
  // read-through is a false positive.
  if (!readingMode && f.session_duration_minutes > 30 && f.longest_deep_work_minutes < 10) {
    s += 7; rules.push({ name: 'no_deep_work', points: 7, category: 'session' });
  }

  return [s, rules];
}

// ── Main scorer 
export function computeScore(features: FeatureVector): ScoringResult {
  const readingMode = isReadingMode(features);

  const [ts, tr] = scoreTyping(features);
  const [es, er] = scoreErrors(features);
  const [cs, cr] = scoreContext(features, readingMode);
  const [ss, sr] = scoreSession(features, readingMode);

  const raw    = ts + es + cs + ss;
  const capped = Math.min(raw, 100);
  const level  = getScoreLevel(capped);

  return {
    raw_score:   raw,
    capped_score: capped,
    level,
    triggered_rules: [...tr, ...er, ...cr, ...sr],
    category_scores: { typing: ts, error: es, context: cs, session: ss },
    feature_snapshot: {
      avg_kpm:                   features.avg_kpm,
      typing_variability:        features.typing_variability,
      backspace_rate:            features.backspace_rate,
      avg_error_rate:            features.avg_error_rate,
      error_burst_count:         features.error_burst_count,
      debug_session_count:       features.debug_session_count,
      avg_switch_frequency:      features.avg_switch_frequency,
      rapid_switch_count:        features.rapid_switch_count,
      session_duration_minutes:  features.session_duration_minutes,
      idle_ratio:                features.idle_ratio,
      longest_deep_work_minutes: features.longest_deep_work_minutes,
      night_time_minutes:        features.night_time_minutes,
    },
    reading_mode: readingMode,
  };
}
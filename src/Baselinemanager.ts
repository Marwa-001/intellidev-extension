import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Types

export interface FeatureMetrics {
  avg_kpm:                   number;
  typing_variability:        number;
  backspace_rate:            number;
  pause_count:               number;
  avg_error_rate:            number;
  max_error_rate:            number;
  error_burst_count:         number;
  debug_session_count:       number;
  avg_switch_frequency:      number;
  rapid_switch_count:        number;
  avg_unique_files:          number;
  session_duration_minutes:  number;
  idle_ratio:                number;
  longest_deep_work_minutes: number;
  night_time_minutes:        number;
}

export interface BaselineStats {
  mean:            Partial<FeatureMetrics>;
  std:             Partial<FeatureMetrics>;
  sessionCount:    number;
  totalHoursCoded: number;
  lockedAt:        string;
  lastUpdatedAt:   string;
}

export interface BaselineState {
  uuid:                 string;
  isCalibrated:         boolean;
  calibrationSessions:  number;
  calibrationHours:     number;
  needsDrift:           boolean;
  baseline:             BaselineStats | null;
}

export interface ScoredSession {
  rawScore:            number;
  rawLabel:            string;
  baselineScore:       number | null;
  baselineLabel:       string | null;
  deviationSummary:    string | null;
  isCalibrating:       boolean;
  calibrationProgress: number;
}

export type DeleteResult = { success: boolean; message: string };

// Constants

const MIN_SESSIONS   = 10;
const MIN_HOURS      = 10; 

const RETENTION_DAYS = 90;
const DRIFT_EVERY    = 30;
const DRIFT_ALPHA    = 0.3;

const METRICS: (keyof FeatureMetrics)[] = [
  'avg_kpm', 'typing_variability', 'backspace_rate', 'pause_count',
  'avg_error_rate', 'max_error_rate', 'error_burst_count', 'debug_session_count',
  'avg_switch_frequency', 'rapid_switch_count', 'avg_unique_files',
  'session_duration_minutes', 'idle_ratio', 'longest_deep_work_minutes', 'night_time_minutes',
];

const METRIC_WEIGHTS: Record<keyof FeatureMetrics, number> = {
  avg_kpm:                   -0.5,
  typing_variability:         1.5,
  backspace_rate:             1.2,
  pause_count:                0.8,
  avg_error_rate:             2.0,
  max_error_rate:             1.0,
  error_burst_count:          1.5,
  debug_session_count:        0.8,
  avg_switch_frequency:       1.5,
  rapid_switch_count:         1.2,
  avg_unique_files:           0.6,
  session_duration_minutes:   0.5,
  idle_ratio:                 0.4,
  longest_deep_work_minutes: -1.0,
  night_time_minutes:         0.7,
};

// BaselineManager

export class BaselineManager {
  private _state: BaselineState;
  private readonly _storageDir: string;
  private readonly _stateFile:  string;
  private _featuresDir: string = '';   // set by dashboard on first load

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._storageDir = _context.globalStorageUri.fsPath;
    this._stateFile  = path.join(this._storageDir, 'baseline_state.json');
    this._state      = this._load();
  }

  // ── Public getters 

  get uuid():                string               { return this._state.uuid; }
  get isCalibrated():        boolean              { return this._state.isCalibrated; }
  get calibrationSessions(): number               { return this._state.calibrationSessions; }
  get calibrationHours():    number               { return this._state.calibrationHours; }
  get baseline():            BaselineStats | null { return this._state.baseline; }
  get minSessions():         number               { return MIN_SESSIONS; }
  get minHours():            number               { return MIN_HOURS; }

  get calibrationProgress(): number {
    const bySession = this._state.calibrationSessions / MIN_SESSIONS;
    const byHours   = MIN_HOURS > 0 ? this._state.calibrationHours / MIN_HOURS : 1;
    return Math.min(1, Math.min(bySession, byHours));
  }

  // ── Register features dir so delete methods know where data lives
  setFeaturesDir(dir: string): void { this._featuresDir = dir; }

  // ── 90-day pruning

  pruneOldSessions(featuresDir: string): number {
    if (!fs.existsSync(featuresDir)) { return 0; }
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let pruned = 0;
    try {
      const files = fs.readdirSync(featuresDir).filter(f => f.endsWith('_features.json'));
      for (const file of files) {
        try {
          const sid  = file.replace('_features.json', '').replace('session_', '');
          const [dp] = sid.split('_');
          const date = new Date(
            parseInt(dp.slice(0, 4)), parseInt(dp.slice(4, 6)) - 1, parseInt(dp.slice(6, 8))
          ).getTime();
          if (date < cutoff) { fs.unlinkSync(path.join(featuresDir, file)); pruned++; }
        } catch {}
      }
    } catch {}
    return pruned;
  }

  // ── Calibration sync

  updateCalibrationCount(sessionCount: number, totalHours: number): void {
    if (sessionCount > this._state.calibrationSessions || totalHours > this._state.calibrationHours) {
      this._state.calibrationSessions = sessionCount;
      this._state.calibrationHours    = totalHours;
      this._save();
    }
  }

  // ── Baseline lock & drift 

  lockBaseline(allSessions: FeatureMetrics[]): void {
    const stats = this._computeStats(allSessions);
    this._state.baseline = {
      ...stats,
      sessionCount:    allSessions.length,
      totalHoursCoded: allSessions.reduce((a, s) => a + (s.session_duration_minutes || 0) / 60, 0),
      lockedAt:        new Date().toISOString(),
      lastUpdatedAt:   new Date().toISOString(),
    };
    this._state.isCalibrated = true;
    this._state.needsDrift   = false;
    this._save();
  }

  checkAndApplyDrift(recentSessions: FeatureMetrics[]): void {
    if (!this._state.needsDrift || !this._state.baseline) { return; }
    const newStats = this._computeStats(recentSessions);
    const old      = this._state.baseline;
    const blendedMean: Partial<FeatureMetrics> = {};
    const blendedStd:  Partial<FeatureMetrics> = {};
    for (const m of METRICS) {
      const oldMean = (old.mean[m] ?? 0) as number;
      const newMean = (newStats.mean[m] ?? oldMean) as number;
      const oldStd  = (old.std[m]  ?? 1) as number;
      const newStd  = (newStats.std[m]  ?? oldStd) as number;
      (blendedMean as Record<string, number>)[m] = DRIFT_ALPHA * newMean + (1 - DRIFT_ALPHA) * oldMean;
      (blendedStd  as Record<string, number>)[m] = DRIFT_ALPHA * newStd  + (1 - DRIFT_ALPHA) * oldStd;
    }
    this._state.baseline = { ...old, mean: blendedMean, std: blendedStd, lastUpdatedAt: new Date().toISOString() };
    this._state.needsDrift = false;
    this._save();
  }

  flagDriftNeeded(): void { this._state.needsDrift = true; this._save(); }

  // ── Scoring 

  scoreSession(metrics: FeatureMetrics, rawScore: number): ScoredSession {
    const rawLabel            = this._labelFor(rawScore);
    const isCalibrating       = !this._state.isCalibrated;
    const calibrationProgress = this.calibrationProgress;

    if (isCalibrating || !this._state.baseline) {
      return { rawScore, rawLabel, baselineScore: null, baselineLabel: null, deviationSummary: null, isCalibrating: true, calibrationProgress };
    }

    const { mean, std } = this._state.baseline;
    let weightedZSum = 0, weightSum = 0, maxZ = 0, maxMetric = '';

    for (const m of METRICS) {
      const val   = (metrics[m] ?? 0) as number;
      const mu    = (mean[m]    ?? 0) as number;
      const sigma = Math.max((std[m] ?? 1) as number, 0.01);
      const z     = (val - mu) / sigma;
      const w     = Math.abs(METRIC_WEIGHTS[m]);
      const sign  = METRIC_WEIGHTS[m] > 0 ? 1 : -1;
      weightedZSum += sign * z * w;
      weightSum    += w;
      if (Math.abs(z) > Math.abs(maxZ)) { maxZ = z; maxMetric = m; }
    }

    const normZ         = weightedZSum / Math.max(weightSum, 1);
    const baselineScore = Math.min(100, Math.max(0, Math.round((normZ + 3) / 6 * 100)));
    const baselineLabel = this._labelFor(baselineScore);
    const deviationSummary = `${Math.abs(maxZ).toFixed(1)}σ ${maxZ > 0 ? 'above' : 'below'} your norm · ${maxMetric.replace(/_/g, ' ')}`;

    return { rawScore, rawLabel, baselineScore, baselineLabel, deviationSummary, isCalibrating: false, calibrationProgress: 1 };
  }

  // ── Data deletion methods

  /** Delete all session + alert JSON files. Keep baseline intact. */
  deleteSessionData(featuresDir: string, alertsDir: string): DeleteResult {
    let deleted = 0;
    try {
      for (const dir of [featuresDir, alertsDir]) {
        if (!fs.existsSync(dir)) { continue; }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try { fs.unlinkSync(path.join(dir, file)); deleted++; } catch {}
        }
      }
      // Reset calibration counters but keep UUID
      this._state.calibrationSessions = 0;
      this._state.calibrationHours    = 0;
      this._state.isCalibrated        = false;
      this._state.needsDrift          = false;
      this._state.baseline            = null;
      this._save();
      return { success: true, message: `Deleted ${deleted} session file(s). Baseline reset.` };
    } catch (e) {
      return { success: false, message: `Delete failed: ${e}` };
    }
  }

  /** Reset only the baseline — keep all session history, restart calibration. */
  resetBaseline(): DeleteResult {
    try {
      this._state.isCalibrated        = false;
      this._state.calibrationSessions = 0;
      this._state.calibrationHours    = 0;
      this._state.needsDrift          = false;
      this._state.baseline            = null;
      this._save();
      return { success: true, message: 'Baseline reset. Calibration will restart from your existing sessions.' };
    } catch (e) {
      return { success: false, message: `Reset failed: ${e}` };
    }
  }

  /** Full wipe — delete all data AND generate a new UUID. Truly fresh start. */
  fullWipe(featuresDir: string, alertsDir: string): DeleteResult {
    const sessionResult = this.deleteSessionData(featuresDir, alertsDir);
    if (!sessionResult.success) { return sessionResult; }
    try {
      this._state.uuid = this._generateUUID();
      this._save();
      return { success: true, message: 'Full wipe complete. New identity generated.' };
    } catch (e) {
      return { success: false, message: `Wipe failed: ${e}` };
    }
  }

  // ── Private helpers

  private _computeStats(sessions: FeatureMetrics[]): { mean: Partial<FeatureMetrics>; std: Partial<FeatureMetrics> } {
    const mean: Partial<FeatureMetrics> = {};
    const std:  Partial<FeatureMetrics> = {};
    const n = sessions.length;
    if (n === 0) { return { mean, std }; }
    for (const m of METRICS) {
      const vals     = sessions.map(s => (s[m] ?? 0) as number);
      const mu       = vals.reduce((a, v) => a + v, 0) / n;
      const variance = vals.reduce((a, v) => a + (v - mu) ** 2, 0) / Math.max(n - 1, 1);
      (mean as Record<string, number>)[m] = mu;
      (std  as Record<string, number>)[m] = Math.sqrt(variance);
    }
    return { mean, std };
  }

  private _labelFor(score: number): string {
    if (score < 30) { return 'Stable Focus'; }
    if (score < 60) { return 'Mild Strain'; }
    if (score < 80) { return 'High Load'; }
    return 'Burnout Risk';
  }

  private _load(): BaselineState {
    try {
      if (!fs.existsSync(this._storageDir)) { fs.mkdirSync(this._storageDir, { recursive: true }); }
      if (fs.existsSync(this._stateFile)) {
        const saved = JSON.parse(fs.readFileSync(this._stateFile, 'utf-8'));
        return { needsDrift: false, ...saved } as BaselineState;
      }
    } catch (e) { console.error('[IntelliDev] Failed to load baseline state:', e); }
    return { uuid: this._generateUUID(), isCalibrated: false, calibrationSessions: 0, calibrationHours: 0, needsDrift: false, baseline: null };
  }

  private _save(): void {
    try {
      if (!fs.existsSync(this._storageDir)) { fs.mkdirSync(this._storageDir, { recursive: true }); }
      fs.writeFileSync(this._stateFile, JSON.stringify(this._state, null, 2), 'utf-8');
    } catch (e) { console.error('[IntelliDev] Failed to save baseline state:', e); }
  }

  private _generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}
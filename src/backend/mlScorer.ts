// mlScorer.ts — On-device online logistic regression for cognitive load scoring.
//
// Design constraints:
//   * 100% local — no network calls, no external ML library.
//   * Zero new npm dependencies — hand-rolled SGD (~150 lines of TS).
//   * Trains incrementally on each session; model persisted as JSON.
//   * Falls back gracefully (returns -1) until MIN_SESSIONS are available.
//
// Training signal: auto-derived label from the rule-based score so no user
// input is required. Once enough sessions are collected the ML score is
// blended into the final output by BackendEngine.

import * as fs   from 'fs';
import * as path from 'path';

// ── Feature keys (subset of FeatureVector — all numeric) ─────────────────

export const ML_FEATURE_KEYS = [
  'avg_kpm',
  'typing_variability',
  'backspace_rate',
  'pause_count',
  'avg_error_rate',
  'max_error_rate',
  'error_burst_count',
  'debug_session_count',
  'avg_switch_frequency',
  'rapid_switch_count',
  'avg_unique_files',
  'session_duration_minutes',
  'idle_ratio',
  'longest_deep_work_minutes',
  'night_time_minutes',
  'error_to_type_ratio',
  'context_fragmentation',
] as const;

export type MLFeatureKey = typeof ML_FEATURE_KEYS[number];
const N = ML_FEATURE_KEYS.length;

// ── Normalisation stats (Welford online algorithm) ────────────────────────

interface WelfordState {
  count: number;
  mean:  number[];
  m2:    number[];
}

function welfordUpdate(w: WelfordState, x: number[]): void {
  w.count++;
  for (let i = 0; i < N; i++) {
    const delta  = x[i] - w.mean[i];
    w.mean[i]   += delta / w.count;
    const delta2 = x[i] - w.mean[i];
    w.m2[i]     += delta * delta2;
  }
}

function welfordStd(w: WelfordState, i: number): number {
  if (w.count < 2) { return 1; }
  return Math.max(Math.sqrt(w.m2[i] / (w.count - 1)), 1e-6);
}

// ── Serialised model schema ───────────────────────────────────────────────

interface SerializedModel {
  version:         number;
  weights:         number[];
  bias:            number;
  welford:         { count: number; mean: number[]; m2: number[] };
  trainedSessions: number;
  lastUpdated:     string;
}

// ── Sigmoid ───────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  const clamped = Math.max(-35, Math.min(35, x));
  return 1 / (1 + Math.exp(-clamped));
}

// ── MLScorer ─────────────────────────────────────────────────────────────

export class MLScorer {
  static readonly MIN_SESSIONS    = 15;
  static readonly MAX_BLEND_ALPHA = 0.6;

  private weights:         number[]     = new Array(N).fill(0);
  private bias:            number       = 0;
  private welford:         WelfordState = { count: 0, mean: new Array(N).fill(0), m2: new Array(N).fill(0) };
  private trainedSessions: number       = 0;
  private readonly lr = 0.05;
  private readonly modelPath: string;

  constructor(dataDir: string) {
    this.modelPath = path.join(dataDir, 'ml_model.json');
    this._load();
  }

  get isReady(): boolean { return this.trainedSessions >= MLScorer.MIN_SESSIONS; }
  get sessionCount(): number { return this.trainedSessions; }

  update(featuresJson: Record<string, number | boolean>, label: number): void {
    const raw = this._extract(featuresJson);
    welfordUpdate(this.welford, raw);
    const x   = this._normalise(raw);
    const hat = sigmoid(this._logit(x));
    const err = hat - label;
    this.bias -= this.lr * err;
    for (let i = 0; i < N; i++) { this.weights[i] -= this.lr * err * x[i]; }
    this.trainedSessions++;
    if (this.trainedSessions % 5 === 0 || this.trainedSessions <= MLScorer.MIN_SESSIONS) {
      this._save();
    }
  }

  predict(featuresJson: Record<string, number | boolean>): number {
    if (!this.isReady) { return -1; }
    const x = this._normalise(this._extract(featuresJson));
    return Math.min(100, Math.max(0, Math.round(sigmoid(this._logit(x)) * 100)));
  }

  getTopFeatures(n = 3): Array<{ feature: string; weight: number }> {
    return ML_FEATURE_KEYS
      .map((k, i) => ({ feature: String(k), weight: this.weights[i] }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, n);
  }

  private _extract(obj: Record<string, number | boolean>): number[] {
    return ML_FEATURE_KEYS.map(k => {
      const v = obj[k as string];
      if (typeof v === 'boolean') { return v ? 1 : 0; }
      if (typeof v === 'number' && isFinite(v)) { return v; }
      return 0;
    });
  }

  private _normalise(raw: number[]): number[] {
    return raw.map((v, i) => (v - this.welford.mean[i]) / welfordStd(this.welford, i));
  }

  private _logit(x: number[]): number {
    let logit = this.bias;
    for (let i = 0; i < N; i++) { logit += this.weights[i] * x[i]; }
    return logit;
  }

  private _save(): void {
    try {
      const model: SerializedModel = {
        version: 1,
        weights: Array.from(this.weights),
        bias:    this.bias,
        welford: { count: this.welford.count, mean: Array.from(this.welford.mean), m2: Array.from(this.welford.m2) },
        trainedSessions: this.trainedSessions,
        lastUpdated:     new Date().toISOString(),
      };
      fs.writeFileSync(this.modelPath, JSON.stringify(model, null, 2), 'utf-8');
    } catch (e) { console.error('[IntelliDev ML] Failed to save model:', e); }
  }

  private _load(): boolean {
    try {
      if (!fs.existsSync(this.modelPath)) { return false; }
      const saved = JSON.parse(fs.readFileSync(this.modelPath, 'utf-8')) as SerializedModel;
      if (!saved.weights || saved.weights.length !== N) {
        console.warn('[IntelliDev ML] Model shape mismatch — starting fresh.');
        return false;
      }
      this.weights         = saved.weights;
      this.bias            = saved.bias ?? 0;
      this.welford         = { count: saved.welford?.count ?? 0, mean: (saved.welford?.mean ?? new Array(N).fill(0)), m2: (saved.welford?.m2 ?? new Array(N).fill(0)) };
      this.trainedSessions = saved.trainedSessions ?? 0;
      console.log(`[IntelliDev ML] Model loaded — trained on ${this.trainedSessions} session(s). Ready: ${this.isReady}`);
      return true;
    } catch (e) {
      console.error('[IntelliDev ML] Failed to load model — starting fresh:', e);
      return false;
    }
  }
}

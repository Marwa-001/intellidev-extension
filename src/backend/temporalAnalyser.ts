// temporalAnalyser.ts — Multi-session fatigue trend tracking.
//
// Tracks the rolling cognitive load score across sessions to detect
// fatigue accumulation that a single-session scorer cannot see.
// All data is stored locally as JSON. No external dependencies.

import * as fs   from 'fs';
import * as path from 'path';

interface SessionScore {
  sessionId:  string;
  timestamp:  string;
  score:      number;
  label:      string;
}

export type Trend = 'improving' | 'stable' | 'declining';

const EMA_ALPHA     = 0.3;  // exponential moving average smoothing factor
const TREND_WINDOW  = 10;   // sessions used for linear trend calculation
const FATIGUE_LOOKBACK = 5; // sessions examined for consecutive high-load detection

export class TemporalAnalyser {
  private history: SessionScore[] = [];
  private readonly historyPath: string;

  constructor(dataDir: string) {
    this.historyPath = path.join(dataDir, 'score_history.json');
    this._load();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Record the final blended score for a completed session. */
  record(sessionId: string, score: number, label: string): void {
    this.history.push({ sessionId, timestamp: new Date().toISOString(), score, label });
    if (this.history.length > 200) {
      this.history = this.history.slice(-200); // cap in-memory history
    }
    this._save();
  }

  /**
   * Compute a fatigue penalty (0–15 pts) based on consecutive high-load
   * sessions at the end of the recorded history.
   *
   * 2 consecutive sessions >= 60  →  +5 pts
   * 3 consecutive sessions >= 60  →  +10 pts
   * 4+ consecutive sessions >= 60 →  +15 pts
   */
  getFatiguePenalty(): number {
    const recent = this.history.slice(-FATIGUE_LOOKBACK);
    if (recent.length < 2) { return 0; }

    let consecutive = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].score >= 60) { consecutive++; } else { break; }
    }

    if (consecutive >= 4) { return 15; }
    if (consecutive === 3) { return 10; }
    if (consecutive === 2) { return 5; }
    return 0;
  }

  /**
   * Compute the rolling score trend and EMA over the last TREND_WINDOW sessions.
   *
   * trend:
   *   'declining'  — scores are rising (total linear change > +5 pts)
   *   'improving'  — scores are falling (total linear change < -5 pts)
   *   'stable'     — no clear direction
   */
  getTrend(): { trend: Trend; delta: number; ema: number } {
    const n = this.history.length;
    if (n < 2) { return { trend: 'stable', delta: 0, ema: 0 }; }

    const recent = this.history.slice(-TREND_WINDOW);
    const k = recent.length;

    // Exponential moving average
    let ema = recent[0].score;
    for (let i = 1; i < k; i++) {
      ema = EMA_ALPHA * recent[i].score + (1 - EMA_ALPHA) * ema;
    }

    // Least-squares linear slope
    const xMean = (k - 1) / 2;
    const yMean = recent.reduce((s, r) => s + r.score, 0) / k;
    let num = 0, den = 0;
    for (let i = 0; i < k; i++) {
      num += (i - xMean) * (recent[i].score - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const delta = Math.round(slope * k);

    const trend: Trend =
      delta >  5 ? 'declining' :
      delta < -5 ? 'improving' :
      'stable';

    return { trend, delta, ema: Math.round(ema) };
  }

  /** Return the N most recent session scores (for dashboard charting). */
  getRecentScores(n = TREND_WINDOW): SessionScore[] {
    return this.history.slice(-n);
  }

  /** Total sessions recorded. */
  get totalSessions(): number { return this.history.length; }

  // ── Private helpers ─────────────────────────────────────────────────────

  private _save(): void {
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (e) { console.error('[IntelliDev Temporal] Failed to save history:', e); }
  }

  private _load(): void {
    try {
      if (!fs.existsSync(this.historyPath)) { return; }
      const parsed = JSON.parse(fs.readFileSync(this.historyPath, 'utf-8'));
      if (Array.isArray(parsed)) {
        this.history = parsed as SessionScore[];
        console.log(`[IntelliDev Temporal] Loaded ${this.history.length} session score(s).`);
      }
    } catch (e) {
      console.error('[IntelliDev Temporal] Failed to load history — starting fresh:', e);
      this.history = [];
    }
  }
}

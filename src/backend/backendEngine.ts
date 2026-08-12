/// <reference types="node" />
import * as fs   from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { extractFeatures, FeatureVector } from './featureExtractor';
import { computeScore, getScoreLevel, ScoringResult } from './scorer';
import { AlertGenerator, Alert }          from './alertGenerator';
import { MLScorer }                       from './mlScorer';
import { TemporalAnalyser }               from './temporalAnalyser';

// ── Types 
export interface BackendEngineOptions {
  sessionsDir:  string;
  featuresDir:  string;
  alertsDir:    string;
  alertThreshold?: number;
  cooldownMs?:     number;
  onAlert?:     (alert: Alert) => void;
  onScored?:    (sessionId: string, result: ScoringResult) => void;
}

// ── Engine 
export class BackendEngine implements vscode.Disposable {
  private readonly sessionsDir: string;
  private readonly featuresDir: string;
  private readonly alertsDir:   string;
  private readonly threshold:   number;
  private readonly onAlert?:    (a: Alert) => void;
  private readonly onScored?:   (id: string, r: ScoringResult) => void;

  private readonly alertGen:          AlertGenerator;
  private readonly mlScorer:          MLScorer;
  private readonly temporalAnalyser:  TemporalAnalyser;
  private readonly processed:         Set<string> = new Set();
  private watcher?:                   fs.FSWatcher;
  private debounceMap:                Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly DEBOUNCE_MS = 15_000;

  private scoringHistory: Array<{ timestamp: string; session_id: string; score: number; level: string }> = [];

  constructor(opts: BackendEngineOptions) {
    this.sessionsDir = opts.sessionsDir;
    this.featuresDir = opts.featuresDir;
    this.alertsDir   = opts.alertsDir;
    this.threshold   = opts.alertThreshold ?? 60;
    this.onAlert     = opts.onAlert;
    this.onScored    = opts.onScored;
    this.alertGen    = new AlertGenerator(opts.cooldownMs ?? 300_000);

    // Derive data root from featuresDir (e.g. .../intellidev/features -> .../intellidev)
    const dataDir = path.dirname(opts.featuresDir);
    this.mlScorer         = new MLScorer(dataDir);
    this.temporalAnalyser = new TemporalAnalyser(dataDir);

    fs.mkdirSync(this.featuresDir, { recursive: true });
    fs.mkdirSync(this.alertsDir,   { recursive: true });
  }

  start(): void {
    this._processExisting();
    this._watchSessions();
    console.log('[IntelliDev Engine] Started.');
  }

  dispose(): void {
    this.watcher?.close();
    this.debounceMap.forEach(t => clearTimeout(t));
    this.debounceMap.clear();
    console.log('[IntelliDev Engine] Stopped.');
  }

  getLatestScore(): { session_id: string; score: number; level: string } | null {
    return this.scoringHistory.length
      ? { ...this.scoringHistory[this.scoringHistory.length - 1] }
      : null;
  }

  getAlertHistory(): Alert[] {
    return this.alertGen.getHistory();
  }

  processSessionFile(filePath: string): ScoringResult | null {
    if (!filePath.endsWith('.json')) { return null; }
    if (!path.basename(filePath).startsWith('session_')) { return null; }
    if (!fs.existsSync(filePath)) { return null; }

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      console.error(`[IntelliDev Engine] JSON parse error: ${filePath}`);
      return null;
    }

    const session = raw as {
      sessionId?: string; startTime?: number; events?: unknown[];
    };

    if (!session.sessionId || !session.startTime || !Array.isArray(session.events)) {
      return null;
    }
    if (session.events.length < 5) { return null; }

    let features: FeatureVector;
    try {
      features = extractFeatures(session as Parameters<typeof extractFeatures>[0]);
    } catch (e) {
      console.error(`[IntelliDev Engine] Feature extraction failed: ${e}`);
      return null;
    }

    // ── Step 1: Rule-based scoring (always runs; primary signal) ─────────
    const ruleResult = computeScore(features);
    const ruleScore  = ruleResult.capped_score;

    // ── Step 2: ML scoring (blended in gradually) ────────────────────────
    const rawFeatures = features as unknown as Record<string, number | boolean>;
    const mlScore     = this.mlScorer.predict(rawFeatures);
    const blendAlpha  = this._getBlendAlpha();

    const blendedScore = (mlScore >= 0 && blendAlpha > 0)
      ? Math.round((1 - blendAlpha) * ruleScore + blendAlpha * mlScore)
      : ruleScore;

    // ── Step 3: Temporal fatigue penalty ─────────────────────────────────
    const fatiguePenalty = this.temporalAnalyser.getFatiguePenalty();
    const finalScore     = Math.min(100, blendedScore + fatiguePenalty);
    const finalLevel     = getScoreLevel(finalScore);

    // ── Step 4: Build final ScoringResult ────────────────────────────────
    const result: ScoringResult = {
      ...ruleResult,
      capped_score:    finalScore,
      level:           finalLevel,
      ml_score:        mlScore >= 0 ? mlScore : undefined,
      blend_alpha:     blendAlpha,
      fatigue_penalty: fatiguePenalty,
    };

    // ── Step 5: Train ML model on this session ────────────────────────────
    //   Label is derived automatically from the rule score:
    //     >=80  → 1.0  (definite high load)
    //     >=60  → 0.7  (elevated load)
    //     >=30  → 0.3  (mild load)
    //     < 30  → 0.0  (normal)
    const mlLabel =
      ruleScore >= 80 ? 1.0 :
      ruleScore >= 60 ? 0.7 :
      ruleScore >= 30 ? 0.3 : 0.0;
    this.mlScorer.update(rawFeatures, mlLabel);

    // ── Step 6: Record in temporal analyser ──────────────────────────────
    const sessionId = session.sessionId!;
    this.temporalAnalyser.record(sessionId, finalScore, finalLevel.label);

    // ── Step 7: Persist features + all score variants ─────────────────────
    const featPath = path.join(this.featuresDir, `${sessionId}_features.json`);
    try {
      const featuresWithScore = {
        ...features,
        // Final blended + temporal score (what the dashboard shows)
        cognitive_score:  result.capped_score,
        score_label:      result.level.label,
        // Rule engine breakdown (unchanged)
        rule_score:       ruleScore,
        typing_score:     ruleResult.category_scores.typing,
        error_score:      ruleResult.category_scores.error,
        context_score:    ruleResult.category_scores.context,
        session_score:    ruleResult.category_scores.session,
        reading_mode:     ruleResult.reading_mode,
        // ML layer info
        ml_score:         mlScore >= 0 ? mlScore : null,
        fatigue_penalty:  fatiguePenalty,
        blend_alpha:      blendAlpha,
      };
      fs.writeFileSync(featPath, JSON.stringify(featuresWithScore, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[IntelliDev Engine] Could not write features: ${e}`);
    }

    this.scoringHistory.push({
      timestamp:  new Date().toISOString(),
      session_id: sessionId,
      score:      result.capped_score,
      level:      result.level.label,
    });
    this.processed.add(filePath);

    const alerts = this.alertGen.generate(result, sessionId);
    if (alerts.length) {
      this._saveAlerts(alerts, sessionId);
      alerts.forEach(a => {
        console.log(`[IntelliDev Engine] Alert: ${a.level_emoji} ${a.alert_type} — ${a.message}`);
        this.onAlert?.(a);
      });
    }

    this.onScored?.(sessionId, result);

    const readingNote = result.reading_mode
      ? ' [reading mode — context dampened]' : '';
    const mlNote = mlScore >= 0 && blendAlpha > 0
      ? ` [ML blend ${Math.round(blendAlpha * 100)}%, ml=${mlScore}]` : '';
    const fatigueNote = fatiguePenalty > 0
      ? ` [fatigue +${fatiguePenalty}pts]` : '';
    console.log(
      `[IntelliDev Engine] Scored ${sessionId}: ` +
      `${result.level.emoji} ${result.level.label} (${result.capped_score.toFixed(1)}/100)` +
      `${readingNote}${mlNote}${fatigueNote}`
    );

    return result;
  }

  // ── Returns the blend weight for ML score (ramps from 0 to MAX_ALPHA) ──
  private _getBlendAlpha(): number {
    if (!this.mlScorer.isReady) { return 0; }
    const RAMP_SESSIONS = 50;
    const progress = (this.mlScorer.sessionCount - MLScorer.MIN_SESSIONS) / RAMP_SESSIONS;
    return Math.min(MLScorer.MAX_BLEND_ALPHA, progress * MLScorer.MAX_BLEND_ALPHA);
  }

  private _processExisting(): void {
    if (!fs.existsSync(this.sessionsDir)) { return; }
    const files = fs.readdirSync(this.sessionsDir)
      .filter((f: string) => f.startsWith('session_') && f.endsWith('.json'))
      .sort();

    for (const file of files) {
      const filePath    = path.join(this.sessionsDir, file);
      const sessionId   = file.replace('.json', '');
      const featuresOut = path.join(this.featuresDir, `${sessionId}_features.json`);

      if (fs.existsSync(featuresOut)) {
        try {
          const content = fs.readFileSync(featuresOut, 'utf-8').trim();
          if (content.length > 0) {
            JSON.parse(content);
            this.processed.add(filePath);
            continue;
          }
        } catch {
          console.warn(`[IntelliDev Engine] Corrupt features file, reprocessing: ${featuresOut}`);
          try { fs.unlinkSync(featuresOut); } catch {}
        }
      }
      this.processSessionFile(filePath);
    }
  }

  private _watchSessions(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    try {
      this.watcher = fs.watch(this.sessionsDir, { persistent: false }, (event: string, filename: string | null) => {
        if (!filename) { return; }
        if (!filename.startsWith('session_') || !filename.endsWith('.json')) { return; }

        const filePath = path.join(this.sessionsDir, filename);

        const existing = this.debounceMap.get(filePath);
        if (existing) { clearTimeout(existing); }

        const timer = setTimeout(() => {
          this.debounceMap.delete(filePath);
          this.processSessionFile(filePath);
        }, this.DEBOUNCE_MS);

        this.debounceMap.set(filePath, timer);
      });

      console.log(`[IntelliDev Engine] Watching: ${this.sessionsDir}`);
    } catch (e) {
      console.error(`[IntelliDev Engine] Could not watch sessions dir: ${e}`);
    }
  }

  private _saveAlerts(alerts: Alert[], sessionId: string): void {
    const alertPath = path.join(this.alertsDir, `${sessionId}_alerts.json`);
    let existing: Alert[] = [];
    if (fs.existsSync(alertPath)) {
      try { existing = JSON.parse(fs.readFileSync(alertPath, 'utf-8')); } catch {}
    }
    existing.push(...alerts);
    try {
      fs.writeFileSync(alertPath, JSON.stringify(existing, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[IntelliDev Engine] Could not write alerts: ${e}`);
    }
  }
}
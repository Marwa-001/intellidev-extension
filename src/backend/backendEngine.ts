/// <reference types="node" />
import * as fs   from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { extractFeatures, FeatureVector } from './featureExtractor';
import { computeScore, ScoringResult }    from './scorer';
import { AlertGenerator, Alert } from './alertGenerator';

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

  private readonly alertGen:    AlertGenerator;
  private readonly processed:   Set<string> = new Set();
  private watcher?:             fs.FSWatcher;
  private debounceMap:          Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly DEBOUNCE_MS  = 15_000;

  private scoringHistory: Array<{ timestamp: string; session_id: string; score: number; level: string }> = [];

  constructor(opts: BackendEngineOptions) {
    this.sessionsDir = opts.sessionsDir;
    this.featuresDir = opts.featuresDir;
    this.alertsDir   = opts.alertsDir;
    this.threshold   = opts.alertThreshold ?? 60;
    this.onAlert     = opts.onAlert;
    this.onScored    = opts.onScored;
    this.alertGen    = new AlertGenerator(opts.cooldownMs ?? 300_000);

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

    const result    = computeScore(features);
    const sessionId = session.sessionId;

    // ── Persist features JSON ────────────────────────────────────────────────
    // Include score fields + reading_mode so dashboardProvider can read them
    // directly without recomputing.
    const featPath = path.join(this.featuresDir, `${sessionId}_features.json`);
    try {
      const featuresWithScore = {
        ...features,
        cognitive_score:  result.capped_score,
        score_label:      result.level.label,
        typing_score:     result.category_scores.typing,
        error_score:      result.category_scores.error,
        context_score:    result.category_scores.context,
        session_score:    result.category_scores.session,
        // v0.1.5: reading_mode flag for dashboard chip
        reading_mode:     result.reading_mode,
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

    const readingNote = result.reading_mode ? ' [reading mode — context dampened]' : '';
    console.log(
      `[IntelliDev Engine] Scored ${sessionId}: ` +
      `${result.level.emoji} ${result.level.label} (${result.capped_score.toFixed(1)}/100)${readingNote}`
    );

    return result;
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
/**
 * backendEngine.ts
 * Replaces Python: watcher.py + engine.py + pipeline.py
 *
 * Responsibilities:
 *  - Watch the sessions directory for new / modified session JSON files
 *  - Extract features from each session (in-process, no child process)
 *  - Score features and generate alerts
 *  - Persist feature and alert JSON to disk (same layout as Python backend)
 *  - Fire onAlert callback so dashboardProvider can notify the user
 *
 * Pure Node.js — uses only built-in `fs` + VS Code API (for file-system events).
 * No Python, no external processes, no npm packages beyond what VS Code bundles.
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { extractFeatures, FeatureVector } from './featureExtractor';
import { computeScore, ScoringResult }    from './scorer';
import { AlertGenerator, Alert } from './alertGenerator';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BackendEngineOptions {
  sessionsDir:  string;
  featuresDir:  string;
  alertsDir:    string;
  alertThreshold?: number;   // default 60
  cooldownMs?:     number;   // default 300_000 (5 min)
  onAlert?:     (alert: Alert) => void;
  onScored?:    (sessionId: string, result: ScoringResult) => void;
}

// ── Engine ────────────────────────────────────────────────────────────────────

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
  private readonly DEBOUNCE_MS  = 15_000;   // wait 15s after last write

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

  // ── Lifecycle ───────────────────────────────────────────────────────────────

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

  // ── Public queries ──────────────────────────────────────────────────────────

  getLatestScore(): { session_id: string; score: number; level: string } | null {
    return this.scoringHistory.length
      ? { ...this.scoringHistory[this.scoringHistory.length - 1] }
      : null;
  }

  getAlertHistory(): Alert[] {
    return this.alertGen.getHistory();
  }

  // ── Process a single session file ──────────────────────────────────────────

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
    // Include the computed score fields so dashboardProvider can read them
    // directly — eliminates the duplicate scoring logic in the dashboard.
    const featPath = path.join(this.featuresDir, `${sessionId}_features.json`);
    try {
      const featuresWithScore = {
        ...features,
        // Score fields — dashboard reads these instead of recomputing
        cognitive_score:  result.capped_score,
        score_label:      result.level.label,
        typing_score:     result.category_scores.typing,
        error_score:      result.category_scores.error,
        context_score:    result.category_scores.context,
        session_score:    result.category_scores.session,
      };
      fs.writeFileSync(featPath, JSON.stringify(featuresWithScore, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[IntelliDev Engine] Could not write features: ${e}`);
    }

    // Record scoring history
    this.scoringHistory.push({
      timestamp:  new Date().toISOString(),
      session_id: sessionId,
      score:      result.capped_score,
      level:      result.level.label,
    });
    this.processed.add(filePath);

    // Generate & persist alerts
    const alerts = this.alertGen.generate(result, sessionId);
    if (alerts.length) {
      this._saveAlerts(alerts, sessionId);
      alerts.forEach(a => {
        console.log(`[IntelliDev Engine] Alert: ${a.level_emoji} ${a.alert_type} — ${a.message}`);
        this.onAlert?.(a);
      });
    }

    this.onScored?.(sessionId, result);

    console.log(
      `[IntelliDev Engine] Scored ${sessionId}: ` +
      `${result.level.emoji} ${result.level.label} (${result.capped_score.toFixed(1)}/100)`
    );

    return result;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _processExisting(): void {
    if (!fs.existsSync(this.sessionsDir)) { return; }
    const files = fs.readdirSync(this.sessionsDir)
      .filter(f => f.startsWith('session_') && f.endsWith('.json'))
      .sort();

    for (const file of files) {
      const filePath    = path.join(this.sessionsDir, file);
      const sessionId   = file.replace('.json', '');
      const featuresOut = path.join(this.featuresDir, `${sessionId}_features.json`);

      // Skip if already extracted — but validate the file is non-empty JSON
      // so corrupt/partial writes from a previous crash don't get silently skipped.
      if (fs.existsSync(featuresOut)) {
        try {
          const content = fs.readFileSync(featuresOut, 'utf-8').trim();
          if (content.length > 0) {
            JSON.parse(content); // throws if corrupt
            this.processed.add(filePath);
            continue;
          }
        } catch {
          // Corrupt features file — delete and reprocess
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
      this.watcher = fs.watch(this.sessionsDir, { persistent: false }, (event, filename) => {
        if (!filename) { return; }
        if (!filename.startsWith('session_') || !filename.endsWith('.json')) { return; }

        const filePath = path.join(this.sessionsDir, filename);

        // Debounce — wait until file stops being written
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
import * as vscode from 'vscode';
import * as path   from 'path';
import * as fs     from 'fs';

import { EventLogger }                    from './logger/eventLogger';
import { TypingTracker }                  from './telemetry/typingTracker';
import { ErrorTracker }                   from './telemetry/errorTracker';
import { ContextTracker }                 from './telemetry/contextTracker';
import { SessionTracker }                 from './telemetry/sessionTracker';
import { IntelliDevDashboardProvider }    from './dashboardProvider';
import { BaselineManager }                from './Baselinemanager';
import { BackendEngine }                  from './backend/backendEngine';
import type { Alert }                     from './backend/alertGenerator';
import type { ScoringResult }             from './backend/scorer';

// ── Module-level handles 
let logger:            EventLogger           | undefined;
let typingTracker:     TypingTracker         | undefined;
let errorTracker:      ErrorTracker          | undefined;
let contextTracker:    ContextTracker        | undefined;
let sessionTracker:    SessionTracker        | undefined;
let dashboardProvider: IntelliDevDashboardProvider | undefined;
let baselineManager:   BaselineManager       | undefined;
let backendEngine:     BackendEngine         | undefined;
let statusBarItem:     vscode.StatusBarItem  | undefined;
let isTracking = true;

// ── Path resolution (single source of truth)

function resolveDataPaths(context: vscode.ExtensionContext): {
  sessionsDir: string;
  dataDir:     string;
  featuresDir: string;
  alertsDir:   string;
} {
  const config     = vscode.workspace.getConfiguration('intellidev');
  const customPath = config.get<string>('dataPath')?.trim();

  let sessionsDir: string;

  if (customPath && customPath.length > 0) {
    sessionsDir = customPath;
  } else {
    sessionsDir = path.join(context.globalStorageUri.fsPath, 'sessions');
  }

  const dataDir     = path.dirname(sessionsDir);
  const featuresDir = path.join(dataDir, 'features');
  const alertsDir   = path.join(dataDir, 'alerts');

  [sessionsDir, featuresDir, alertsDir].forEach(d =>
    fs.mkdirSync(d, { recursive: true })
  );

  return { sessionsDir, dataDir, featuresDir, alertsDir };
}

// ── Status bar update helper
// Updates text, icon, color, and tooltip based on the latest score result.
// When paused, does nothing so the paused state is preserved.
function updateStatusBar(result: ScoringResult): void {
  if (!statusBarItem || !isTracking) { return; }

  const score = Math.round(result.capped_score);
  const label = result.level.label;
  const emoji = result.level.emoji;
  const rec   = result.level.recommendation;

  // Pick icon and background color based on score zone
  let icon: string;
  let bg: vscode.ThemeColor | undefined;

  if (score < 30) {
    // Stable Focus — normal pulse, no special background
    icon = '$(pulse)';
    bg   = undefined;
  } else if (score < 60) {
    // Mild Strain — slightly elevated
    icon = '$(pulse)';
    bg   = undefined;
  } else if (score < 80) {
    // High Cognitive Load — warning
    icon = '$(warning)';
    bg   = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    // Burnout Risk — error / urgent
    icon = '$(error)';
    bg   = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  statusBarItem.text             = `${icon} IntelliDev: ${label} (${score}/100)`;
  statusBarItem.backgroundColor  = bg;
  statusBarItem.tooltip          = new vscode.MarkdownString(
    `**IntelliDev — Cognitive Load**\n\n` +
    `${emoji} **${label}** — Score: \`${score}/100\`\n\n` +
    `💡 ${rec}\n\n` +
    `*Click to open dashboard*`
  );
  statusBarItem.command          = 'intellidev.openDashboard';
}

// ── Activate 
export function activate(context: vscode.ExtensionContext): void {
  console.log('[IntelliDev] Extension activating…');

  // ── 1. Baseline manager
  baselineManager = new BaselineManager(context);
  console.log(`[IntelliDev] User UUID: ${baselineManager.uuid}`);
  console.log(`[IntelliDev] Calibrated: ${baselineManager.isCalibrated} | Sessions: ${baselineManager.calibrationSessions}`);

  // ── 2. Resolve paths 
  const { sessionsDir, dataDir, featuresDir, alertsDir } = resolveDataPaths(context);
  console.log(`[IntelliDev] Sessions dir : ${sessionsDir}`);
  console.log(`[IntelliDev] Features dir : ${featuresDir}`);
  console.log(`[IntelliDev] Alerts dir   : ${alertsDir}`);

  const pruned = baselineManager.pruneOldSessions(featuresDir);
  if (pruned > 0) {
    console.log(`[IntelliDev] Pruned ${pruned} session(s) older than 90 days.`);
  }

  // ── 3. Core telemetry trackers
  logger         = new EventLogger(context, sessionsDir);
  typingTracker  = new TypingTracker(logger);
  errorTracker   = new ErrorTracker(logger);
  contextTracker = new ContextTracker(logger);
  sessionTracker = new SessionTracker(logger);

  // ── 4. Backend engine 
  backendEngine = new BackendEngine({
    sessionsDir,
    featuresDir,
    alertsDir,
    alertThreshold: 60,
    cooldownMs:     300_000,

    // Alerts are now surfaced silently via the status bar.
    // They are still written to the alerts directory (for the dashboard history view)
    // and logged to the console — only the intrusive popup is removed.
    onAlert: (alert: Alert) => {
      console.log(
        `[IntelliDev] Alert (${alert.alert_type}): ${alert.level_emoji} ${alert.message}`
      );
      dashboardProvider?.refresh();
    },

    onScored: (_sessionId, result: ScoringResult) => {
      // Update the status bar silently whenever a new score is produced
      updateStatusBar(result);
      dashboardProvider?.refresh();
    },
  });

  backendEngine.start();

  // ── 5. Sidebar dashboard
  dashboardProvider = new IntelliDevDashboardProvider(
    context.extensionUri,
    baselineManager,
    dataDir,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      IntelliDevDashboardProvider.viewType,
      dashboardProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('intellidev.dataPath')) {
        vscode.window.showInformationMessage(
          'IntelliDev: dataPath changed — please reload the window to apply.'
        );
      }
    })
  );

  // ── 6. Status bar 
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text    = '$(pulse) IntelliDev';
  statusBarItem.tooltip = 'IntelliDev: Cognitive load tracking active. Click to open dashboard.';
  statusBarItem.command = 'intellidev.openDashboard';
  statusBarItem.show();

  // Initialise context key — sidebar menu reads this to show pause vs resume
  vscode.commands.executeCommand('setContext', 'intellidev.paused', false);

  // ── 7. Commands 

  const cmds: vscode.Disposable[] = [

    vscode.commands.registerCommand('intellidev.openDashboard', () =>
      vscode.commands.executeCommand('intellidev.dashboard.focus')
    ),

    vscode.commands.registerCommand('intellidev.pauseTracking', () => {
      if (!isTracking) { return; }
      isTracking = false;
      typingTracker?.dispose();
      errorTracker?.dispose();
      contextTracker?.dispose();

      // Update context key so the sidebar swaps to the resume button
      vscode.commands.executeCommand('setContext', 'intellidev.paused', true);

      if (statusBarItem) {
        statusBarItem.text            = '$(circle-slash) IntelliDev: Paused';
        statusBarItem.tooltip         = 'IntelliDev tracking paused. Click to resume.';
        statusBarItem.command         = 'intellidev.resumeTracking';
        statusBarItem.backgroundColor = undefined; // clear any score-based color
      }
      vscode.window.showInformationMessage('IntelliDev: Tracking paused.');
    }),

    vscode.commands.registerCommand('intellidev.resumeTracking', () => {
      if (isTracking || !logger) { return; }
      isTracking     = true;
      typingTracker  = new TypingTracker(logger);
      errorTracker   = new ErrorTracker(logger);
      contextTracker = new ContextTracker(logger);

      // Update context key so the sidebar swaps back to the pause button
      vscode.commands.executeCommand('setContext', 'intellidev.paused', false);

      // Restore the status bar to the last known score if available,
      // otherwise fall back to the idle default
      const latest = backendEngine?.getLatestScore();
      if (statusBarItem) {
        if (latest) {
          // Re-apply the last score visually so the bar isn't blank after resuming
          const score = Math.round(latest.score);
          let icon    = score < 60 ? '$(pulse)' : score < 80 ? '$(warning)' : '$(error)';
          let bg: vscode.ThemeColor | undefined =
            score >= 80 ? new vscode.ThemeColor('statusBarItem.errorBackground') :
            score >= 60 ? new vscode.ThemeColor('statusBarItem.warningBackground') :
            undefined;
          statusBarItem.text            = `${icon} IntelliDev: ${latest.level} (${score}/100)`;
          statusBarItem.backgroundColor = bg;
          statusBarItem.tooltip         = 'IntelliDev: Tracking resumed. Click to open dashboard.';
          statusBarItem.command         = 'intellidev.openDashboard';
        } else {
          statusBarItem.text            = '$(pulse) IntelliDev';
          statusBarItem.tooltip         = 'IntelliDev: Cognitive load tracking active. Click to open dashboard.';
          statusBarItem.command         = 'intellidev.openDashboard';
          statusBarItem.backgroundColor = undefined;
        }
      }
      vscode.window.showInformationMessage('IntelliDev: Tracking resumed.');
    }),

    vscode.commands.registerCommand('intellidev.refreshDashboard', () =>
      dashboardProvider?.refresh()
    ),

    vscode.commands.registerCommand('intellidev.showDashboard', () => {
      if (!logger) { return; }
      const logPath = logger.getLogFilePath();
      vscode.window.showInformationMessage(`IntelliDev: Session log → ${logPath}`, 'Open File')
        .then(sel => {
          if (sel === 'Open File') {
            vscode.workspace.openTextDocument(logPath)
              .then(doc => vscode.window.showTextDocument(doc));
          }
        });
    }),

    vscode.commands.registerCommand('intellidev.getSnapshot', () => {
      if (!typingTracker || !errorTracker || !contextTracker || !sessionTracker) {
        vscode.window.showWarningMessage('IntelliDev: Trackers not initialized.');
        return;
      }
      const t   = typingTracker.getSnapshot();
      const e   = errorTracker.getSnapshot();
      const c   = contextTracker.getSnapshot();
      const s   = sessionTracker.getSnapshot();
      const cal = baselineManager?.isCalibrated
        ? 'Baseline active'
        : `Calibrating (${Math.round((baselineManager?.calibrationProgress ?? 0) * 100)}%)`;
      const latest = backendEngine?.getLatestScore();
      const scoreStr = latest
        ? `Score: ${latest.score.toFixed(0)}/100 (${latest.level})`
        : 'Score: pending';
      const msg = [
        `KPM: ${t.kpm}`,
        `Variability: ${t.variability.toFixed(1)}ms`,
        `Backspaces: ${t.backspaceCount}`,
        `Errors: ${e.lastErrorCount}`,
        `Switches: ${c.switchFrequency}/10min`,
        `Session: ${Math.floor(s.sessionDurationMs / 60000)}min`,
        `Night: ${s.isNightSession ? 'Yes' : 'No'}`,
        cal,
        scoreStr,
      ].join(' | ');
      vscode.window.showInformationMessage(`IntelliDev → ${msg}`);
    }),

  ];

  context.subscriptions.push(...cmds, statusBarItem);

  vscode.window.showInformationMessage('IntelliDev: Cognitive load tracking started.');
  console.log(`[IntelliDev] Session started. Log: ${logger.getLogFilePath()}`);
}

// ── Deactivate 

export function deactivate(): void {
  console.log('[IntelliDev] Deactivating…');
  typingTracker?.dispose();
  errorTracker?.dispose();
  contextTracker?.dispose();
  sessionTracker?.dispose();
  logger?.dispose();
  backendEngine?.dispose();
  console.log('[IntelliDev] All trackers and engine disposed. Session data saved.');
}
import * as vscode from 'vscode';
import { EventLogger } from '../logger/eventLogger';
import { getCurrentTimestamp, isNightTime, formatDuration } from '../utils/timeUtils';

interface SessionSnapshot {
  sessionDurationMs: number;
  idleTimeMs: number;
  activeTimeMs: number;
  idleRatio: number;
  isNightSession: boolean;
  nightTimeMinutes: number;
  longestDeepWorkMs: number;
  currentDeepWorkMs: number;
}

export class SessionTracker {
  private disposables: vscode.Disposable[] = [];
  private sessionStartTime: number;
  private lastActivityTime: number;
  private idleTimeMs: number = 0;
  private idleThresholdMs: number = 120000; // 2 minutes = idle
  private isIdle: boolean = false;
  private idleStartTime: number = 0;
  private nightTimeMinutes: number = 0;
  private nightCheckInterval: NodeJS.Timeout | undefined;
  private sessionLogInterval: NodeJS.Timeout | undefined;
  private longestDeepWorkMs: number = 0;
  private deepWorkStartTime: number;
  private readonly LOG_INTERVAL_MS = 60000; // log every 1 minute
  private readonly NIGHT_CHECK_INTERVAL_MS = 60000; // check night time every 1 minute

  constructor(private logger: EventLogger) {
    this.sessionStartTime = getCurrentTimestamp();
    this.lastActivityTime = this.sessionStartTime;
    this.deepWorkStartTime = this.sessionStartTime;

    this.startNightTimeTracking();
    this.startPeriodicLogging();
    this.registerActivityListeners();
  }

  private registerActivityListeners(): void {
    // Any of these events = developer is active
    const onActivity = () => this.recordActivity();

    const listeners = [
      vscode.workspace.onDidChangeTextDocument(() => onActivity()),
      vscode.window.onDidChangeActiveTextEditor(() => onActivity()),
      vscode.window.onDidChangeTextEditorSelection(() => onActivity())
    ];

    this.disposables.push(...listeners);
  }

  private recordActivity(): void {
    const now = getCurrentTimestamp();

    if (this.isIdle) {
      // Coming back from idle
      const idleDuration = now - this.idleStartTime;
      this.idleTimeMs += idleDuration;

      this.logger.log('idle', {
        idleDurationMs: idleDuration,
        idleDurationFormatted: formatDuration(idleDuration),
        totalIdleTimeMs: this.idleTimeMs,
        triggeredBy: 'activity_resumed'
      });

      this.isIdle = false;
      // Reset deep work timer after idle
      this.deepWorkStartTime = now;
    }

    this.lastActivityTime = now;
    this.scheduleIdleCheck();
  }

  private idleCheckTimeout: NodeJS.Timeout | undefined;

  private scheduleIdleCheck(): void {
    if (this.idleCheckTimeout) {
      clearTimeout(this.idleCheckTimeout);
    }

    this.idleCheckTimeout = setTimeout(() => {
      const now = getCurrentTimestamp();
      const timeSinceActivity = now - this.lastActivityTime;

      if (timeSinceActivity >= this.idleThresholdMs && !this.isIdle) {
        this.isIdle = true;
        this.idleStartTime = now;

        // Record deep work block that just ended
        const deepWorkDuration = now - this.deepWorkStartTime;
        if (deepWorkDuration > this.longestDeepWorkMs) {
          this.longestDeepWorkMs = deepWorkDuration;
        }

        this.logger.log('idle', {
          idleDurationMs: 0,
          idleDurationFormatted: '0s',
          totalIdleTimeMs: this.idleTimeMs,
          triggeredBy: 'idle_detected',
          deepWorkBlockMs: deepWorkDuration,
          deepWorkBlockFormatted: formatDuration(deepWorkDuration)
        });
      }
    }, this.idleThresholdMs);
  }

  private startNightTimeTracking(): void {
    this.nightCheckInterval = setInterval(() => {
      if (isNightTime()) {
        this.nightTimeMinutes++;
      }
    }, this.NIGHT_CHECK_INTERVAL_MS);
  }

  private startPeriodicLogging(): void {
    this.sessionLogInterval = setInterval(() => {
      const snapshot = this.getSnapshot();

      this.logger.log('session', {
        sessionDurationMs: snapshot.sessionDurationMs,
        sessionDurationFormatted: formatDuration(snapshot.sessionDurationMs),
        idleTimeMs: snapshot.idleTimeMs,
        activeTimeMs: snapshot.activeTimeMs,
        idleRatio: parseFloat(snapshot.idleRatio.toFixed(3)),
        isNightSession: snapshot.isNightSession,
        nightTimeMinutes: snapshot.nightTimeMinutes,
        longestDeepWorkMs: snapshot.longestDeepWorkMs,
        longestDeepWorkFormatted: formatDuration(snapshot.longestDeepWorkMs),
        currentDeepWorkMs: snapshot.currentDeepWorkMs,
        currentDeepWorkFormatted: formatDuration(snapshot.currentDeepWorkMs)
      });
    }, this.LOG_INTERVAL_MS);
  }

  public getSnapshot(): SessionSnapshot {
    const now = getCurrentTimestamp();
    const sessionDurationMs = now - this.sessionStartTime;

    // If currently idle, add current idle duration
    const currentIdleMs = this.isIdle ? now - this.idleStartTime : 0;
    const totalIdleMs = this.idleTimeMs + currentIdleMs;
    const activeTimeMs = sessionDurationMs - totalIdleMs;
    const idleRatio = sessionDurationMs > 0 ? totalIdleMs / sessionDurationMs : 0;

    const currentDeepWorkMs = this.isIdle ? 0 : now - this.deepWorkStartTime;

    return {
      sessionDurationMs,
      idleTimeMs: totalIdleMs,
      activeTimeMs,
      idleRatio,
      isNightSession: isNightTime(),
      nightTimeMinutes: this.nightTimeMinutes,
      longestDeepWorkMs: this.longestDeepWorkMs,
      currentDeepWorkMs
    };
  }

  public dispose(): void {
    if (this.nightCheckInterval) clearInterval(this.nightCheckInterval);
    if (this.sessionLogInterval) clearInterval(this.sessionLogInterval);
    if (this.idleCheckTimeout) clearTimeout(this.idleCheckTimeout);
    this.disposables.forEach(d => d.dispose());
  }
}
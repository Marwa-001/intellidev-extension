import * as vscode from 'vscode';
import { EventLogger } from '../logger/eventLogger';
import { getCurrentTimestamp } from '../utils/timeUtils';

interface ErrorBurst {
  startTime: number;
  errorCount: number;
}

export class ErrorTracker {
  private disposables: vscode.Disposable[] = [];
  private errorTimestamps: number[] = [];
  private windowDurationMs: number = 600000; // 10 minute window
  private burstThreshold: number = 5; // 5+ errors in window = burst
  private currentBurst: ErrorBurst | null = null;
  private lastErrorCount: number = 0;

  constructor(private logger: EventLogger) {
    this.register();
  }

  private register(): void {
    // Listen to diagnostics changes (compilation errors, linter errors)
    const diagnosticDisposable = vscode.languages.onDidChangeDiagnostics((event) => {
      const now = getCurrentTimestamp();

      let totalErrors = 0;
      let totalWarnings = 0;
      const affectedFiles: string[] = [];

      for (const uri of event.uris) {
        const diagnostics = vscode.languages.getDiagnostics(uri);

        const errors = diagnostics.filter(
          d => d.severity === vscode.DiagnosticSeverity.Error
        );
        const warnings = diagnostics.filter(
          d => d.severity === vscode.DiagnosticSeverity.Warning
        );

        if (errors.length > 0) {
          affectedFiles.push(uri.fsPath);
        }

        totalErrors += errors.length;
        totalWarnings += warnings.length;
      }

      // Only log if error count actually changed
      if (totalErrors === this.lastErrorCount) return;
      this.lastErrorCount = totalErrors;

      // Record timestamp for rate calculation
      if (totalErrors > 0) {
        this.errorTimestamps.push(now);
        this.cleanOldTimestamps(now);
      }

      const errorRate = this.calculateErrorRate();
      const isBurst = this.detectBurst(now, totalErrors);

      this.logger.log('error', {
        totalErrors,
        totalWarnings,
        errorRate,
        isBurst,
        affectedFileCount: affectedFiles.length
      });
    });

    // Track debug session starts as a cognitive signal
    const debugStartDisposable = vscode.debug.onDidStartDebugSession((session) => {
      this.logger.log('debug', {
        sessionType: session.type,
        sessionName: session.name,
        errorCountAtStart: this.lastErrorCount
      });
    });

    const debugStopDisposable = vscode.debug.onDidTerminateDebugSession((session) => {
      this.logger.log('debug', {
        sessionType: session.type,
        sessionName: session.name,
        event: 'terminated'
      });
    });

    this.disposables.push(diagnosticDisposable, debugStartDisposable, debugStopDisposable);
  }

  private cleanOldTimestamps(now: number): void {
    const cutoff = now - this.windowDurationMs;
    this.errorTimestamps = this.errorTimestamps.filter(t => t >= cutoff);
  }

  private calculateErrorRate(): number {
    // Errors per 10 minutes
    return this.errorTimestamps.length;
  }

  private detectBurst(now: number, currentErrors: number): boolean {
    if (currentErrors >= this.burstThreshold) {
      if (!this.currentBurst) {
        this.currentBurst = {
          startTime: now,
          errorCount: currentErrors
        };
      } else {
        this.currentBurst.errorCount = currentErrors;
      }
      return true;
    } else {
      if (this.currentBurst) {
        // Burst ended
        const burstDuration = now - this.currentBurst.startTime;
        this.logger.log('error', {
          totalErrors: 0,
          totalWarnings: 0,
          errorRate: 0,
          isBurst: false,
          burstEnded: true,
          burstDurationMs: burstDuration,
          peakErrorCount: this.currentBurst.errorCount,
          affectedFileCount: 0
        });
        this.currentBurst = null;
      }
      return false;
    }
  }

  public getSnapshot(): { errorRate: number; lastErrorCount: number; inBurst: boolean } {
    return {
      errorRate: this.calculateErrorRate(),
      lastErrorCount: this.lastErrorCount,
      inBurst: this.currentBurst !== null
    };
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
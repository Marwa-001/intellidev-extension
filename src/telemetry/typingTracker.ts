import * as vscode from 'vscode';
import { EventLogger } from '../logger/eventLogger';
import { getCurrentTimestamp } from '../utils/timeUtils';

export class TypingTracker {
  private disposables: vscode.Disposable[] = [];
  private keystrokeTimestamps: number[] = [];
  private backspaceCount: number = 0;
  private lastKeystrokeTime: number = 0;
  private pauseThresholdMs: number = 2000; // 2 seconds = pause
  private windowDurationMs: number = 60000; // 1 minute sliding window
  private pauseLogged: boolean = false;

  constructor(private logger: EventLogger) {
    this.register();
  }

  private register(): void {
    // Track every text document change
    const textChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme !== 'file') return; // ignore non-file buffers
      
      const changes = event.contentChanges;
      if (changes.length === 0) return;

      const now = getCurrentTimestamp();

      for (const change of changes) {
        const isBackspace =
          change.text === '' && change.rangeLength > 0;

        const isNewline = change.text === '\n' || change.text === '\r\n';

        if (isBackspace) {
          this.backspaceCount++;
          this.logger.log('backspace', {
            count: this.backspaceCount,
            rangeLength: change.rangeLength
          });
        } else if (!isNewline && change.text.length > 0) {
          this.keystrokeTimestamps.push(now);
          this.cleanOldTimestamps(now);

          const kpm = this.calculateKPM();
          const variability = this.calculateVariability();

          this.logger.log('keystroke', {
            kpm,
            variability,
            backspaceCount: this.backspaceCount
          });

          this.pauseLogged = false;
        }

        // Detect pause after last keystroke
        if (this.lastKeystrokeTime > 0) {
          const gap = now - this.lastKeystrokeTime;
          if (gap > this.pauseThresholdMs && !this.pauseLogged) {
            this.logger.log('pause', {
              durationMs: gap,
              kpmBeforePause: this.calculateKPM()
            });
            this.pauseLogged = true;
          }
        }

        this.lastKeystrokeTime = now;
      }
    });

    this.disposables.push(textChangeDisposable);
  }

  private cleanOldTimestamps(now: number): void {
    const cutoff = now - this.windowDurationMs;
    this.keystrokeTimestamps = this.keystrokeTimestamps.filter(t => t >= cutoff);
  }

  private calculateKPM(): number {
    return this.keystrokeTimestamps.length; // count in last 60 seconds = KPM
  }

  private calculateVariability(): number {
    if (this.keystrokeTimestamps.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < this.keystrokeTimestamps.length; i++) {
      intervals.push(this.keystrokeTimestamps[i] - this.keystrokeTimestamps[i - 1]);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    return Math.sqrt(variance); // standard deviation in ms
  }

  public getSnapshot(): { kpm: number; variability: number; backspaceCount: number } {
    return {
      kpm: this.calculateKPM(),
      variability: this.calculateVariability(),
      backspaceCount: this.backspaceCount
    };
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
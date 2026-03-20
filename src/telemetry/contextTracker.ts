import * as vscode from 'vscode';
import { EventLogger } from '../logger/eventLogger';
import { getCurrentTimestamp } from '../utils/timeUtils';

interface FileVisit {
  filePath: string;
  enteredAt: number;
  exitedAt?: number;
}

export class ContextTracker {
  private disposables: vscode.Disposable[] = [];
  private switchTimestamps: number[] = [];
  private windowDurationMs: number = 600000; // 10 minute window
  private currentFile: string | null = null;
  private currentVisit: FileVisit | null = null;
  private fileVisitHistory: FileVisit[] = [];
  private rapidSwitchThresholdMs: number = 5000; // under 5 seconds = rapid switch
  private rapidSwitchCount: number = 0;

  constructor(private logger: EventLogger) {
    this.register();
  }

  private register(): void {
    // Track active editor changes (file switches)
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      const now = getCurrentTimestamp();

      // Close out previous visit
      if (this.currentVisit) {
        this.currentVisit.exitedAt = now;
        const timeSpent = now - this.currentVisit.enteredAt;

        // Detect rapid switch
        if (timeSpent < this.rapidSwitchThresholdMs) {
          this.rapidSwitchCount++;
        }

        this.fileVisitHistory.push(this.currentVisit);

        // Keep history manageable
        if (this.fileVisitHistory.length > 100) {
          this.fileVisitHistory.shift();
        }
      }

      if (!editor) {
        this.currentFile = null;
        this.currentVisit = null;
        return;
      }

      const newFile = editor.document.uri.fsPath;

      // Only count actual file switches
      if (newFile === this.currentFile) return;

      // Record switch timestamp
      this.switchTimestamps.push(now);
      this.cleanOldTimestamps(now);

      const switchFrequency = this.calculateSwitchFrequency();
      const isRapid = this.currentVisit
        ? (now - this.currentVisit.enteredAt) < this.rapidSwitchThresholdMs
        : false;

      this.logger.log('fileSwitch', {
        switchFrequency,
        isRapidSwitch: isRapid,
        rapidSwitchCount: this.rapidSwitchCount,
        uniqueFilesInWindow: this.getUniqueFilesInWindow(),
        timeOnPreviousFileMs: this.currentVisit
          ? now - this.currentVisit.enteredAt
          : 0
      });

      // Start new visit
      this.currentFile = newFile;
      this.currentVisit = {
        filePath: newFile,
        enteredAt: now
      };
    });

    // Track tab group changes
    const tabChangeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      const now = getCurrentTimestamp();
      this.logger.log('fileSwitch', {
        visibleEditorCount: editors.length,
        switchFrequency: this.calculateSwitchFrequency(),
        isRapidSwitch: false,
        rapidSwitchCount: this.rapidSwitchCount,
        uniqueFilesInWindow: this.getUniqueFilesInWindow(),
        timeOnPreviousFileMs: 0
      });
    });

    this.disposables.push(editorChangeDisposable, tabChangeDisposable);
  }

  private cleanOldTimestamps(now: number): void {
    const cutoff = now - this.windowDurationMs;
    this.switchTimestamps = this.switchTimestamps.filter(t => t >= cutoff);
  }

  private calculateSwitchFrequency(): number {
    // File switches per 10 minutes
    return this.switchTimestamps.length;
  }

  private getUniqueFilesInWindow(): number {
    const cutoff = getCurrentTimestamp() - this.windowDurationMs;
    const recentVisits = this.fileVisitHistory.filter(v => v.enteredAt >= cutoff);
    const uniqueFiles = new Set(recentVisits.map(v => v.filePath));
    return uniqueFiles.size;
  }

  public getSnapshot(): {
    switchFrequency: number;
    rapidSwitchCount: number;
    uniqueFilesInWindow: number;
  } {
    return {
      switchFrequency: this.calculateSwitchFrequency(),
      rapidSwitchCount: this.rapidSwitchCount,
      uniqueFilesInWindow: this.getUniqueFilesInWindow()
    };
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
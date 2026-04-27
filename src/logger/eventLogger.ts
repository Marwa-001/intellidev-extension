import * as vscode from 'vscode';
import * as fs     from 'fs';
import * as path   from 'path';
import { getCurrentTimestamp, getSessionId } from '../utils/timeUtils';

export interface TelemetryEvent {
  timestamp:  number;
  sessionId:  string;
  eventType:  'keystroke' | 'backspace' | 'pause' | 'error' | 'debug' | 'fileSwitch' | 'idle' | 'session';
  data:       Record<string, number | string | boolean>;
}

export class EventLogger {
  private readonly sessionId:   string;
  private readonly logFilePath: string;
  private buffer:               TelemetryEvent[] = [];
  private flushInterval?:       ReturnType<typeof setInterval>;
  private readonly FLUSH_MS =   10_000;   // flush every 10 s

  
  constructor(_context: vscode.ExtensionContext, sessionsDir: string) {
    this.sessionId = getSessionId();

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    this.logFilePath = path.join(sessionsDir, `${this.sessionId}.json`);
    this._initLogFile();
    this._startFlush();
  }

  // ── Init 

  private _initLogFile(): void {
    const header = {
      sessionId: this.sessionId,
      startTime: getCurrentTimestamp(),
      events:    [],
    };
    fs.writeFileSync(this.logFilePath, JSON.stringify(header, null, 2), 'utf-8');
  }

  // ── Public API

  log(eventType: TelemetryEvent['eventType'], data: Record<string, number | string | boolean>): void {
    this.buffer.push({
      timestamp: getCurrentTimestamp(),
      sessionId: this.sessionId,
      eventType,
      data,
    });
  }

  getSessionId():   string { return this.sessionId;   }
  getLogFilePath(): string { return this.logFilePath; }

  dispose(): void {
    this._flush();   // final flush
    if (this.flushInterval) { clearInterval(this.flushInterval); }
  }

  // ── Internal 
  private _flush(): void {
    if (!this.buffer.length) { return; }
    try {
      const raw    = fs.readFileSync(this.logFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as { events: TelemetryEvent[] };
      parsed.events.push(...this.buffer);
      fs.writeFileSync(this.logFilePath, JSON.stringify(parsed, null, 2), 'utf-8');
      this.buffer = [];
    } catch (err) {
      console.error('[IntelliDev] Failed to flush log buffer:', err);
    }
  }

  private _startFlush(): void {
    this.flushInterval = setInterval(() => this._flush(), this.FLUSH_MS);
  }
}
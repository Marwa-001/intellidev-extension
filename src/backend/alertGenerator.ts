import type { ScoringResult } from './scorer';
import { getCurrentLocalTime } from '../utils/timeUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Alert {
  alert_id:        string;
  timestamp:       string;
  session_id:      string;
  score:           number;
  level_label:     string;
  level_emoji:     string;
  alert_type:      'overload' | 'burnout_risk' | 'long_session' | 'night_warning';
  message:         string;
  triggered_rules: string[];
  acknowledged:    boolean;
}

// ── Constants 
const NIGHT_WARNING_MIN_MINUTES = 15;
const NIGHT_COOLDOWN_MS         = 30 * 60 * 1000;  // 30 minutes

function localTimestamp(): string {
  const now     = new Date();
  const localMs = now.getTime() - (now.getTimezoneOffset() * 60 * 1000);
  return new Date(localMs).toISOString().replace('T', ' ').slice(0, 19);
}

// ── Message builders

function buildOverloadMessage(result: ScoringResult): string {
  const names        = result.triggered_rules.map(r => r.name);
  const hasErrors    = names.some(n => n.includes('error'));
  const hasSwitching = names.some(n => n.includes('switch'));
  const hasTyping    = names.some(n => n.includes('typing') || n.includes('backspace'));
  const hasSession   = names.some(n => n.includes('session') || n.includes('idle'));

  const signals: string[] = [];
  if (hasErrors)    { signals.push('repeated compilation errors'); }
  if (hasSwitching) { signals.push('frequent file switching'); }
  if (hasTyping)    { signals.push('unstable typing patterns'); }
  if (hasSession)   { signals.push('an extended coding session'); }
  if (!signals.length) { signals.push('elevated cognitive activity'); }

  const sig   = signals.slice(0, 2).join(' and ');
  const score = Math.round(result.capped_score);
  return `Cognitive load score: ${score}/100. Detected ${sig}. ${result.level.recommendation}`;
}

function buildBurnoutMessage(result: ScoringResult): string {
  const score = Math.round(result.capped_score);
  return `Burnout risk detected. Score: ${score}/100. Multiple high-strain signals active. Immediate break recommended.`;
}

function buildLongSessionMessage(durationMinutes: number): string {
  const h = Math.floor(durationMinutes / 60);
  const m = Math.round(durationMinutes % 60);
  const t = h > 0 && m > 0
    ? `${h} hour${h !== 1 ? 's' : ''} and ${m} minutes`
    : h > 0 ? `${h} hour${h !== 1 ? 's' : ''}` : `${m} minutes`;
  return `You have been coding for ${t}. Consider taking a short break to maintain focus quality.`;
}

function buildNightWarningMessage(nightMinutes: number): string {
  const mins                            = Math.round(nightMinutes);
  const { hour, minute, offsetMinutes } = getCurrentLocalTime();
  const sign   = offsetMinutes >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMinutes);
  const offStr = `UTC${sign}${Math.floor(absOff / 60)}${absOff % 60 !== 0 ? `:${String(absOff % 60).padStart(2, '0')}` : ''}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${offStr})`;
  return `Late-night coding detected — ${mins} min of activity after 10 pm or before 5 am. Current local time: ${timeStr}. Sleep disruption may affect tomorrow's performance.`;
}

// ── Alert generator 
export class AlertGenerator {
  private lastAlertTimes: Map<string, number> = new Map();
  private lastNightAlert: number = 0;
  private history:        Alert[] = [];
  private counter = 0;

  constructor(private cooldownMs = 300_000) {}

  private onCooldown(type: string): boolean {
    const last = this.lastAlertTimes.get(type) ?? 0;
    return Date.now() - last < this.cooldownMs;
  }

  private nightOnCooldown(): boolean {
    return Date.now() - this.lastNightAlert < NIGHT_COOLDOWN_MS;
  }

  private record(type: string): void {
    this.lastAlertTimes.set(type, Date.now());
  }

  private nextId(sessionId: string, type: string): string {
    return `${sessionId}_${type}_${++this.counter}`;
  }

  generate(result: ScoringResult, sessionId: string): Alert[] {
    const alerts:    Alert[] = [];
    // All alert timestamps use local time, not UTC
    const ts        = localTimestamp();
    const ruleNames = result.triggered_rules.map(r => r.name);

    // ── Burnout (score >= 80) 
    if (result.capped_score >= 80 && !this.onCooldown('burnout_risk')) {
      alerts.push({
        alert_id:        this.nextId(sessionId, 'burnout_risk'),
        timestamp:       ts,
        session_id:      sessionId,
        score:           result.capped_score,
        level_label:     result.level.label,
        level_emoji:     result.level.emoji,
        alert_type:      'burnout_risk',
        message:         buildBurnoutMessage(result),
        triggered_rules: ruleNames,
        acknowledged:    false,
      });
      this.record('burnout_risk');
    }
    // ── Overload (score 60-79) 
    else if (result.capped_score >= 60 && !this.onCooldown('overload')) {
      alerts.push({
        alert_id:        this.nextId(sessionId, 'overload'),
        timestamp:       ts,
        session_id:      sessionId,
        score:           result.capped_score,
        level_label:     result.level.label,
        level_emoji:     result.level.emoji,
        alert_type:      'overload',
        message:         buildOverloadMessage(result),
        triggered_rules: ruleNames,
        acknowledged:    false,
      });
      this.record('overload');
    }

    // ── Long session 
    const duration = Number(result.feature_snapshot.session_duration_minutes ?? 0);
    if (duration > 120 && !this.onCooldown('long_session')) {
      alerts.push({
        alert_id:        this.nextId(sessionId, 'long_session'),
        timestamp:       ts,
        session_id:      sessionId,
        score:           result.capped_score,
        level_label:     result.level.label,
        level_emoji:     result.level.emoji,
        alert_type:      'long_session',
        message:         buildLongSessionMessage(duration),
        triggered_rules: ['long_session'],
        acknowledged:    false,
      });
      this.record('long_session');
    }

    // ── Night warning - 30-minute independent cooldown
    const nightMins = Number(result.feature_snapshot.night_time_minutes ?? 0);
    if (nightMins >= NIGHT_WARNING_MIN_MINUTES && !this.nightOnCooldown()) {
      alerts.push({
        alert_id:        this.nextId(sessionId, 'night_warning'),
        timestamp:       ts,
        session_id:      sessionId,
        score:           result.capped_score,
        level_label:     result.level.label,
        level_emoji:     result.level.emoji,
        alert_type:      'night_warning',
        message:         buildNightWarningMessage(nightMins),
        triggered_rules: ['night_activity'],
        acknowledged:    false,
      });
      this.lastNightAlert = Date.now();
    }

    this.history.push(...alerts);
    return alerts;
  }

  getHistory(): Alert[] { return this.history; }

  acknowledge(alertId: string): boolean {
    const a = this.history.find(x => x.alert_id === alertId);
    if (a) { a.acknowledged = true; return true; }
    return false;
  }
}

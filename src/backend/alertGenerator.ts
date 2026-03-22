/**
 * alertGenerator.ts
 * Mirrors Python backend/inference_engine/alerts.py
 * Builds contextual alert messages and enforces cooldowns
 */

import type { ScoringResult } from './scorer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Alert {
  alert_id: string;
  timestamp: string;
  session_id: string;
  score: number;
  level_label: string;
  level_emoji: string;
  alert_type: 'overload' | 'burnout_risk' | 'long_session' | 'night_warning';
  message: string;
  triggered_rules: string[];
  acknowledged: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Minimum night-time minutes before a night warning fires.
// Prevents false alerts from sessions that start just before 5am or
// that have a small residual from a previous session's night block.
const NIGHT_WARNING_MIN_MINUTES = 15;

// ── Message builders ──────────────────────────────────────────────────────────

function buildOverloadMessage(result: ScoringResult): [string, string] {
  const names = result.triggered_rules.map(r => r.name);
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

  const message =
    `Cognitive load score: ${score}/100. Detected ${sig}. ${result.level.recommendation}`;

  return [message, message];
}

function buildBurnoutMessage(result: ScoringResult): [string, string] {
  const score = Math.round(result.capped_score);
  const message =
    `Burnout risk detected. Score: ${score}/100. Multiple high-strain signals active. Immediate break recommended.`;
  return [message, message];
}

function buildLongSessionMessage(durationMinutes: number): [string, string] {
  const h = Math.floor(durationMinutes / 60);
  const m = Math.round(durationMinutes % 60);
  const t = h > 0 && m > 0
    ? `${h} hour${h !== 1 ? 's' : ''} and ${m} minutes`
    : h > 0 ? `${h} hour${h !== 1 ? 's' : ''}` : `${m} minutes`;

  const message =
    `You have been coding for ${t}. Consider taking a short break to maintain focus quality.`;
  return [message, message];
}

function buildNightWarningMessage(nightMinutes: number): [string, string] {
  const mins    = Math.round(nightMinutes);
  const message =
    `Late-night coding detected (${mins} min after midnight or after 10 pm). Sleep disruption may affect tomorrow's performance.`;
  return [message, message];
}

// ── Alert generator ───────────────────────────────────────────────────────────

export class AlertGenerator {
  private lastAlertTimes: Map<string, number> = new Map();
  private history: Alert[] = [];
  private counter = 0;

  constructor(private cooldownMs = 300_000) {}

  private onCooldown(type: string): boolean {
    const last = this.lastAlertTimes.get(type) ?? 0;
    return Date.now() - last < this.cooldownMs;
  }

  private record(type: string): void {
    this.lastAlertTimes.set(type, Date.now());
  }

  private nextId(sessionId: string, type: string): string {
    return `${sessionId}_${type}_${++this.counter}`;
  }

  generate(result: ScoringResult, sessionId: string): Alert[] {
    const alerts: Alert[] = [];
    const ts       = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const ruleNames = result.triggered_rules.map(r => r.name);

    // ── Burnout (score ≥ 80) ───────────────────────────────────────────────
    if (result.capped_score >= 80 && !this.onCooldown('burnout_risk')) {
      const [message] = buildBurnoutMessage(result);
      alerts.push({
        alert_id:       this.nextId(sessionId, 'burnout_risk'),
        timestamp:      ts,
        session_id:     sessionId,
        score:          result.capped_score,
        level_label:    result.level.label,
        level_emoji:    result.level.emoji,
        alert_type:     'burnout_risk',
        message,
        triggered_rules: ruleNames,
        acknowledged:   false,
      });
      this.record('burnout_risk');
    }
    // ── Overload (score 60–79) ─────────────────────────────────────────────
    else if (result.capped_score >= 60 && !this.onCooldown('overload')) {
      const [message] = buildOverloadMessage(result);
      alerts.push({
        alert_id:       this.nextId(sessionId, 'overload'),
        timestamp:      ts,
        session_id:     sessionId,
        score:          result.capped_score,
        level_label:    result.level.label,
        level_emoji:    result.level.emoji,
        alert_type:     'overload',
        message,
        triggered_rules: ruleNames,
        acknowledged:   false,
      });
      this.record('overload');
    }

    // ── Long session ───────────────────────────────────────────────────────
    const duration = Number(result.feature_snapshot.session_duration_minutes ?? 0);
    if (duration > 120 && !this.onCooldown('long_session')) {
      const [message] = buildLongSessionMessage(duration);
      alerts.push({
        alert_id:       this.nextId(sessionId, 'long_session'),
        timestamp:      ts,
        session_id:     sessionId,
        score:          result.capped_score,
        level_label:    result.level.label,
        level_emoji:    result.level.emoji,
        alert_type:     'long_session',
        message,
        triggered_rules: ['long_session'],
        acknowledged:   false,
      });
      this.record('long_session');
    }

    // ── Night warning ──────────────────────────────────────────────────────
    // Guard: require at least NIGHT_WARNING_MIN_MINUTES of actual night-time
    // activity. This prevents false positives from:
    //   - Morning sessions that start at 4:58am (1–2 min of "night" classified)
    //   - Sessions that inherit a small residual from a previous night block
    const nightMins = Number(result.feature_snapshot.night_time_minutes ?? 0);
    if (nightMins >= NIGHT_WARNING_MIN_MINUTES && !this.onCooldown('night_warning')) {
      const [message] = buildNightWarningMessage(nightMins);
      alerts.push({
        alert_id:       this.nextId(sessionId, 'night_warning'),
        timestamp:      ts,
        session_id:     sessionId,
        score:          result.capped_score,
        level_label:    result.level.label,
        level_emoji:    result.level.emoji,
        alert_type:     'night_warning',
        message,
        triggered_rules: ['night_activity'],
        acknowledged:   false,
      });
      this.record('night_warning');
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

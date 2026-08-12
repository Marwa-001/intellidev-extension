export function getCurrentTimestamp(): number {
  return Date.now();
}

export function getCurrentHour(): number {
  return new Date().getHours();
}

export function getCurrentLocalTime(): { hour: number; minute: number; offsetMinutes: number } {
  const now = new Date();
  return {
    hour: now.getHours(),
    minute: now.getMinutes(),
    offsetMinutes: -now.getTimezoneOffset(), // getTimezoneOffset() is inverted (e.g. -300 for UTC+5)
  };
}

export function isNightTime(): boolean {
  const hour = getCurrentHour();
  // Night = 22:00 (10 PM) to 04:59 (5 AM) in local OS time
  return hour >= 22 || hour <= 4;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);

  if (hours > 0)   { return `${hours}h ${minutes % 60}m`; }
  if (minutes > 0) { return `${minutes}m ${seconds % 60}s`; }
  return `${seconds}s`;
}

export function getSessionId(): string {
  const now = new Date();
  const Y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const D = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `session_${Y}${M}${D}_${h}${m}${s}`;
}

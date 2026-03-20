export function getCurrentTimestamp(): number {
  return Date.now();
}

export function getCurrentHour(): number {
  return new Date().getHours();
}

export function isNightTime(): boolean {
  const hour = getCurrentHour();
  // Night = 22:00–04:59. Covers late-night coders AND early-morning sessions.
  // Previously was 0–4 only, which missed 10pm–midnight entirely.
  return hour >= 22 || hour <= 4;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) { return `${hours}h ${minutes % 60}m`; }
  if (minutes > 0) { return `${minutes}m ${seconds % 60}s`; }
  return `${seconds}s`;
}

export function getSessionId(): string {
  const now = new Date();
  return `session_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}
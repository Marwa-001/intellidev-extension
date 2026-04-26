function localDate(): Date {
  const now = new Date();
  const localMs = now.getTime() - (now.getTimezoneOffset() * 60 * 1000);
  return new Date(localMs);
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function getCurrentHour(): number {
  return localDate().getUTCHours();
}

export function getCurrentLocalTime(): { hour: number; minute: number; offsetMinutes: number } {
  const local         = localDate();
  const now           = new Date();
  const offsetMinutes = -now.getTimezoneOffset(); // getTimezoneOffset() is inverted
  return {
    hour:          local.getUTCHours(),
    minute:        local.getUTCMinutes(),
    offsetMinutes,
  };
}

export function isNightTime(): boolean {
  const hour = getCurrentHour();
  // Night = 22:00-04:59 local time
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
  // Use local time for session ID so filenames match the developer's clock,
  // not the UTC time that Node.js may default to in some environments.
  const local = localDate();
  const Y = local.getUTCFullYear();
  const M = String(local.getUTCMonth() + 1).padStart(2, '0');
  const D = String(local.getUTCDate()).padStart(2, '0');
  const h = String(local.getUTCHours()).padStart(2, '0');
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  const s = String(local.getUTCSeconds()).padStart(2, '0');
  return `session_${Y}${M}${D}_${h}${m}${s}`;
}

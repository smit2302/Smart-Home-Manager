export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const twoDigits = (value) => String(value).padStart(2, '0');

export function startOfDay(ms) {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function dateKey(ms) {
  const day = new Date(ms);
  return `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())}`;
}

export function minutesOfDay(ms) {
  const day = new Date(ms);
  return day.getHours() * 60 + day.getMinutes();
}

export function toTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${twoDigits(hours)}:${twoDigits(minutes)}`;
}

export function prettyTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hourOnClock = hours % 12 || 12;
  return `${hourOnClock}:${twoDigits(minutes)} ${suffix}`;
}

export function prettyDateTime(ms) {
  return new Date(ms).toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function prettyDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

// Returns the last seven calendar days (oldest first) ending on the given day.
export function lastSevenDays(ms) {
  const days = [];
  for (let back = 6; back >= 0; back -= 1) {
    const day = new Date(startOfDay(ms));
    day.setDate(day.getDate() - back);
    days.push({
      key: dateKey(day.getTime()),
      label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
    });
  }
  return days;
}

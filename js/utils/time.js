export function getToday() {
  const d = new Date();
  return dateKey(d);
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatShortDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatBlockTime(timeStr) {
  const { h, m } = parseTime(timeStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m };
}

export function timeToMinutes(timeStr) {
  const { h, m } = parseTime(timeStr);
  return h * 60 + m;
}

export function getCurrentScheduleBlock(schedule) {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  for (const block of schedule) {
    let startMin = timeToMinutes(block.start);
    let endMin = timeToMinutes(block.end);
    // handle midnight crossing
    if (endMin <= startMin) endMin += 24 * 60;

    let check = currentMin;
    if (check < startMin && endMin > 24 * 60) check += 24 * 60;

    if (check >= startMin && check < endMin) return block;
  }
  return null;
}

export function getSuggestedCheckpoint(checkpoints) {
  const h = new Date().getHours();
  for (const cp of checkpoints) {
    if (cp.startHour <= cp.endHour) {
      if (h >= cp.startHour && h < cp.endHour) return cp;
    } else {
      if (h >= cp.startHour || h < cp.endHour) return cp;
    }
  }
  return checkpoints[0];
}

export function isToday(dateStr) {
  return dateStr === getToday();
}

export function isSaturday() { return new Date().getDay() === 6; }
export function isSunday() { return new Date().getDay() === 0; }

export function getNextSunday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + diff);
  return dateKey(d);
}

export function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return dateKey(d);
}

export function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}

export function getLast30Days() {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

export function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

export function dayOfWeekLabel(dateStr) {
  return parseDateKey(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}

export function daysAgo(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseDateKey(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff}d ago`;
}

export function getWeekStart(dateStr) {
  const d = parseDateKey(dateStr);
  const day = d.getDay();
  // day === 0 is Sunday. We want Monday as the start of the week.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return dateKey(monday);
}

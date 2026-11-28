export function getToday() {
  return dateKey(new Date());
}

export function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

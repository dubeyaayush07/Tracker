const DB_NAME = 'tracker-db';
const DB_VERSION = 1;

let _db = null;

export async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('logs')) {
        const logs = db.createObjectStore('logs', { keyPath: 'id' });
        logs.createIndex('date', 'date', { unique: false });
        logs.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('reflections')) {
        const r = db.createObjectStore('reflections', { keyPath: 'id' });
        r.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains('plans')) {
        const p = db.createObjectStore('plans', { keyPath: 'id' });
        p.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = fn(store);
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }
  });
}

export const dbGet = (store, key) => tx(store, 'readonly', s => s.get(key));
export const dbGetAll = (store) => tx(store, 'readonly', s => s.getAll());
export const dbPut = (store, item) => tx(store, 'readwrite', s => s.put(item));
export const dbDelete = (store, key) => tx(store, 'readwrite', s => s.delete(key));
export const dbClear = (store) => tx(store, 'readwrite', s => s.clear());

export async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const req = store.index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Settings
export async function getSetting(key) {
  const result = await dbGet('settings', key);
  return result ? result.value : null;
}
export async function setSetting(key, value) {
  await dbPut('settings', { key, value });
}

// Defaults
export const DEFAULT_SCHEDULE = [
  { id: 's1', start: '09:00', end: '10:00', label: 'Start day' },
  { id: 's2', start: '10:00', end: '13:00', label: 'Work' },
  { id: 's3', start: '13:00', end: '14:00', label: 'Lunch' },
  { id: 's4', start: '14:00', end: '18:00', label: 'Work' },
  { id: 's5', start: '18:00', end: '19:00', label: 'Walk' },
  { id: 's6', start: '19:00', end: '20:30', label: 'Gym' },
  { id: 's7', start: '20:30', end: '21:30', label: 'Dinner' },
  { id: 's8', start: '21:30', end: '23:00', label: 'Gaming' },
  { id: 's9', start: '23:00', end: '00:00', label: 'Movie / Show' },
  { id: 's10', start: '00:00', end: '01:00', label: 'Book / Podcast' },
];

export const DEFAULT_CHECKPOINTS = [
  { id: 'morning', label: 'Morning', startHour: 7, endHour: 11 },
  { id: 'end_of_work', label: 'End of Work', startHour: 17, endHour: 19 },
  { id: 'after_gym', label: 'After Gym', startHour: 20, endHour: 22 },
  { id: 'before_sleep', label: 'Before Sleep', startHour: 22, endHour: 3 },
];

export async function getSchedule() {
  return (await getSetting('schedule')) || DEFAULT_SCHEDULE;
}

export async function getCheckpoints() {
  return (await getSetting('checkpoints')) || DEFAULT_CHECKPOINTS;
}

// Reflection helper: get by date
export async function getReflectionByDate(date) {
  const all = await dbGetAll('reflections');
  return all.find(r => r.date === date) || null;
}

// Plan helper: get by date
export async function getPlanByDate(date) {
  const all = await dbGetAll('plans');
  return all.find(p => p.date === date) || null;
}

// Clear-day streak (no slip)
export async function getClearDays() {
  const reflections = await dbGetAll('reflections');
  const slippedDays = new Set(
    reflections.filter(r => r.slipped).map(r => r.date)
  );
  // Count consecutive days from today backwards with no slips
  let count = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (slippedDays.has(key)) break;
    // Only count days that have a reflection (or today)
    if (i === 0 || reflections.find(r => r.date === key)) {
      count++;
    }
  }
  return count;
}

// Full export
export async function exportAllData() {
  const [logs, reflections, plans] = await Promise.all([
    dbGetAll('logs'),
    dbGetAll('reflections'),
    dbGetAll('plans'),
  ]);
  const schedule = await getSetting('schedule');
  const checkpoints = await getSetting('checkpoints');
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    logs,
    reflections,
    plans,
    settings: { schedule, checkpoints }
  };
}

// Full import
export async function importAllData(data) {
  await Promise.all([dbClear('logs'), dbClear('reflections'), dbClear('plans')]);
  for (const item of (data.logs || [])) await dbPut('logs', item);
  for (const item of (data.reflections || [])) await dbPut('reflections', item);
  for (const item of (data.plans || [])) await dbPut('plans', item);
  if (data.settings?.schedule) await setSetting('schedule', data.settings.schedule);
  if (data.settings?.checkpoints) await setSetting('checkpoints', data.settings.checkpoints);
}

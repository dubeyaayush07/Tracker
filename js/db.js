const DB_NAME = 'tracker-db';
const DB_VERSION = 3;

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
      if (!db.objectStoreNames.contains('weekly_goals')) {
        const wg = db.createObjectStore('weekly_goals', { keyPath: 'id' });
        wg.createIndex('week_start', 'week_start', { unique: true });
      }
      if (!db.objectStoreNames.contains('worries')) {
        const w = db.createObjectStore('worries', { keyPath: 'id' });
        w.createIndex('createdAt', 'createdAt', { unique: false });
        w.createIndex('stance', 'stance', { unique: false });
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

export const DEFAULT_INSIGHTS = [
  "The pain is because of the use, not the solution to it.",
  "Pleasure is not the goal. I've chased it before and regretted every time.",
  "I can't trust my thoughts till recovery. They make the fuck-it moment likely.",
  "The reward is tomorrow morning.",
  "Don't engage, don't act. Nothing is inevitable even when it feels like it.",
  "The craving uses the pain it created as an excuse to use again.",
  "After resisting, things reset. It's always better if I resist.",
  "If I'm honest, I don't really want it. I just want peace from the cravings.",
  "Logging helps. I was almost convinced, but logging stopped it.",
  "The more I resist, the stronger I get.",
  "Don't let decisions be made when you are most vulnerable.",
  "Sobriety is the priority, not performance.",
  "The automatic impulse only takes over if I let it. It depends on me.",
  "The negotiations seem innocent but they never are.",
  "It's not about blame. It's a misconfiguration that heals with time.",
  "The fear is useful. Not as punishment — but as fuel for vigilance.",
  "The answer isn't in a prediction. It's in what you do next Saturday. Keep showing up."
];

export async function getInsightsList() {
  return (await getSetting('insights')) || DEFAULT_INSIGHTS;
}

// Reflection helper: get by date
export async function getReflectionByDate(date) {
  const all = await dbGetAll('reflections');
  return all.find(r => r.date === date) || null;
}

// Worries helpers
export async function deleteWorry(id) {
  await dbDelete('worries', id);
}

export async function getWorriesByDate(date) {
  const all = await dbGetAll('worries');
  return all.filter(w => {
    if (w.date === date) return true;
    if (!w.date && w.createdAt) {
      const d = new Date(w.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === date;
    }
    return false;
  }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// Full export (preserves all historical stores for backup compatibility)
export async function exportAllData() {
  const [logs, reflections, plans, weekly_goals, worries] = await Promise.all([
    dbGetAll('logs'),
    dbGetAll('reflections'),
    dbGetAll('plans'),
    dbGetAll('weekly_goals'),
    dbGetAll('worries'),
  ]);
  const schedule = await getSetting('schedule');
  const checkpoints = await getSetting('checkpoints');
  const insights = await getSetting('insights');
  const baseline_routine = await getSetting('baseline_routine');
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    logs,
    reflections,
    plans,
    weekly_goals,
    worries,
    settings: { schedule, checkpoints, insights, baseline_routine }
  };
}

// Full import (preserves all historical stores for backup compatibility)
export async function importAllData(data) {
  await Promise.all([dbClear('logs'), dbClear('reflections'), dbClear('plans'), dbClear('weekly_goals'), dbClear('worries')]);
  for (const item of (data.logs || [])) await dbPut('logs', item);
  for (const item of (data.reflections || [])) await dbPut('reflections', item);
  for (const item of (data.plans || [])) await dbPut('plans', item);
  for (const item of (data.weekly_goals || [])) await dbPut('weekly_goals', item);
  for (const item of (data.worries || [])) await dbPut('worries', item);
  if (data.settings?.schedule) await setSetting('schedule', data.settings.schedule);
  if (data.settings?.checkpoints) await setSetting('checkpoints', data.settings.checkpoints);
  if (data.settings?.insights) await setSetting('insights', data.settings.insights);
  if (data.settings?.baseline_routine) await setSetting('baseline_routine', data.settings.baseline_routine);
}

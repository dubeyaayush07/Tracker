import { dbGetAll, generateId, getInsightsList, dbPut, getWorriesByDate, getSetting } from '../db.js';
import { getToday, formatDate } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

export async function renderToday(container) {
  const today = getToday();
  const now = new Date();
  const dateStr = formatDate(now);
  const dayPart = dateStr.split(',')[0];
  const restDate = dateStr.split(',').slice(1).join(',').trim();

  const [allReflections, insights, todayWorries, lastBackup] = await Promise.all([
    dbGetAll('reflections'),
    getInsightsList(),
    getWorriesByDate(today),
    getSetting('last_backup'),
  ]);

  const reflection = allReflections.find(r => r.date === today) || null;
  const dailyInsight = insights.length > 0 ? insights[Math.floor(Math.random() * insights.length)] : null;

  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null;
  const showBackupNudge = allReflections.length >= 3 && (daysSinceBackup === null || daysSinceBackup >= 14);
  const backupNudgeText = daysSinceBackup === null
    ? 'No backup yet — tap to export your data'
    : `Last backup ${daysSinceBackup}d ago — tap to export`;

  const reflectPrompt = !reflection ? `
    <div class="reflect-prompt" id="reflect-prompt-btn">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--warning-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:0.9375rem">Daily Reflection</div>
        <div style="font-size:0.8125rem;color:var(--text-2);margin-top:1px">How did today go?</div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3)"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  ` : `
    <div class="reflect-prompt" id="reflect-prompt-btn" style="opacity:0.75">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--success-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:0.9375rem">Daily Reflection complete</div>
        <div style="font-size:0.8125rem;color:var(--text-2);margin-top:1px">Tap to view or update</div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3)"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `;

  container.innerHTML = `
    <div class="view-enter" style="padding-bottom:32px;">
      ${dailyInsight ? `
        <div style="padding:16px 16px 0;text-align:center">
          <div style="font-style:italic;color:var(--text-2);font-size:0.875rem;background:var(--bg-2);padding:12px;border-radius:12px;border:1px solid var(--border)">
            "${dailyInsight}"
          </div>
        </div>
      ` : ''}

      <!-- Header -->
      <div class="today-hero" style="padding-top:16px;">
        <div>
          <div class="today-date">${restDate}</div>
          <div class="today-day">${dayPart}</div>
        </div>
      </div>

      ${reflectPrompt}

      <!-- Worry Log -->
      <div class="section-header" style="margin-top:4px">
        <span class="section-title">Worry Log</span>
        ${todayWorries.length > 0 ? `<span style="font-size:0.75rem;color:var(--text-3);margin-right:16px">${todayWorries.length} noted today</span>` : ''}
      </div>
      <div class="checkpoints-section" style="padding:14px 16px;margin-top:0">
        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
          <input type="text" id="worry-input" placeholder="What's really sticking? (High intensity)" style="flex:1;min-width:0;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:0.875rem">
          <button id="worry-add-btn" class="btn" style="width:42px;height:42px;min-width:42px;padding:0;background:var(--primary);color:#fff;border-radius:var(--radius-sm);flex-shrink:0;box-shadow:0 2px 8px var(--primary-glow);display:inline-flex;align-items:center;justify-content:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:0.75rem;color:var(--text-3);white-space:nowrap">Peak Intensity</span>
          <input type="range" id="worry-intensity" min="0" max="10" value="0" style="flex:1">
          <span id="worry-int-val" style="font-family:'JetBrains Mono',monospace;font-size:0.8125rem;color:var(--primary);min-width:32px;text-align:right">None</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-3);margin-top:8px;line-height:1.4">Note it down and let it pass.</div>
      </div>

      ${showBackupNudge ? `
        <div id="backup-nudge-btn" style="margin:16px 16px 0;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer">
          <span style="font-size:0.8125rem;color:var(--text-2)">${backupNudgeText}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      ` : ''}
    </div>
  `;

  container.querySelector('#reflect-prompt-btn')?.addEventListener('click', () => navigate('/reflect'));
  container.querySelector('#backup-nudge-btn')?.addEventListener('click', () => navigate('/settings'));

  const worryIntSlider = container.querySelector('#worry-intensity');
  const worryIntValEl = container.querySelector('#worry-int-val');
  worryIntSlider?.addEventListener('input', () => {
    if (worryIntValEl) {
      const v = parseInt(worryIntSlider.value, 10);
      worryIntValEl.textContent = v === 0 ? 'None' : v;
    }
  });

  container.querySelector('#worry-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('#worry-add-btn')?.click();
  });

  container.querySelector('#worry-add-btn')?.addEventListener('click', async () => {
    const input = container.querySelector('#worry-input');
    const text = input?.value?.trim();
    if (!text) return;
    const rawInt = parseInt(container.querySelector('#worry-intensity')?.value || '0', 10);
    const intensity = rawInt > 0 ? rawInt : null;
    await dbPut('worries', {
      id: generateId(),
      text,
      intensity,
      date: today,
      createdAt: new Date().toISOString(),
    });
    input.value = '';
    showToast('Worry noted');
    renderToday(container);
  });
}

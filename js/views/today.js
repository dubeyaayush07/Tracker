import { dbGetByIndex, getSchedule, getCheckpoints, getClearDays, getReflectionByDate, generateId } from '../db.js';
import { getToday, formatDate, formatTime, getCurrentScheduleBlock, getSuggestedCheckpoint, formatBlockTime, parseTime, isSaturday, getNextSunday, daysAgo } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

export async function renderToday(container) {
  const today = getToday();
  const now = new Date();
  const dateStr = formatDate(now);
  const dayPart = dateStr.split(',')[0];
  const restDate = dateStr.split(',').slice(1).join(',').trim();

  const [schedule, checkpoints, clearDays, todayLogs, reflection] = await Promise.all([
    getSchedule(),
    getCheckpoints(),
    getClearDays(),
    dbGetByIndex('logs', 'date', today),
    getReflectionByDate(today),
  ]);

  const currentBlock = getCurrentScheduleBlock(schedule);
  const suggestedCp = getSuggestedCheckpoint(checkpoints);

  // Build checkpoint completion map
  const cpStatus = {};
  for (const cp of checkpoints) {
    const logsForCp = todayLogs.filter(l => l.checkpoint === cp.id);
    cpStatus[cp.id] = logsForCp.length > 0 ? 'done' : 
      (cp.id === suggestedCp.id ? 'active' : 'pending');
  }

  const saturdayBanner = isSaturday() ? `
    <div class="banner banner-primary" style="cursor:pointer" id="plan-banner">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary);flex-shrink:0;margin-top:1px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <div>
        <div style="font-weight:600;font-size:0.9375rem;color:var(--primary)">Plan your Sunday</div>
        <div style="font-size:0.8125rem;color:var(--text-2);margin-top:2px">Tap to plan tomorrow and reduce decision fatigue</div>
      </div>
    </div>
  ` : '';

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
    <div class="reflect-prompt" style="cursor:default;opacity:0.6">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--success-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div>
        <div style="font-weight:500;font-size:0.9375rem">Daily Reflection complete</div>
        <div style="font-size:0.8125rem;color:var(--text-2);margin-top:1px">See you tomorrow</div>
      </div>
    </div>
  `;

  const cpIcon = (status) => {
    if (status === 'done') return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    if (status === 'active') return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>`;
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`;
  };

  const checkpointRows = checkpoints.map(cp => {
    const s = cpStatus[cp.id];
    const logForCp = todayLogs.find(l => l.checkpoint === cp.id);
    const statsStr = logForCp 
      ? `Craving ${logForCp.craving} · Energy ${logForCp.energy} · Mood ${logForCp.mood}`
      : s === 'active' ? 'Now — tap to log' : '';
    return `
      <div class="checkpoint-row" data-cp="${cp.id}">
        <div class="checkpoint-icon ${s}">${cpIcon(s)}</div>
        <div class="checkpoint-info">
          <div class="checkpoint-name">${cp.label}</div>
          ${statsStr ? `<div class="checkpoint-stats">${statsStr}</div>` : ''}
        </div>
        <svg class="checkpoint-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;
  }).join('');

  // Build schedule timeline (compact, show 4-5 blocks)
  const scheduleBlocks = schedule.map((block, i) => {
    const isActive = currentBlock && currentBlock.id === block.id;
    const isLast = i === schedule.length - 1;
    return `
      <div class="schedule-block">
        <div class="block-time">${formatBlockTime(block.start)}</div>
        <div class="block-dot">
          <div class="block-dot-circle ${isActive ? 'active' : ''}"></div>
          ${!isLast ? '<div class="block-dot-line"></div>' : ''}
        </div>
        <div class="block-content ${isActive ? 'active' : ''}">${block.label}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="view-enter">
      <div class="today-hero">
        <div>
          <div class="today-date">${restDate}</div>
          <div class="today-day">${dayPart}</div>
        </div>
        <div class="clear-counter">
          <div class="clear-number">${clearDays}</div>
          <div class="clear-label">Clear days</div>
        </div>
      </div>

      ${currentBlock ? `
        <div class="current-block-card">
          <div class="current-block-indicator"></div>
          <div>
            <div class="current-block-label">${currentBlock.label}</div>
            <div class="current-block-time">${formatBlockTime(currentBlock.start)} – ${formatBlockTime(currentBlock.end)}</div>
          </div>
        </div>
      ` : ''}

      ${saturdayBanner}

      <div class="section-header">
        <span class="section-title">Checkpoints</span>
      </div>
      <div class="checkpoints-section">${checkpointRows}</div>

      ${reflectPrompt}

      <div class="section-header" style="margin-top:8px">
        <span class="section-title">Today's Schedule</span>
      </div>
      <div class="schedule-section" style="padding: 8px 0">${scheduleBlocks}</div>
    </div>

    <button class="fab" id="fab-log" aria-label="Log now">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  `;

  // Events
  container.querySelector('#fab-log')?.addEventListener('click', () => navigate('/log'));
  container.querySelector('#reflect-prompt-btn')?.addEventListener('click', () => navigate('/reflect'));
  container.querySelector('#plan-banner')?.addEventListener('click', () => navigate('/plan'));

  container.querySelectorAll('.checkpoint-row').forEach(row => {
    row.addEventListener('click', () => {
      const cpId = row.dataset.cp;
      navigate(`/log?cp=${cpId}`);
    });
  });
}

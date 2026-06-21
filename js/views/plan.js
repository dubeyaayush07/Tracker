import { dbPut, getPlanByDate, generateId } from '../db.js';
import { getToday, getTomorrow, getNextSunday, isSaturday, formatDate, parseDateKey } from '../utils/time.js';
import { showToast } from '../app.js';

export async function renderPlan(container, params = {}) {
  // Default: if Saturday suggest Sunday, otherwise suggest tomorrow
  let targetDate = params.date || (isSaturday() ? getNextSunday() : getTomorrow());
  let plan = await getPlanByDate(targetDate);
  let activities = plan ? [...plan.activities] : [];
  let newActivityText = '';

  function buildPage() {
    const dateObj = parseDateKey(targetDate);
    const isToday = targetDate === getToday();
    const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const activityList = activities.length === 0 ? `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <p style="font-weight:500;margin-bottom:6px">No activities planned</p>
        <p style="font-size:0.8125rem">Add activities below to structure your day</p>
      </div>
    ` : activities.map((act, i) => `
      <div class="activity-item" data-id="${act.id}">
        <div class="activity-check ${act.status}" data-check="${act.id}">
          ${act.status === 'done' ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : 
            act.status === 'skipped' ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` : ''}
        </div>
        <div class="activity-label ${act.status === 'done' ? 'done' : ''}" style="flex:1">
          ${act.label}
          ${act.notes ? `<div style="font-size:0.75rem;color:var(--text-2);margin-top:2px">${act.notes}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          ${act.status !== 'skipped' ? `<button class="btn btn-xs btn-ghost skip-btn" data-id="${act.id}">Skip</button>` : `<button class="btn btn-xs btn-ghost unskip-btn" data-id="${act.id}">Undo</button>`}
          <button class="btn btn-xs btn-danger delete-act" data-id="${act.id}">✕</button>
        </div>
      </div>
    `).join('');

    const doneCount = activities.filter(a => a.status === 'done').length;
    const progressText = activities.length > 0 ? `${doneCount} / ${activities.length} done` : '';

    return `
      <div class="plan-view view-enter">
        <div class="plan-date-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:1.375rem;font-weight:700;letter-spacing:-0.02em">Day Plan</div>
              <div style="font-size:0.875rem;color:var(--text-2);margin-top:3px">${formattedDate}</div>
            </div>
            ${progressText ? `<span class="badge badge-primary">${progressText}</span>` : ''}
          </div>
          
          <div style="margin-top:12px;display:flex;gap:8px;overflow-x:auto;padding-bottom:2px">
            <button class="cp-chip ${targetDate === getToday() ? 'active' : ''}" data-date="${getToday()}" style="border-radius:20px;padding:6px 14px;font-size:0.8125rem">Today</button>
            <button class="cp-chip ${targetDate === getTomorrow() ? 'active' : ''}" data-date="${getTomorrow()}" style="border-radius:20px;padding:6px 14px;font-size:0.8125rem">Tomorrow</button>
            ${isSaturday() ? `<button class="cp-chip ${targetDate === getNextSunday() ? 'active' : ''}" data-date="${getNextSunday()}" style="border-radius:20px;padding:6px 14px;font-size:0.8125rem">Sunday</button>` : ''}
            <input type="date" id="custom-date-picker" value="${targetDate}" style="width:130px;font-size:0.8125rem;padding:6px 10px;border-radius:20px">
          </div>
        </div>

        ${isSaturday() && targetDate === getNextSunday() ? `
          <div class="banner banner-primary" style="margin:12px 16px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style="font-size:0.8125rem;color:var(--text-2)"><strong style="color:var(--primary)">Saturday planning</strong> — Plan Sunday while thinking clearly, execute when cravings are strongest.</p>
          </div>
        ` : ''}

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 16px;overflow:hidden">
          ${activityList}
        </div>

        <div style="padding:12px 16px;display:flex;gap:8px">
          <input type="text" id="new-activity-input" placeholder="Add an activity (walk, gym, reading…)" value="${newActivityText}" style="flex:1">
          <button class="btn btn-secondary btn-sm" id="add-activity-btn" style="flex-shrink:0;padding:12px 16px">Add</button>
        </div>

        <div style="padding:0 16px">
          <button class="btn btn-primary" id="save-plan-btn">Save Plan</button>
        </div>
      </div>
    `;
  }

  function mount() {
    container.innerHTML = buildPage();
    bindEvents();
  }

  async function savePlan() {
    const entry = {
      id: plan?.id || generateId(),
      date: targetDate,
      activities: [...activities],
      updated_at: new Date().toISOString(),
    };
    await dbPut('plans', entry);
    plan = entry;
  }

  function bindEvents() {
    // Date navigation
    container.querySelectorAll('[data-date]').forEach(btn => {
      btn.addEventListener('click', async () => {
        targetDate = btn.dataset.date;
        plan = await getPlanByDate(targetDate);
        activities = plan ? [...plan.activities] : [];
        mount();
      });
    });

    container.querySelector('#custom-date-picker')?.addEventListener('change', async (e) => {
      targetDate = e.target.value;
      plan = await getPlanByDate(targetDate);
      activities = plan ? [...plan.activities] : [];
      mount();
    });

    // Check/uncheck activity
    container.querySelectorAll('[data-check]').forEach(check => {
      check.addEventListener('click', () => {
        const id = check.dataset.check;
        const act = activities.find(a => a.id === id);
        if (act) {
          act.status = act.status === 'done' ? 'pending' : 'done';
          savePlan();
          mount();
        }
      });
    });

    // Skip activity
    container.querySelectorAll('.skip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = activities.find(a => a.id === id);
        if (act) { act.status = 'skipped'; savePlan(); mount(); }
      });
    });

    container.querySelectorAll('.unskip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = activities.find(a => a.id === id);
        if (act) { act.status = 'pending'; savePlan(); mount(); }
      });
    });

    // Delete activity
    container.querySelectorAll('.delete-act').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        activities = activities.filter(a => a.id !== id);
        savePlan();
        mount();
      });
    });

    // Add activity
    const addBtn = container.querySelector('#add-activity-btn');
    const addInput = container.querySelector('#new-activity-input');

    function addActivity() {
      const text = addInput?.value?.trim();
      if (!text) return;
      activities.push({ id: generateId(), label: text, status: 'pending', notes: '' });
      newActivityText = '';
      savePlan();
      mount();
    }

    addBtn?.addEventListener('click', addActivity);
    addInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addActivity(); });

    // Save plan button
    container.querySelector('#save-plan-btn')?.addEventListener('click', async () => {
      await savePlan();
      showToast('Plan saved');
    });
  }

  mount();
}

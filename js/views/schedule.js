import { getSchedule, setSetting, DEFAULT_SCHEDULE, generateId } from '../db.js';
import { formatBlockTime } from '../utils/time.js';
import { showToast } from '../app.js';

export async function renderSchedule(container) {
  let schedule = await getSchedule();

  function buildPage() {
    const rows = schedule.map((block, i) => `
      <div class="schedule-edit-item" data-id="${block.id}">
        <div class="time-input-pair" style="flex:1">
          <input type="time" value="${block.start}" data-field="start" data-id="${block.id}" aria-label="Start time">
          <span style="color:var(--text-3);font-size:0.8125rem">–</span>
          <input type="time" value="${block.end}" data-field="end" data-id="${block.id}" aria-label="End time">
        </div>
        <input type="text" value="${block.label}" data-field="label" data-id="${block.id}" 
               placeholder="Activity" style="flex:1;margin-left:8px" aria-label="Activity name">
        <button class="btn btn-icon btn-danger delete-block" data-id="${block.id}" style="margin-left:6px;flex-shrink:0" aria-label="Delete block">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    `).join('');

    return `
      <div class="schedule-editor view-enter">
        <div class="page-header" style="border-bottom:1px solid var(--border)">
          <div>
            <div class="page-header-title">Schedule</div>
            <div class="page-header-sub">Edit your daily blocks</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="reset-schedule">Reset</button>
        </div>

        <div style="margin:12px 16px;padding:12px 14px;background:var(--surface-2);border-radius:var(--radius-sm);border:1px solid var(--border)">
          <p style="font-size:0.8125rem;color:var(--text-2)">These blocks show on your Today view and help identify current activity. Changes save automatically.</p>
        </div>

        <div id="schedule-list" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 16px;overflow:hidden">
          ${rows}
        </div>

        <div style="padding:16px">
          <button class="btn btn-secondary" id="add-block-btn" style="width:100%;gap:8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add time block
          </button>
        </div>

        <div style="padding:0 16px 16px">
          <button class="btn btn-primary" id="save-schedule-btn">Save Schedule</button>
        </div>
      </div>
    `;
  }

  function mount() {
    container.innerHTML = buildPage();
    bindEvents();
  }

  function bindEvents() {
    // Inline edit fields
    container.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.dataset.id;
        const field = input.dataset.field;
        const block = schedule.find(b => b.id === id);
        if (block) block[field] = input.value;
      });
    });

    // Delete block
    container.querySelectorAll('.delete-block').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        schedule = schedule.filter(b => b.id !== id);
        mount();
      });
    });

    // Add block
    container.querySelector('#add-block-btn')?.addEventListener('click', () => {
      schedule.push({
        id: generateId(),
        start: '09:00',
        end: '10:00',
        label: 'New activity',
      });
      mount();
      // Scroll to bottom
      setTimeout(() => {
        const list = container.querySelector('#schedule-list');
        list?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    });

    // Reset
    container.querySelector('#reset-schedule')?.addEventListener('click', () => {
      if (confirm('Reset to default schedule?')) {
        schedule = DEFAULT_SCHEDULE.map(b => ({ ...b }));
        mount();
        showToast('Reset to defaults');
      }
    });

    // Save
    container.querySelector('#save-schedule-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#save-schedule-btn');
      btn.textContent = 'Saving…';
      btn.disabled = true;
      await setSetting('schedule', schedule);
      showToast('Schedule saved');
      btn.textContent = 'Save Schedule';
      btn.disabled = false;
    });
  }

  mount();
}

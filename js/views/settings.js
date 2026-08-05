import { exportAllData, importAllData, dbClear, getSetting, setSetting, getCheckpoints, DEFAULT_CHECKPOINTS, generateId, getInsightsList, getBaselineRoutine } from '../db.js';
import { showToast } from '../app.js';

export async function renderSettings(container) {
  const checkpoints = await getCheckpoints();
  let editableCheckpoints = checkpoints.map(cp => ({ ...cp }));

  const insightsList = await getInsightsList();
  let editableInsights = [...insightsList];

  const baselineRoutine = await getBaselineRoutine();
  let editableBaseline = baselineRoutine.map(b => ({ ...b }));

  // Last backup check
  const lastBackup = await getSetting('last_backup');
  const daysSinceBackup = lastBackup 
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null;

  let insightsExpanded = false;
  let checkpointsExpanded = false;
  let baselineExpanded = false;

  function buildPage() {
    const backupStatus = daysSinceBackup === null 
      ? { cls: 'warning', text: 'Never backed up' }
      : daysSinceBackup <= 3 
        ? { cls: 'ok', text: `Backed up ${daysSinceBackup === 0 ? 'today' : `${daysSinceBackup}d ago`}` }
        : daysSinceBackup <= 7 
          ? { cls: 'warning', text: `Last backup ${daysSinceBackup}d ago` }
          : { cls: 'stale', text: `Last backup ${daysSinceBackup}d ago — consider exporting` };

    const cpRows = editableCheckpoints.map((cp, i) => `
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px">
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" value="${cp.label}" data-cp="${cp.id}" data-field="label" placeholder="Checkpoint name" style="flex:1">
          <button class="btn btn-icon btn-danger delete-cp" data-id="${cp.id}" aria-label="Delete checkpoint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <div style="font-size:0.75rem;color:var(--text-2);width:50px;flex-shrink:0">Window</div>
          <input type="number" value="${cp.startHour}" data-cp="${cp.id}" data-field="startHour" min="0" max="23" placeholder="Start hr" style="flex:1">
          <span style="color:var(--text-3)">–</span>
          <input type="number" value="${cp.endHour}" data-cp="${cp.id}" data-field="endHour" min="0" max="23" placeholder="End hr" style="flex:1">
          <div style="font-size:0.75rem;color:var(--text-3);flex-shrink:0">(24h)</div>
        </div>
      </div>
    `).join('');

    const baselineRows = editableBaseline.map((item, i) => `
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px">
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" value="${item.label.replace(/"/g, '&quot;')}" data-bl-idx="${i}" data-bl-field="label" placeholder="Activity name" style="flex:1">
          <button class="btn btn-icon btn-danger delete-bl" data-idx="${i}" aria-label="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <div style="font-size:0.75rem;color:var(--text-2);width:50px;flex-shrink:0">Time</div>
          <input type="time" value="${item.startTime || ''}" data-bl-idx="${i}" data-bl-field="startTime" style="flex:1;font-size:0.875rem;padding:6px">
          <span style="color:var(--text-3)">–</span>
          <input type="time" value="${item.endTime || ''}" data-bl-idx="${i}" data-bl-field="endTime" style="flex:1;font-size:0.875rem;padding:6px">
        </div>
      </div>
    `).join('');

    const chevron = (expanded) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${expanded ? '180deg' : '0deg'});transition:0.2s"><polyline points="6 9 12 15 18 9"/></svg>`;

    return `
      <div class="settings-view view-enter">
        <div class="page-header">
          <div class="page-header-title">Settings</div>
        </div>

        <!-- DATA BACKUP -->
        <div class="section-header"><span class="section-title">Data & Backup</span></div>
        <div class="settings-section">
          <div class="settings-row">
            <div>
              <div class="settings-label">Export data</div>
              <div class="settings-sublabel">Download all logs as JSON</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <div class="backup-status">
                <div class="backup-dot ${backupStatus.cls}"></div>
                <span style="font-size:0.75rem;color:var(--text-2)">${backupStatus.text}</span>
              </div>
              <button class="btn btn-secondary btn-sm" id="export-btn">Export JSON</button>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-label">Import data</div>
              <div class="settings-sublabel">Restore from a backup file</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="import-btn">Import JSON</button>
            <input type="file" id="import-input" accept=".json" style="display:none">
          </div>
        </div>

        <!-- BASELINE ROUTINE (Collapsible) -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 16px 16px 16px;overflow:hidden">
          <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="toggle-baseline">
            <div style="font-weight:600;font-size:0.9375rem">Baseline Routine</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.75rem;color:var(--text-3)">${editableBaseline.length} tasks</span>
              ${chevron(baselineExpanded)}
            </div>
          </div>
          <div style="display:${baselineExpanded ? 'block' : 'none'}">
            <div style="padding:0 16px 8px;font-size:0.75rem;color:var(--text-3)">These tasks auto-populate when you tap "Load Routine" on the Today screen.</div>
            ${baselineRows}
            <div class="settings-row" style="padding:12px 16px">
              <button class="btn btn-secondary" id="add-bl-btn" style="width:100%;gap:8px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add task
              </button>
            </div>
            <div style="padding:0 16px 12px">
              <button class="btn btn-primary" id="save-bl-btn">Save Baseline</button>
            </div>
          </div>
        </div>

        <!-- INSIGHTS (Collapsible) -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 16px 16px 16px;overflow:hidden">
          <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="toggle-insights">
            <div style="font-weight:600;font-size:0.9375rem">Insights Banner</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.75rem;color:var(--text-3)">${editableInsights.length} items</span>
              ${chevron(insightsExpanded)}
            </div>
          </div>
          <div style="display:${insightsExpanded ? 'block' : 'none'}">
            ${editableInsights.map((insight, i) => `
              <div class="settings-row" style="align-items:center;gap:10px">
                <input type="text" value="${insight.replace(/"/g, '&quot;')}" data-insight-idx="${i}" style="flex:1" placeholder="Add a personal insight...">
                <button class="btn btn-icon btn-danger delete-insight" data-idx="${i}" aria-label="Delete insight">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            `).join('')}
            <div class="settings-row" style="padding:12px 16px">
              <button class="btn btn-secondary" id="add-insight-btn" style="width:100%;gap:8px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add insight
              </button>
            </div>
            <div style="padding:0 16px 12px">
              <button class="btn btn-primary" id="save-insights-btn">Save Insights</button>
            </div>
          </div>
        </div>

        <!-- CHECKPOINTS (Collapsible) -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 16px 16px 16px;overflow:hidden">
          <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="toggle-checkpoints">
            <div style="font-weight:600;font-size:0.9375rem">Checkpoints</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.75rem;color:var(--text-3)">${editableCheckpoints.length} items</span>
              ${chevron(checkpointsExpanded)}
            </div>
          </div>
          <div style="display:${checkpointsExpanded ? 'block' : 'none'}">
            ${cpRows}
            <div class="settings-row" style="padding:12px 16px">
              <button class="btn btn-secondary" id="add-cp-btn" style="width:100%;gap:8px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add checkpoint
              </button>
            </div>
            <div style="padding:0 16px 12px">
              <button class="btn btn-primary" id="save-cp-btn">Save Checkpoints</button>
            </div>
          </div>
        </div>

        <!-- DANGER -->
        <div class="section-header"><span class="section-title">Danger Zone</span></div>
        <div class="settings-section">
          <div class="settings-row">
            <div>
              <div class="settings-label" style="color:var(--danger)">Clear all data</div>
              <div class="settings-sublabel">Permanently delete all logs</div>
            </div>
            <button class="btn btn-danger btn-sm" id="clear-btn">Clear All</button>
          </div>
        </div>

        <!-- ABOUT -->
        <div style="padding:24px 16px;text-align:center;color:var(--text-3);font-size:0.75rem">
          <p>Tracker v1.14.0 — All data stays on your device</p>
          <p style="margin-top:4px">Built as a PWA. Add to home screen from your browser menu.</p>
        </div>
      </div>
    `;
  }

  function mount() {
    container.innerHTML = buildPage();
    bindEvents();
  }

  function bindEvents() {
    // Toggle collapsible sections
    container.querySelector('#toggle-insights')?.addEventListener('click', () => { insightsExpanded = !insightsExpanded; mount(); });
    container.querySelector('#toggle-checkpoints')?.addEventListener('click', () => { checkpointsExpanded = !checkpointsExpanded; mount(); });
    container.querySelector('#toggle-baseline')?.addEventListener('click', () => { baselineExpanded = !baselineExpanded; mount(); });

    // Edit checkpoint fields
    container.querySelectorAll('input[data-cp][data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const cp = editableCheckpoints.find(c => c.id === input.dataset.cp);
        if (cp) {
          const val = input.dataset.field.includes('Hour') ? parseInt(input.value) : input.value;
          cp[input.dataset.field] = val;
        }
      });
    });

    // Delete checkpoint
    container.querySelectorAll('.delete-cp').forEach(btn => {
      btn.addEventListener('click', () => {
        editableCheckpoints = editableCheckpoints.filter(c => c.id !== btn.dataset.id);
        mount();
      });
    });

    // Add checkpoint
    container.querySelector('#add-cp-btn')?.addEventListener('click', () => {
      editableCheckpoints.push({ id: generateId(), label: 'New checkpoint', startHour: 12, endHour: 14 });
      mount();
    });

    // Insights editing
    container.querySelectorAll('input[data-insight-idx]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.insightIdx);
        editableInsights[idx] = input.value.trim();
      });
    });

    // Delete insight
    container.querySelectorAll('.delete-insight').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        editableInsights.splice(idx, 1);
        mount();
      });
    });

    // Add insight
    container.querySelector('#add-insight-btn')?.addEventListener('click', () => {
      editableInsights.push('');
      mount();
    });

    // Save insights
    container.querySelector('#save-insights-btn')?.addEventListener('click', async () => {
      const validInsights = editableInsights.filter(i => i.trim() !== '');
      editableInsights = validInsights;
      await setSetting('insights', validInsights);
      showToast('Insights saved');
      mount();
    });

    // Save checkpoints
    container.querySelector('#save-cp-btn')?.addEventListener('click', async () => {
      await setSetting('checkpoints', editableCheckpoints);
      showToast('Checkpoints saved');
    });

    // ----- BASELINE ROUTINE -----
    container.querySelectorAll('input[data-bl-idx][data-bl-field]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.blIdx);
        editableBaseline[idx][input.dataset.blField] = input.value;
      });
    });

    container.querySelectorAll('.delete-bl').forEach(btn => {
      btn.addEventListener('click', () => {
        editableBaseline.splice(parseInt(btn.dataset.idx), 1);
        mount();
      });
    });

    container.querySelector('#add-bl-btn')?.addEventListener('click', () => {
      editableBaseline.push({ label: '', startTime: '', endTime: '' });
      mount();
    });

    container.querySelector('#save-bl-btn')?.addEventListener('click', async () => {
      const valid = editableBaseline.filter(b => b.label.trim() !== '');
      editableBaseline = valid;
      await setSetting('baseline_routine', valid);
      showToast('Baseline routine saved');
      mount();
    });

    // Export
    container.querySelector('#export-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#export-btn');
      btn.textContent = 'Exporting…';
      btn.disabled = true;
      try {
        const data = await exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `tracker-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await setSetting('last_backup', new Date().toISOString());
        showToast('Backup downloaded');
        mount(); // refresh backup status
      } finally {
        btn.textContent = 'Export JSON';
        btn.disabled = false;
      }
    });

    // Import
    container.querySelector('#import-btn')?.addEventListener('click', () => {
      container.querySelector('#import-input')?.click();
    });

    container.querySelector('#import-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm('This will replace all your current data. Continue?')) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importAllData(data);
        showToast('Data imported successfully');
        mount();
      } catch (err) {
        showToast('Error: invalid backup file');
      }
    });

    // Clear all data
    container.querySelector('#clear-btn')?.addEventListener('click', async () => {
      if (!confirm('Delete ALL data permanently? This cannot be undone.')) return;
      if (!confirm('Are you absolutely sure? Export a backup first.')) return;
      await Promise.all([dbClear('logs'), dbClear('reflections'), dbClear('plans')]);
      showToast('All data cleared');
    });
  }

  mount();
}

import { getWorries, saveWorry, deleteWorry, generateId, getPlanByDate, dbPut } from '../db.js';
import { showToast, navigate } from '../app.js';
import { getToday, getTomorrow } from '../utils/time.js';

let filterState = 'pending'; // 'pending', 'active', 'archived'

export async function renderWorries(container, params = {}) {
  let worries = await getWorries();
  let editingId = params.id || null; // null means list view, 'new' means new form, UUID means editing

  function buildList() {
    const filtered = worries.filter(w => {
      if (filterState === 'pending') return w.stance === 'Unassessed' && !w.archived;
      if (filterState === 'active') return w.stance !== 'Unassessed' && !w.archived;
      if (filterState === 'archived') return w.archived;
      return true;
    });

    if (filtered.length === 0) {
      return `
        <div style="text-align:center; padding: 40px 20px; color: var(--text-3);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;opacity:0.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No worries logged.</p>
        </div>
      `;
    }

    return filtered.map(w => {
      const isUnassessed = w.stance === 'Unassessed';
      const badgeColor = isUnassessed ? 'var(--warning)' : 'var(--success)';
      return `
        <div class="card worry-item" data-id="${w.id}" style="padding:16px; margin-bottom:12px; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div style="font-weight:500; font-size:1.05rem; color:var(--text-1); line-height:1.4;">${w.text}</div>
            <div style="font-size:0.75rem; background:var(--surface-3); padding:2px 6px; border-radius:4px; margin-left:8px; white-space:nowrap;">Int: ${w.intensity}/10</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:8px; height:8px; border-radius:50%; background:${badgeColor}"></div>
            <span style="font-size:0.85rem; color:var(--text-2);">${w.stance}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function buildForm(worry = null) {
    const isNew = !worry;
    const text = isNew ? '' : worry.text;
    const intensity = isNew ? 5 : worry.intensity;
    const stance = isNew ? 'Unassessed' : worry.stance;
    const comment = (isNew ? '' : worry.comment) || '';

    const stances = ['Unassessed', 'Not a worry', "Can't do anything", 'Actionable'];

    return `
      <div class="card" style="padding:20px;">
        <h3 style="margin-bottom:16px; margin-top:0;">${isNew ? 'Log a Worry' : 'Review Worry'}</h3>
        
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:0.85rem; color:var(--text-2); margin-bottom:6px;">What's on your mind?</label>
          <textarea id="worry-text" class="input" style="width:100%; min-height:80px; resize:vertical;" placeholder="Write down the intrusive thought...">${text}</textarea>
        </div>
        
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:0.85rem; color:var(--text-2); margin-bottom:6px;">Intensity (1-10): <span id="intensity-val">${intensity}</span></label>
          <input type="range" id="worry-intensity" min="1" max="10" value="${intensity}" style="width:100%;">
        </div>
        
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:0.85rem; color:var(--text-2); margin-bottom:6px;">Stance</label>
          <select id="worry-stance" class="input" style="width:100%;">
            ${stances.map(s => `<option value="${s}" ${s === stance ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        
        <div style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:0.85rem; color:var(--text-2);">Reasoning (Optional)</label>
            ${!isNew ? `<button class="btn btn-xs btn-secondary" id="add-update-btn" style="padding:2px 8px; font-size:0.75rem;">Add Update</button>` : ''}
          </div>
          <textarea id="worry-comment" class="input" style="width:100%; min-height:80px; resize:vertical;" placeholder="Why this stance?">${comment}</textarea>
        </div>
        
        <div style="display:flex; gap:12px;">
          <button class="btn btn-primary" id="save-worry" style="flex:1;">Save</button>
          <button class="btn btn-secondary" id="cancel-worry" style="flex:1;">Cancel</button>
        </div>
        
        ${(!isNew && stance === 'Actionable' && !worry.archived) ? `
          <div class="card" style="margin-top:24px; padding:16px; background:var(--surface-2); border:1px solid var(--border);">
            <div style="font-size:0.85rem; font-weight:500; margin-bottom:8px;">Send to Plan</div>
            <input type="text" id="plan-task-text" class="input" style="width:100%; margin-bottom:8px; font-size:0.85rem; padding:8px;" placeholder="Specific action step (e.g. Call CA)">
            <div style="display:flex; gap:8px;">
              <input type="date" id="plan-task-date" class="input" style="flex:1; font-size:0.85rem; padding:8px;" value="${getTomorrow()}">
              <button class="btn btn-primary btn-sm" id="send-to-plan-btn" style="flex-shrink:0; width:auto; padding:8px 16px;">Send</button>
            </div>
          </div>
        ` : ''}

        ${!isNew ? `
          <div style="margin-top:24px; display:flex; gap:12px;">
            <button class="btn btn-secondary" id="archive-worry" style="flex:1;">${worry.archived ? 'Unarchive' : 'Archive Worry'}</button>
            <button class="btn btn-icon btn-danger" id="delete-worry" aria-label="Delete permanently">✕</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function mount() {
    if (editingId) {
      const worry = editingId === 'new' ? null : worries.find(w => w.id === editingId);
      container.innerHTML = `
        <div class="view-enter" style="padding: 20px;">
          <div class="page-header" style="margin-bottom:20px;">
            <button class="btn btn-icon btn-secondary" id="back-btn" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <div class="page-header-title" style="margin-left:12px;">Worry Tracker</div>
          </div>
          ${buildForm(worry)}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="view-enter" style="padding: 20px;">
          <div class="page-header">
            <div class="page-header-title">Worry Tracker</div>
          </div>
          <p style="color:var(--text-2); font-size:0.9rem; margin-bottom:20px;">Review your thoughts and choose a stance.</p>
          
          <button class="btn btn-primary" id="add-worry-btn" style="width:100%; margin-bottom:24px; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Log a New Worry
          </button>
          
          <div style="margin-bottom:16px; display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
            <button class="cp-chip ${filterState === 'pending' ? 'active' : ''}" data-filter="pending" style="border-radius:20px; padding:6px 14px; font-size:0.8125rem;">Pending</button>
            <button class="cp-chip ${filterState === 'active' ? 'active' : ''}" data-filter="active" style="border-radius:20px; padding:6px 14px; font-size:0.8125rem;">Active</button>
            <button class="cp-chip ${filterState === 'archived' ? 'active' : ''}" data-filter="archived" style="border-radius:20px; padding:6px 14px; font-size:0.8125rem;">Archived</button>
          </div>
            ${buildList()}
          </div>
        </div>
      `;
    }
    bindEvents();
  }

  function bindEvents() {
    if (editingId) {
      const isNew = editingId === 'new';
      const textEl = container.querySelector('#worry-text');
      const intEl = container.querySelector('#worry-intensity');
      const intValEl = container.querySelector('#intensity-val');
      const stanceEl = container.querySelector('#worry-stance');
      const commentEl = container.querySelector('#worry-comment');

      intEl?.addEventListener('input', e => {
        if (intValEl) intValEl.textContent = e.target.value;
      });

      container.querySelector('#back-btn')?.addEventListener('click', () => {
        navigate('#/worries');
      });

      container.querySelector('#cancel-worry')?.addEventListener('click', () => {
        navigate('#/worries');
      });

      container.querySelector('#add-update-btn')?.addEventListener('click', () => {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const prefix = commentEl.value ? '\n\n' : '';
        commentEl.value = commentEl.value + prefix + `[${dateStr}]: `;
        commentEl.focus();
        // Set cursor to end
        commentEl.selectionStart = commentEl.selectionEnd = commentEl.value.length;
      });

      container.querySelector('#send-to-plan-btn')?.addEventListener('click', async () => {
        const taskText = container.querySelector('#plan-task-text').value.trim();
        const taskDate = container.querySelector('#plan-task-date').value;
        if (!taskText) return showToast('Please enter a specific task.');
        if (!taskDate) return showToast('Please select a date.');
        
        let plan = await getPlanByDate(taskDate);
        if (!plan) plan = { id: generateId(), date: taskDate, activities: [], updated_at: new Date().toISOString() };
        
        plan.activities.push({ id: generateId(), label: taskText, status: 'pending', notes: '' });
        await dbPut('plans', plan);
        showToast('Task added to plan!');
        container.querySelector('#plan-task-text').value = '';
      });

      container.querySelector('#archive-worry')?.addEventListener('click', async () => {
        const w = worries.find(w => w.id === editingId);
        w.archived = !w.archived;
        await saveWorry(w);
        showToast(w.archived ? 'Worry archived' : 'Worry unarchived');
        navigate('#/worries');
      });

      container.querySelector('#save-worry')?.addEventListener('click', async () => {
        const text = textEl.value.trim();
        if (!text) return showToast('Please enter a worry.');
        
        const worry = {
          id: isNew ? generateId() : editingId,
          text,
          intensity: parseInt(intEl.value),
          stance: stanceEl.value,
          comment: commentEl.value.trim(),
          createdAt: isNew ? new Date().toISOString() : worries.find(w => w.id === editingId).createdAt,
          archived: isNew ? false : worries.find(w => w.id === editingId).archived || false
        };

        await saveWorry(worry);
        showToast('Worry saved');
        if (isNew) {
          navigate('#/worries?id=' + worry.id);
        } else {
          worries = await getWorries();
          mount();
        }
      });

      container.querySelector('#delete-worry')?.addEventListener('click', async () => {
        if (confirm('Delete this worry permanently?')) {
          await deleteWorry(editingId);
          showToast('Worry deleted');
          navigate('#/worries');
        }
      });
    } else {
      container.querySelector('#add-worry-btn')?.addEventListener('click', () => {
        navigate('#/worries?id=new');
      });

      container.querySelectorAll('.cp-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          filterState = e.target.dataset.filter;
          mount();
        });
      });

      container.querySelectorAll('.worry-item').forEach(el => {
        el.addEventListener('click', () => {
          navigate('#/worries?id=' + el.dataset.id);
        });
      });
    }
  }

  mount();
}

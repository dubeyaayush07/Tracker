import { getWorries, saveWorry, deleteWorry, generateId } from '../db.js';
import { showToast } from '../app.js';

export async function renderWorries(container) {
  let worries = await getWorries();
  let editingId = null; // null means list view, 'new' means new form, UUID means editing

  function buildList() {
    if (worries.length === 0) {
      return `
        <div style="text-align:center; padding: 40px 20px; color: var(--text-3);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;opacity:0.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No worries logged.</p>
        </div>
      `;
    }

    return worries.map(w => {
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
          <label style="display:block; font-size:0.85rem; color:var(--text-2); margin-bottom:6px;">Reasoning (Optional)</label>
          <textarea id="worry-comment" class="input" style="width:100%; min-height:60px; resize:vertical;" placeholder="Why this stance?">${comment}</textarea>
        </div>
        
        <div style="display:flex; gap:12px;">
          <button class="btn btn-primary" id="save-worry" style="flex:1;">Save</button>
          <button class="btn btn-secondary" id="cancel-worry" style="flex:1;">Cancel</button>
        </div>
        
        ${!isNew ? `
          <div style="margin-top:24px;">
            <button class="btn btn-danger" id="delete-worry" style="width:100%;">Delete Worry</button>
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
          
          <div>
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
        editingId = null;
        mount();
      });

      container.querySelector('#cancel-worry')?.addEventListener('click', () => {
        editingId = null;
        mount();
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
          createdAt: isNew ? new Date().toISOString() : worries.find(w => w.id === editingId).createdAt
        };

        await saveWorry(worry);
        showToast('Worry saved');
        worries = await getWorries();
        editingId = null;
        mount();
      });

      container.querySelector('#delete-worry')?.addEventListener('click', async () => {
        if (confirm('Delete this worry permanently?')) {
          await deleteWorry(editingId);
          showToast('Worry deleted');
          worries = await getWorries();
          editingId = null;
          mount();
        }
      });
    } else {
      container.querySelector('#add-worry-btn')?.addEventListener('click', () => {
        editingId = 'new';
        mount();
      });

      container.querySelectorAll('.worry-item').forEach(el => {
        el.addEventListener('click', () => {
          editingId = el.dataset.id;
          mount();
        });
      });
    }
  }

  mount();
}

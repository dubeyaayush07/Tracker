import { dbPut, dbGetAll, generateId, getReflectionByDate, getWorriesByDate, deleteWorry } from '../db.js';
import { getToday, formatDate } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

export async function renderReflect(container) {
  const today = getToday();
  const [existing, todayWorries] = await Promise.all([
    getReflectionByDate(today),
    getWorriesByDate(today)
  ]);

  let slipped = existing?.slipped ?? null; // null = not selected yet
  let selectedSubstance = existing?.slip_substance || null;

  function buildPage() {
    const slipCard = `
      <div class="slip-card ${slipped === true ? 'used' : slipped === false ? 'not-used' : ''}" id="slip-card">
        <div class="slip-label">Did I slip today?</div>
        <div class="slip-segment">
          <button class="slip-btn yes ${slipped === true ? 'active' : ''}" id="slip-yes">Yes</button>
          <button class="slip-btn no ${slipped === false ? 'active' : ''}" id="slip-no">No</button>
        </div>
      </div>
    `;

    return `
      <div class="reflect-view view-enter">
        <div class="page-header">
          <div>
            <div class="page-header-title">Reflection</div>
            <div class="page-header-sub">${formatDate()}</div>
          </div>
          ${existing ? '<span class="badge badge-success">Updated</span>' : ''}
        </div>

        ${slipCard}

        ${todayWorries.length > 0 ? `
          <div style="margin:0 16px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden">
            <div style="padding:14px 16px 10px;font-size:0.6875rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid var(--border)">
              Today's Worries (${todayWorries.length})
            </div>
            <div>
              ${todayWorries.map((w, i) => `
                <div class="worry-entry" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;${i > 0 ? 'border-top:1px solid var(--border);' : ''}">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:0.9375rem;font-weight:500;color:var(--text);line-height:1.4;word-break:break-word">${w.text}</div>
                    <div style="font-size:0.75rem;color:var(--text-3);margin-top:2px">${new Date(w.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                    ${w.intensity ? `
                      <span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;background:var(--warning-dim);color:var(--warning);font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:600;letter-spacing:-0.02em">
                        ${w.intensity}/10
                      </span>
                    ` : ''}
                    <button class="worry-delete" data-id="${w.id}" style="width:28px;height:28px;border-radius:6px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--transition)" aria-label="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="reflect-form">
          ${slipped === true ? `
            <div class="form-group" id="substance-section">
              <label class="form-label">Substance <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
              <div class="segment-group" id="substance-group">
                <button class="segment-btn ${selectedSubstance === 'THC' ? 'active' : ''}" data-val="THC">THC</button>
                <button class="segment-btn ${selectedSubstance === 'Alcohol' ? 'active' : ''}" data-val="Alcohol">Alcohol</button>
                <button class="segment-btn ${selectedSubstance === 'Both' ? 'active' : ''}" data-val="Both">Both</button>
              </div>
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label">Peak urge today</label>
            <div class="slider-container">
              <div class="slider-label-row">
                <span class="slider-label" style="font-size:0.875rem;color:var(--text-2)">Highest point today</span>
                <span class="slider-value" id="val-peak-urge">${existing?.peak_urge ?? 1}</span>
              </div>
              <input type="range" id="range-peak-urge" min="1" max="10" value="${existing?.peak_urge ?? 1}" aria-label="Peak urge">
              <div class="slider-desc"><span>None</span><span>Overwhelming</span></div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Any observations? <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <textarea id="reflect-notes" placeholder="Gym helped a lot today. Urge peaked around 9 PM. Had extra free time after dinner…" rows="4">${existing?.observations || ''}</textarea>
          </div>

          <button class="btn btn-primary" id="save-reflect-btn">
            ${existing ? 'Update Reflection' : 'Save Reflection'}
          </button>
        </div>
      </div>
    `;
  }

  function mount() {
    container.innerHTML = buildPage();
    bindEvents();
  }

  function bindEvents() {
    // Slip toggle
    container.querySelector('#slip-yes')?.addEventListener('click', () => {
      slipped = true; mount();
    });
    container.querySelector('#slip-no')?.addEventListener('click', () => {
      slipped = false; selectedSubstance = null; mount();
    });

    // Substance toggle
    container.querySelectorAll('#substance-group .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        selectedSubstance = selectedSubstance === val ? null : val;
        mount();
      });
    });

    // Peak urge slider
    const peakRange = container.querySelector('#range-peak-urge');
    const peakVal = container.querySelector('#val-peak-urge');
    peakRange?.addEventListener('input', () => { peakVal.textContent = peakRange.value; });

    container.querySelectorAll('.worry-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteWorry(btn.dataset.id);
        const idx = todayWorries.findIndex(w => w.id === btn.dataset.id);
        if (idx !== -1) todayWorries.splice(idx, 1);
        mount();
      });
    });

    // Save
    container.querySelector('#save-reflect-btn')?.addEventListener('click', async () => {
      const peakUrge = parseInt(container.querySelector('#range-peak-urge')?.value || 1);
      const notes = container.querySelector('#reflect-notes')?.value?.trim() || '';

      const entry = {
        id: existing?.id || generateId(),
        date: today,
        slipped: slipped,
        slip_substance: slipped === true ? selectedSubstance : null,
        peak_urge: peakUrge,
        unstructured_time: existing?.unstructured_time ?? null,
        triggers: existing?.triggers || [],
        good_factors: existing?.good_factors || [],
        bad_factors: existing?.bad_factors || [],
        observations: notes,
        updated_at: new Date().toISOString(),
      };

      const btn = container.querySelector('#save-reflect-btn');
      btn.textContent = 'Saving…';
      btn.disabled = true;

      await dbPut('reflections', entry);
      showToast('Reflection saved');
      navigate('/');
    });
  }

  mount();
}

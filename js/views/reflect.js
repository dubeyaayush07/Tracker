import { dbPut, generateId, getReflectionByDate, getWorriesByDate, deleteWorry } from '../db.js';
import { getToday, getYesterday, formatDate, formatShortDate, parseDateKey } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function renderReflect(container, params = {}) {
  const today = getToday();
  const yesterday = getYesterday();
  let targetDate = params.date || today;
  const returnPath = params.from === 'insights' ? '/insights' : '/';

  let existing = null;
  let dayWorries = [];
  let slipped = null;
  let selectedSubstance = null;
  let peakUrge = 1;
  let pressureVal = 0;
  let guiltVal = 0;
  let observations = '';

  async function loadDateData(date) {
    targetDate = date;
    const [ref, worries] = await Promise.all([
      getReflectionByDate(targetDate),
      getWorriesByDate(targetDate),
    ]);
    existing = ref;
    dayWorries = worries;
    slipped = existing?.slipped ?? null;
    selectedSubstance = existing?.slip_substance || null;
    peakUrge = existing?.peak_urge ?? 1;
    pressureVal = existing?.pressure ?? 0;
    guiltVal = existing?.guilt ?? 0;
    observations = existing?.observations || '';
  }

  function optionalSlider(id, label, value) {
    const val = value ?? 0;
    const isSkip = val === 0;
    return `
      <div class="form-group">
        <label class="form-label">${label} <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
        <div class="slider-container">
          <div class="slider-label-row">
            <span class="slider-label" style="font-size:0.875rem;color:var(--text-2)">Overall</span>
            <span class="slider-value" id="val-${id}" style="${isSkip ? 'font-size:0.9375rem;color:var(--text-3)' : ''}">${isSkip ? 'Skip' : val}</span>
          </div>
          <input type="range" id="range-${id}" min="0" max="10" value="${val}" aria-label="${label}">
          <div class="slider-desc"><span>Skip</span><span>Overwhelming</span></div>
        </div>
      </div>
    `;
  }

  function buildPage() {
    const isToday = targetDate === today;
    const isYesterday = targetDate === yesterday;
    const isCustomDate = !isToday && !isYesterday;
    const dateHeading = formatDate(parseDateKey(targetDate));
    const worriesLabel = isToday ? "Today's Worries" : isYesterday ? "Yesterday's Worries" : `${formatShortDate(parseDateKey(targetDate))} Worries`;

    const slipCard = `
      <div class="slip-card ${slipped === true ? 'used' : slipped === false ? 'not-used' : ''}" id="slip-card">
        <div class="slip-label">Did I slip?</div>
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
            <div class="page-header-sub">${dateHeading}</div>
          </div>
          ${existing ? '<span class="badge badge-success">Saved</span>' : ''}
        </div>

        <div style="display:flex;gap:8px;padding:0 16px 4px;flex-wrap:wrap">
          <button class="cp-chip ${isToday ? 'active' : ''}" data-reflect-date="${today}" style="padding:6px 14px;font-size:0.8125rem">Today</button>
          <button class="cp-chip ${isYesterday ? 'active' : ''}" data-reflect-date="${yesterday}" style="padding:6px 14px;font-size:0.8125rem">Yesterday</button>
          ${isCustomDate ? `<span class="cp-chip active" style="padding:6px 14px;font-size:0.8125rem;cursor:default">${formatShortDate(parseDateKey(targetDate))}</span>` : ''}
        </div>

        ${slipCard}

        ${dayWorries.length > 0 ? `
          <div style="margin:0 16px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden">
            <div style="padding:14px 16px 10px;font-size:0.6875rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid var(--border)">
              ${worriesLabel} (${dayWorries.length})
            </div>
            <div>
              ${dayWorries.map((w, i) => `
                <div class="worry-entry" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;${i > 0 ? 'border-top:1px solid var(--border);' : ''}">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:0.9375rem;font-weight:500;color:var(--text);line-height:1.4;word-break:break-word">${esc(w.text)}</div>
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
            <label class="form-label">Peak urge</label>
            <div class="slider-container">
              <div class="slider-label-row">
                <span class="slider-label" style="font-size:0.875rem;color:var(--text-2)">Highest point</span>
                <span class="slider-value" id="val-peak-urge">${peakUrge}</span>
              </div>
              <input type="range" id="range-peak-urge" min="1" max="10" value="${peakUrge}" aria-label="Peak urge">
              <div class="slider-desc"><span>None</span><span>Overwhelming</span></div>
            </div>
          </div>

          ${optionalSlider('pressure', 'Pressure', pressureVal)}
          ${optionalSlider('guilt', 'Guilt', guiltVal)}

          <div class="form-group">
            <label class="form-label">Any observations? <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <textarea id="reflect-notes" placeholder="Gym helped a lot today. Urge peaked around 9 PM…" rows="4">${esc(observations)}</textarea>
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
    container.querySelectorAll('[data-reflect-date]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const nextDate = btn.dataset.reflectDate;
        if (nextDate === targetDate) return;
        await loadDateData(nextDate);
        mount();
      });
    });

    container.querySelector('#slip-yes')?.addEventListener('click', () => {
      slipped = true;
      mount();
    });
    container.querySelector('#slip-no')?.addEventListener('click', () => {
      slipped = false;
      selectedSubstance = null;
      mount();
    });

    container.querySelectorAll('#substance-group .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        selectedSubstance = selectedSubstance === val ? null : val;
        mount();
      });
    });

    const peakRange = container.querySelector('#range-peak-urge');
    const peakVal = container.querySelector('#val-peak-urge');
    peakRange?.addEventListener('input', () => {
      peakUrge = parseInt(peakRange.value, 10);
      peakVal.textContent = peakUrge;
    });

    ['pressure', 'guilt'].forEach(id => {
      const range = container.querySelector(`#range-${id}`);
      const valEl = container.querySelector(`#val-${id}`);
      range?.addEventListener('input', () => {
        const v = parseInt(range.value, 10);
        if (id === 'pressure') pressureVal = v;
        else guiltVal = v;
        if (v === 0) {
          valEl.textContent = 'Skip';
          valEl.style.fontSize = '0.9375rem';
          valEl.style.color = 'var(--text-3)';
        } else {
          valEl.textContent = v;
          valEl.style.fontSize = '';
          valEl.style.color = '';
        }
      });
    });

    container.querySelector('#reflect-notes')?.addEventListener('input', (e) => {
      observations = e.target.value;
    });

    container.querySelectorAll('.worry-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteWorry(btn.dataset.id);
        const idx = dayWorries.findIndex(w => w.id === btn.dataset.id);
        if (idx !== -1) dayWorries.splice(idx, 1);
        mount();
      });
    });

    container.querySelector('#save-reflect-btn')?.addEventListener('click', async () => {
      const notes = observations.trim();
      const entry = {
        id: existing?.id || generateId(),
        date: targetDate,
        slipped: slipped,
        slip_substance: slipped === true ? selectedSubstance : null,
        peak_urge: peakUrge,
        pressure: pressureVal > 0 ? pressureVal : null,
        guilt: guiltVal > 0 ? guiltVal : null,
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
      navigate(returnPath);
    });
  }

  await loadDateData(targetDate);
  mount();
}

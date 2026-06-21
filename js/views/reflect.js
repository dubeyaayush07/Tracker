import { dbPut, dbGetAll, generateId, getReflectionByDate } from '../db.js';
import { getToday, formatDate } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

const TRIGGER_TAGS = ['Evening', 'Boredom', 'Hunger', 'Stress', 'Fatigue', 'Social', 'Anxiety', 'Other'];

export async function renderReflect(container) {
  const today = getToday();
  const existing = await getReflectionByDate(today);

  let slipped = existing?.slipped ?? null; // null = not selected yet
  let selectedTriggers = new Set(existing?.triggers || []);

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

    const triggerTags = TRIGGER_TAGS.map(t => `
      <button class="tag-btn ${selectedTriggers.has(t) ? 'active' : ''}" data-tag="${t}">${t}</button>
    `).join('');

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

        <div class="reflect-form">
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
            <label class="form-label">Unstructured free time today?</label>
            <div class="segment-group" id="unstructured-group">
              <button class="segment-btn ${existing?.unstructured_time === false ? 'active' : ''}" data-val="no">No</button>
              <button class="segment-btn ${existing?.unstructured_time === true ? 'active' : ''}" data-val="yes">Yes</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">What triggered the strongest craving? <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <div class="tag-group">${triggerTags}</div>
          </div>

          <div class="form-group">
            <label class="form-label">Any observations? <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <textarea id="reflect-notes" placeholder="Gym helped a lot today. Craving peaked around 9 PM. Had extra free time after dinner…" rows="4">${existing?.observations || ''}</textarea>
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
      slipped = false; mount();
    });

    // Peak urge slider
    const peakRange = container.querySelector('#range-peak-urge');
    const peakVal = container.querySelector('#val-peak-urge');
    peakRange?.addEventListener('input', () => { peakVal.textContent = peakRange.value; });

    // Unstructured segment
    container.querySelectorAll('#unstructured-group .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#unstructured-group .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Trigger tags
    container.querySelectorAll('.tag-btn[data-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (selectedTriggers.has(tag)) {
          selectedTriggers.delete(tag);
          btn.classList.remove('active');
        } else {
          selectedTriggers.add(tag);
          btn.classList.add('active');
        }
      });
    });

    // Save
    container.querySelector('#save-reflect-btn')?.addEventListener('click', async () => {
      const peakUrge = parseInt(container.querySelector('#range-peak-urge')?.value || 1);
      const unstructuredBtn = container.querySelector('#unstructured-group .segment-btn.active');
      const unstructuredTime = unstructuredBtn ? unstructuredBtn.dataset.val === 'yes' : null;
      const observations = container.querySelector('#reflect-notes')?.value?.trim() || '';

      const entry = {
        id: existing?.id || generateId(),
        date: today,
        slipped: slipped,
        peak_urge: peakUrge,
        unstructured_time: unstructuredTime,
        triggers: [...selectedTriggers],
        observations,
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

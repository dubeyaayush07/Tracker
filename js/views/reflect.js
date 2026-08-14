import { dbPut, dbGetAll, generateId, getReflectionByDate } from '../db.js';
import { getToday, formatDate } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

const TRIGGER_TAGS = ['Evening', 'Boredom', 'Hunger', 'Stress', 'Fatigue', 'Social', 'Anxiety', 'Other'];
const GOOD_FACTORS = [
  'Exercise', 'Kindness', 'Honesty', 'Doing things', 'Focus', 'Attention', 
  'Concentration', 'Sleep', 'Care for yourself', 'Diet', 'Hygiene', 
  'Asking for help', 'Connecting with people', 'Feeling good peace'
];
const BAD_FACTORS = [
  'Guilt', 'Permissibility', 'Self flagellation', 'THC', 'Worrying', 
  'OCD', 'Rumination', 'Anxiety', 'Substance abuse', 'Craving', 
  'Instant gratification', 'Analysis'
];

export async function renderReflect(container) {
  const today = getToday();
  const existing = await getReflectionByDate(today);

  let slipped = existing?.slipped ?? null; // null = not selected yet
  let selectedTriggers = new Set(existing?.triggers || []);
  let selectedSubstance = existing?.slip_substance || null;
  let selectedGoodFactors = new Set(existing?.good_factors || []);
  let selectedBadFactors = new Set(existing?.bad_factors || []);

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

    const goodTags = GOOD_FACTORS.map(t => `
      <button class="tag-btn ${selectedGoodFactors.has(t) ? 'active' : ''}" data-good="${t}">${t}</button>
    `).join('');

    const badTags = BAD_FACTORS.map(t => `
      <button class="tag-btn ${selectedBadFactors.has(t) ? 'active' : ''}" data-bad="${t}">${t}</button>
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
            <label class="form-label">Unstructured free time today?</label>
            <div class="segment-group" id="unstructured-group">
              <button class="segment-btn ${existing?.unstructured_time === false ? 'active' : ''}" data-val="no">No</button>
              <button class="segment-btn ${existing?.unstructured_time === true ? 'active' : ''}" data-val="yes">Yes</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">What triggered the strongest urge? <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <div class="tag-group">${triggerTags}</div>
          </div>

          <div class="form-group">
            <label class="form-label">Positive things today <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <div class="tag-group" id="good-factors-group">${goodTags}</div>
          </div>

          <div class="form-group">
            <label class="form-label">Negative things today <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <div class="tag-group" id="bad-factors-group">${badTags}</div>
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

    // Unstructured segment
    container.querySelectorAll('#unstructured-group .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#unstructured-group .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Trigger Tags
    container.querySelectorAll('.tag-group:not(#good-factors-group):not(#bad-factors-group) .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tag;
        if (selectedTriggers.has(t)) selectedTriggers.delete(t);
        else selectedTriggers.add(t);
        btn.classList.toggle('active');
      });
    });

    container.querySelectorAll('#good-factors-group .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.good;
        if (selectedGoodFactors.has(t)) selectedGoodFactors.delete(t);
        else selectedGoodFactors.add(t);
        btn.classList.toggle('active');
      });
    });

    container.querySelectorAll('#bad-factors-group .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.bad;
        if (selectedBadFactors.has(t)) selectedBadFactors.delete(t);
        else selectedBadFactors.add(t);
        btn.classList.toggle('active');
      });
    });

    // Save
    container.querySelector('#save-reflect-btn')?.addEventListener('click', async () => {
      const peakUrge = parseInt(container.querySelector('#range-peak-urge')?.value || 1);
      const unstructuredBtn = container.querySelector('#unstructured-group .segment-btn.active');
      const unstruct = unstructuredBtn ? unstructuredBtn.dataset.val === 'yes' : null;
      const notes = container.querySelector('#reflect-notes')?.value?.trim() || '';

      const entry = {
        id: existing?.id || generateId(),
        date: today,
        slipped: slipped,
        slip_substance: slipped === true ? selectedSubstance : null,
        peak_urge: peakUrge,
        unstructured_time: unstruct,
        triggers: Array.from(selectedTriggers),
        good_factors: Array.from(selectedGoodFactors),
        bad_factors: Array.from(selectedBadFactors),
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

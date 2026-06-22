import { dbPut, getCheckpoints, generateId } from '../db.js';
import { getToday, formatTime, getSuggestedCheckpoint } from '../utils/time.js';
import { navigate, showToast } from '../app.js';

function makeSlider(id, label, min, max, value, descLow, descHigh) {
  return `
    <div class="slider-container" id="slider-${id}">
      <div class="slider-label-row">
        <span class="slider-label">${label}</span>
        <span class="slider-value" id="val-${id}">${value}</span>
      </div>
      <input type="range" id="range-${id}" min="${min}" max="${max}" value="${value}" aria-label="${label}">
      <div class="slider-desc">
        <span>${descLow}</span>
        <span>${descHigh}</span>
      </div>
    </div>
  `;
}

export async function renderLog(container, params = {}) {
  const checkpoints = await getCheckpoints();
  const suggested = getSuggestedCheckpoint(checkpoints);
  const initialCp = params.cp 
    ? checkpoints.find(c => c.id === params.cp) || suggested 
    : suggested;

  let selectedCp = initialCp.id;
  let isCravingMoment = false;

  function buildForm() {
    const isMorning = selectedCp === 'morning';
    const cpChips = checkpoints.map(cp => `
      <button class="cp-chip ${selectedCp === cp.id && !isCravingMoment ? 'active' : ''}" 
              data-cp="${cp.id}">${cp.label}</button>
    `).join('');

    return `
      <div class="log-view view-enter">
        <div class="log-header">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:1.375rem;font-weight:700;letter-spacing:-0.02em">Quick Log</div>
              <div style="font-size:0.8125rem;color:var(--text-2);margin-top:2px">${formatTime()}</div>
            </div>
            <span class="badge badge-primary" style="font-size:0.75rem">${isCravingMoment ? 'Urge Spike' : checkpoints.find(c => c.id === selectedCp)?.label || ''}</span>
          </div>
        </div>

        <div class="log-cp-selector">
          ${cpChips}
          <button class="cp-chip ${isCravingMoment ? 'active' : ''}" id="cp-craving-moment">⚡ Right now</button>
        </div>

        <div class="log-form-section">
          ${makeSlider('energy', 'Energy', 1, 10, 5, 'Exhausted', 'Energetic')}
          ${makeSlider('craving', 'Urge', 1, 10, 1, 'None', 'Overwhelming')}
          ${makeSlider('mood', 'Mood', 1, 10, 5, 'Very low', 'Very positive')}

          <div class="form-group">
            <label class="form-label">Following the plan?</label>
            <div class="segment-group" id="adherence-group">
              <button class="segment-btn active" data-val="yes">Yes</button>
              <button class="segment-btn" data-val="mostly">Mostly</button>
              <button class="segment-btn" data-val="no">No</button>
            </div>
          </div>

          <div id="deviation-section" style="display:none" class="form-group">
            <label class="form-label">What happened?</label>
            <select id="deviation-reason">
              <option value="">Select reason…</option>
              <option value="skipped">Skipped an activity</option>
              <option value="free_time">Unplanned free time appeared</option>
              <option value="interruption">External interruption</option>
              <option value="chose">Chose to deviate (that's okay)</option>
            </select>
          </div>

          ${isMorning ? `
            <div class="form-group" id="sleep-section">
              <label class="form-label">Sleep (morning only)</label>
              <div style="display:flex;gap:10px">
                <div style="flex:1">
                  <input type="number" id="sleep-hours" placeholder="Hours" min="0" max="14" step="0.5">
                </div>
                <div style="flex:1">
                  ${makeSlider('sleep-quality', 'Quality', 1, 5, 3, 'Poor', 'Great')}
                </div>
              </div>
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label">Notes <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <textarea id="log-notes" placeholder="Anything to note? Strong craving, neck tension, gym helped…" rows="3"></textarea>
          </div>

          <button class="btn btn-primary" id="save-log-btn">Save Entry</button>
        </div>
      </div>
    `;
  }

  function mount() {
    container.innerHTML = buildForm();
    bindEvents();
  }

  function bindEvents() {
    // Slider live values
    ['energy', 'craving', 'mood', 'sleep-quality'].forEach(id => {
      const range = container.querySelector(`#range-${id}`);
      const val = container.querySelector(`#val-${id}`);
      if (range && val) {
        range.addEventListener('input', () => { val.textContent = range.value; });
      }
    });

    // Checkpoint chips
    container.querySelectorAll('.cp-chip[data-cp]').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedCp = chip.dataset.cp;
        isCravingMoment = false;
        mount();
      });
    });

    container.querySelector('#cp-craving-moment')?.addEventListener('click', () => {
      isCravingMoment = true;
      selectedCp = null;
      mount();
    });

    // Adherence segments
    const adherenceGroup = container.querySelector('#adherence-group');
    let currentAdherence = 'yes';
    if (adherenceGroup) {
      adherenceGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          adherenceGroup.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentAdherence = btn.dataset.val;
          const devSection = container.querySelector('#deviation-section');
          if (devSection) devSection.style.display = currentAdherence === 'no' ? '' : 'none';
        });
      });
    }

    // Save
    container.querySelector('#save-log-btn')?.addEventListener('click', async () => {
      const energy = parseInt(container.querySelector('#range-energy')?.value || 5);
      const craving = parseInt(container.querySelector('#range-craving')?.value || 1);
      const mood = parseInt(container.querySelector('#range-mood')?.value || 5);
      const notes = container.querySelector('#log-notes')?.value?.trim() || '';
      const deviation = container.querySelector('#deviation-reason')?.value || '';
      const sleepHours = parseFloat(container.querySelector('#sleep-hours')?.value || 0) || null;
      const sleepQuality = parseInt(container.querySelector('#range-sleep-quality')?.value || 3);

      const adherenceBtn = container.querySelector('#adherence-group .segment-btn.active');
      const adherence = adherenceBtn ? adherenceBtn.dataset.val : 'yes';

      const entry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        date: getToday(),
        type: isCravingMoment ? 'urge_moment' : 'checkpoint',
        checkpoint: isCravingMoment ? 'urge_moment' : selectedCp,
        energy,
        craving,
        mood,
        adherence,
        deviation_reason: adherence === 'no' ? deviation : null,
        sleep_hours: sleepHours,
        sleep_quality: container.querySelector('#range-sleep-quality') ? sleepQuality : null,
        notes,
      };

      const btn = container.querySelector('#save-log-btn');
      btn.textContent = 'Saving…';
      btn.disabled = true;

      await dbPut('logs', entry);
      showToast('Entry saved');
      navigate('/');
    });
  }

  mount();
}

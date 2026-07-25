import { dbPut, getCheckpoints, generateId, setSetting } from '../db.js';
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
  let selectedNegotiations = new Set();

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
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:0.875rem;cursor:pointer;color:var(--text-1)">
            <input type="checkbox" id="include-stats" checked>
            Include energy, urge, and mood stats
          </label>
          <div id="stats-section" style="transition:opacity 0.2s">
            ${makeSlider('energy', 'Energy', 1, 10, 5, 'Exhausted', 'Energetic')}
            ${makeSlider('craving', 'Urge', 1, 10, 1, 'None', 'Overwhelming')}
            ${makeSlider('mood', 'Mood', 1, 10, 5, 'Very low', 'Very positive')}
          </div>

          <div class="form-group">
            <label class="form-label">Following the plan? <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
            <div class="segment-group" id="adherence-group">
              <button class="segment-btn" data-val="yes">Yes</button>
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

          ${isCravingMoment ? `
            <div class="form-group" id="negotiation-section">
              <label class="form-label">Negotiation Category <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
              <div class="tag-group" id="negotiation-group">
                ${['Reward', 'Futility', 'Relief', 'Fantasy', 'Undermining', 'Substitution', 'Void', 'Inversion'].map(t => `
                  <button class="tag-btn ${selectedNegotiations.has(t) ? 'active' : ''}" data-tag="${t}">${t}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}

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

          <div id="dynamic-interventions" style="display:none; margin-bottom:16px;">
            <div id="tape-forward-section" style="display:none; margin-bottom:16px;">
              <label class="form-label" style="color:var(--primary);">Play the tape forward <span style="color:var(--text-3);font-weight:400;text-transform:none">(optional)</span></label>
              <textarea id="tape-forward-text" class="input" style="width:100%; min-height:60px; resize:vertical; padding:8px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:0.875rem; background:var(--bg);" placeholder="What does tomorrow morning look like if you use?"></textarea>
            </div>
            <div id="calm-day-section" style="display:none; padding:16px; background:var(--surface-2); border:1px solid var(--primary-dim); border-radius:var(--radius-sm);">
              <div style="font-weight:600; font-size:0.9375rem; color:var(--primary); margin-bottom:8px;">Calm-Day Decision Detected</div>
              <div style="font-size:0.8125rem; color:var(--text-2); margin-bottom:12px; line-height:1.4;">The desire to use right now feels completely rational and permanent. It isn't. Commit to a 24-hour gap.</div>
              <input type="text" id="calm-day-reason" class="input" style="width:100%; margin-bottom:12px; padding:8px; font-size:0.875rem; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg);" placeholder="I want to use because...">
              <label style="display:flex; align-items:flex-start; gap:8px; font-size:0.875rem; cursor:pointer;">
                <input type="checkbox" id="calm-day-commit" style="margin-top:2px;">
                <span>I commit to waiting 24 hours (until tomorrow) before acting on this decision.</span>
              </label>
            </div>
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
    function updateDynamicUI() {
      const interventions = container.querySelector('#dynamic-interventions');
      const tapeSection = container.querySelector('#tape-forward-section');
      const calmSection = container.querySelector('#calm-day-section');
      
      if (!interventions || !tapeSection || !calmSection) return;

      const include = container.querySelector('#include-stats')?.checked !== false;
      const craving = include ? parseInt(container.querySelector('#range-craving')?.value || 1) : null;
      const mood = include ? parseInt(container.querySelector('#range-mood')?.value || 5) : null;

      if (isCravingMoment && include && craving <= 4) {
        interventions.style.display = 'block';
        tapeSection.style.display = 'block';
        if (mood >= 6) {
          calmSection.style.display = 'block';
        } else {
          calmSection.style.display = 'none';
          const calmCommit = container.querySelector('#calm-day-commit');
          if (calmCommit) calmCommit.checked = false;
        }
      } else {
        interventions.style.display = 'none';
        tapeSection.style.display = 'none';
        calmSection.style.display = 'none';
        const calmCommit = container.querySelector('#calm-day-commit');
        if (calmCommit) calmCommit.checked = false;
      }
    }

    // Slider live values
    ['energy', 'craving', 'mood', 'sleep-quality'].forEach(id => {
      const range = container.querySelector(`#range-${id}`);
      const val = container.querySelector(`#val-${id}`);
      if (range && val) {
        range.addEventListener('input', () => { 
          val.textContent = range.value; 
          updateDynamicUI();
        });
      }
    });

    // Optional stats toggle
    const includeStats = container.querySelector('#include-stats');
    const statsSection = container.querySelector('#stats-section');
    if (includeStats && statsSection) {
      includeStats.addEventListener('change', (e) => {
        statsSection.style.opacity = e.target.checked ? '1' : '0.4';
        statsSection.style.pointerEvents = e.target.checked ? 'auto' : 'none';
        updateDynamicUI();
      });
    }

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

    // Negotiation segments
    const negotiationGroup = container.querySelector('#negotiation-group');
    if (negotiationGroup) {
      negotiationGroup.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.tag;
          if (selectedNegotiations.has(t)) {
            selectedNegotiations.delete(t);
            btn.classList.remove('active');
          } else {
            selectedNegotiations.add(t);
            btn.classList.add('active');
          }
        });
      });
    }

    // Adherence segments
    const adherenceGroup = container.querySelector('#adherence-group');
    let currentAdherence = null;
    if (adherenceGroup) {
      adherenceGroup.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Toggle off if clicking the already active button
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            currentAdherence = null;
            const devSection = container.querySelector('#deviation-section');
            if (devSection) devSection.style.display = 'none';
          } else {
            adherenceGroup.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAdherence = btn.dataset.val;
            const devSection = container.querySelector('#deviation-section');
            if (devSection) devSection.style.display = currentAdherence === 'no' ? '' : 'none';
          }
        });
      });
    }

    // Save
    container.querySelector('#save-log-btn')?.addEventListener('click', async () => {
      const include = container.querySelector('#include-stats')?.checked !== false;
      const energy = include ? parseInt(container.querySelector('#range-energy')?.value || 5) : null;
      const craving = include ? parseInt(container.querySelector('#range-craving')?.value || 1) : null;
      const mood = include ? parseInt(container.querySelector('#range-mood')?.value || 5) : null;
      const notes = container.querySelector('#log-notes')?.value?.trim() || '';
      const deviation = container.querySelector('#deviation-reason')?.value || '';
      const sleepHours = parseFloat(container.querySelector('#sleep-hours')?.value || 0) || null;
      const sleepQuality = parseInt(container.querySelector('#range-sleep-quality')?.value || 3);

      const adherenceBtn = container.querySelector('#adherence-group .segment-btn.active');
      const adherence = adherenceBtn ? adherenceBtn.dataset.val : null;

      const tapeText = container.querySelector('#tape-forward-text')?.value?.trim();
      const calmReason = container.querySelector('#calm-day-reason')?.value?.trim();
      const calmCommit = container.querySelector('#calm-day-commit')?.checked;
      
      let finalNotes = notes;
      if (tapeText) finalNotes += (finalNotes ? '\n\n' : '') + '[Tomorrow:] ' + tapeText;
      if (calmReason) finalNotes += (finalNotes ? '\n\n' : '') + '[Calm-Day Reason:] ' + calmReason;
      if (calmCommit) finalNotes += (finalNotes ? '\n\n' : '') + '[Action:] Committed to a 24-hour wait.';

      if (calmCommit) {
        await setSetting('lockdown_24h_end', Date.now() + (24 * 60 * 60 * 1000));
      }

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
        notes: finalNotes,
        negotiation_category: isCravingMoment && selectedNegotiations.size > 0 ? Array.from(selectedNegotiations) : null
      };

      const btn = container.querySelector('#save-log-btn');
      btn.textContent = 'Saving…';
      btn.disabled = true;

      await dbPut('logs', entry);
      showToast('Entry saved');
      navigate('/');
    });

    updateDynamicUI();
  }

  mount();
}

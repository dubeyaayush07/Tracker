import { dbGetAll, getCheckpoints } from '../db.js';
import { getLast30Days, formatShortDate, parseDateKey, daysAgo, dayOfWeekLabel } from '../utils/time.js';

let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch(e) {} });
  chartInstances = {};
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { 
    backgroundColor: '#1e1e24',
    borderColor: '#28282f',
    borderWidth: 1,
    titleColor: '#eeeef0',
    bodyColor: '#8888a0',
    padding: 10,
    cornerRadius: 8,
  }},
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55556a', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55556a', font: { size: 11 } } },
  },
};

export async function renderInsights(container) {
  destroyCharts();

  const [logs, reflections, checkpoints] = await Promise.all([
    dbGetAll('logs'),
    dbGetAll('reflections'),
    getCheckpoints(),
  ]);

  let activeTab = 'trends';

  function buildPage() {
    return `
      <div class="insights-view view-enter">
        <div class="page-header">
          <div class="page-header-title">Insights</div>
        </div>

        <div class="tab-bar">
          <button class="tab-btn ${activeTab === 'trends' ? 'active' : ''}" data-tab="trends">Trends</button>
          <button class="tab-btn ${activeTab === 'patterns' ? 'active' : ''}" data-tab="patterns">Patterns</button>
          <button class="tab-btn ${activeTab === 'days' ? 'active' : ''}" data-tab="days">Days</button>
        </div>

        <div id="tab-content">
          ${renderTabContent()}
        </div>
      </div>
    `;
  }

  function renderTabContent() {
    if (activeTab === 'trends') return renderTrends();
    if (activeTab === 'patterns') return renderPatterns();
    return renderDays();
  }

  function renderTrends() {
    const days = getLast30Days();
    
    // Clear day count
    const slippedDates = new Set(reflections.filter(r => r.slipped).map(r => r.date));
    const clearDays = reflections.filter(r => !r.slipped).length;
    const totalLogged = reflections.length;

    // Build avg craving/energy per day
    const dayData = days.map(date => {
      const dayLogs = logs.filter(l => l.date === date);
      const ref = reflections.find(r => r.date === date);
      const avgCraving = dayLogs.length > 0 ? dayLogs.reduce((s, l) => s + l.craving, 0) / dayLogs.length : null;
      const avgEnergy = dayLogs.length > 0 ? dayLogs.reduce((s, l) => s + l.energy, 0) / dayLogs.length : null;
      const peakCraving = ref?.peak_craving ?? null;
      return { date, avgUrge, avgEnergy, peakUrge, slipped: slippedDates.has(date) };
    });

    const last14 = dayData.slice(-14);
    const labels = last14.map(d => formatShortDate(parseDateKey(d.date)));
    const cravingData = last14.map(d => d.avgCraving);
    const energyData = last14.map(d => d.avgEnergy);

    // Summary stats
    const allUrges = logs.map(l => l.craving);
    const avgUrgeAll = allUrges.length ? (allUrges.reduce((a,b) => a+b, 0) / allUrges.length).toFixed(1) : '—';
    const last7Urges = logs.filter(l => {
      const d = new Date(l.date);
      const week = new Date(); week.setDate(week.getDate() - 7);
      return d >= week;
    }).map(l => l.craving);
    const avgUrgeWeek = last7Urges.length ? (last7Urges.reduce((a,b) => a+b, 0) / last7Urges.length).toFixed(1) : '—';

    return `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${clearDays}</div>
          <div class="stat-label">Clear days logged</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${logs.length}</div>
          <div class="stat-label">Total log entries</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgUrgeAll}</div>
          <div class="stat-label">Avg urge (all time)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgUrgeWeek}</div>
          <div class="stat-label">Avg urge (7 days)</div>
        </div>
      </div>

      <div class="insight-card">
        <div class="insight-card-title">Urge — last 14 days</div>
        ${logs.length < 3 ? `<div style="text-align:center;padding:32px 0;color:var(--text-3);font-size:0.875rem">Log more entries to see trends</div>` : `
          <div class="chart-wrap"><canvas id="chart-craving"></canvas></div>
        `}
      </div>

      <div class="insight-card">
        <div class="insight-card-title">Energy — last 14 days</div>
        ${logs.length < 3 ? `<div style="text-align:center;padding:32px 0;color:var(--text-3);font-size:0.875rem">Log more entries to see trends</div>` : `
          <div class="chart-wrap"><canvas id="chart-energy"></canvas></div>
        `}
      </div>

      <div class="insight-card">
        <div class="insight-card-title">Clear days (last 30)</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;padding:4px 0">
          ${days.map(d => `
            <div style="width:28px;height:28px;border-radius:6px;background:${
              !reflections.find(r => r.date === d) ? 'var(--surface-3)' :
              slippedDates.has(d) ? 'var(--danger-dim)' : 'var(--success-dim)'
            };display:flex;align-items:center;justify-content:center" title="${d}">
              ${slippedDates.has(d) ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` :
                reflections.find(r => r.date === d) ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:16px;margin-top:12px">
          <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-2)">
            <div style="width:12px;height:12px;border-radius:3px;background:var(--success-dim)"></div> Clear
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-2)">
            <div style="width:12px;height:12px;border-radius:3px;background:var(--danger-dim)"></div> Slipped
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--text-2)">
            <div style="width:12px;height:12px;border-radius:3px;background:var(--surface-3)"></div> No data
          </div>
        </div>
      </div>
    `;
  }

  function renderPatterns() {
    // Average craving by checkpoint
    const cpAvg = checkpoints.map(cp => {
      const cpLogs = logs.filter(l => l.checkpoint === cp.id);
      const avg = cpLogs.length > 0 ? cpLogs.reduce((s, l) => s + l.craving, 0) / cpLogs.length : 0;
      return { label: cp.label, avg: parseFloat(avg.toFixed(1)), count: cpLogs.length };
    });

    // Average urge by day of week
    const dowAvg = [0,1,2,3,4,5,6].map(dow => {
      const dowLogs = logs.filter(l => new Date(l.date + 'T12:00:00').getDay() === dow);
      const avg = dowLogs.length > 0 ? dowLogs.reduce((s, l) => s + l.craving, 0) / dowLogs.length : 0;
      return { label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow], avg: parseFloat(avg.toFixed(1)) };
    });

    // Gym effect: compare craving logs on days with gym vs without
    const gymLogs = logs.filter(l => l.checkpoint === 'after_gym');
    const afterGymAvg = gymLogs.length 
      ? (gymLogs.reduce((s, l) => s + l.craving, 0) / gymLogs.length).toFixed(1) 
      : null;
    const beforeGymLogs = logs.filter(l => l.checkpoint === 'end_of_work');
    const beforeGymAvg = beforeGymLogs.length
      ? (beforeGymLogs.reduce((s, l) => s + l.craving, 0) / beforeGymLogs.length).toFixed(1)
      : null;

    // Adherence effect
    const adherenceLogs = { yes: [], mostly: [], no: [] };
    logs.forEach(l => { if (adherenceLogs[l.adherence]) adherenceLogs[l.adherence].push(l.craving); });
    const adherenceAvg = Object.fromEntries(
      Object.entries(adherenceLogs).map(([k, v]) => [k, v.length ? (v.reduce((a,b) => a+b, 0) / v.length).toFixed(1) : '—'])
    );

    return `
      <div class="insight-card">
        <div class="insight-card-title">Average urge by checkpoint</div>
        ${logs.length < 3 ? `<div style="text-align:center;padding:32px 0;color:var(--text-3);font-size:0.875rem">Log more entries to see patterns</div>` : `
          <div class="chart-wrap"><canvas id="chart-cp-bar"></canvas></div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
            ${cpAvg.map(c => `
              <div style="display:flex;align-items:center;gap:10px">
                <div style="font-size:0.8125rem;width:110px;color:var(--text-2)">${c.label}</div>
                <div style="flex:1;height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${c.count > 0 ? (c.avg/10*100) : 0}%;background:var(--primary);border-radius:3px;transition:width 0.4s ease"></div>
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--primary);width:28px;text-align:right">${c.count > 0 ? c.avg : '—'}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      ${(afterGymAvg && beforeGymAvg) ? `
        <div class="insight-card">
          <div class="insight-card-title">Gym effect on urges</div>
          <div style="display:flex;gap:12px">
            <div class="stat-card" style="flex:1;margin:0">
              <div class="stat-value">${beforeGymAvg}</div>
              <div class="stat-label">Avg urge before gym</div>
            </div>
            <div class="stat-card" style="flex:1;margin:0">
              <div class="stat-value" style="color:${parseFloat(afterGymAvg) < parseFloat(beforeGymAvg) ? 'var(--success)' : 'var(--text)'}">${afterGymAvg}</div>
              <div class="stat-label">Avg urge after gym</div>
            </div>
          </div>
          ${parseFloat(afterGymAvg) < parseFloat(beforeGymAvg) ? `
            <div style="margin-top:12px;padding:10px 12px;background:var(--success-dim);border-radius:var(--radius-sm);font-size:0.8125rem;color:var(--success)">
              Gym reduces urges by ${(parseFloat(beforeGymAvg) - parseFloat(afterGymAvg)).toFixed(1)} points on average
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="insight-card">
        <div class="insight-card-title">Schedule adherence vs urge</div>
        <div style="display:flex;gap:10px">
          ${['yes','mostly','no'].map(k => `
            <div class="stat-card" style="flex:1;margin:0">
              <div class="stat-value" style="font-size:1.5rem">${adherenceAvg[k]}</div>
              <div class="stat-label">${k.charAt(0).toUpperCase() + k.slice(1)} plan</div>
            </div>
          `).join('')}
        </div>
        ${adherenceLogs.no.length > 0 && adherenceLogs.yes.length > 0 ? `
          <div style="margin-top:12px;padding:10px 12px;background:var(--primary-dim);border-radius:var(--radius-sm);font-size:0.8125rem;color:var(--text-2)">
            ${parseFloat(adherenceAvg.yes) < parseFloat(adherenceAvg.no) ? 
              `Following the plan correlates with lower urges (${(parseFloat(adherenceAvg.no) - parseFloat(adherenceAvg.yes)).toFixed(1)} point difference)` :
              'Not enough data yet to see a clear adherence pattern'}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderDays() {
    const days = getLast30Days().reverse();
    const reflMap = Object.fromEntries(reflections.map(r => [r.date, r]));
    const logsByDate = {};
    logs.forEach(l => { if (!logsByDate[l.date]) logsByDate[l.date] = []; logsByDate[l.date].push(l); });

    const items = days
      .filter(d => logsByDate[d] || reflMap[d])
      .map(d => {
        const dayLogs = logsByDate[d] || [];
        const ref = reflMap[d];
        const avgC = dayLogs.length ? (dayLogs.reduce((s,l) => s+l.craving, 0) / dayLogs.length).toFixed(0) : '—';
        const avgE = dayLogs.length ? (dayLogs.reduce((s,l) => s+l.energy, 0) / dayLogs.length).toFixed(0) : '—';
        const peakC = ref?.peak_urge ?? '—';
        const slipped = ref ? (ref.slipped ? '✓' : '✗') : '—';
        const slippedColor = ref ? (ref.slipped ? 'var(--danger)' : 'var(--success)') : 'var(--text-3)';

        return `
          <div class="day-log-item">
            <div>
              <div class="day-log-date">${formatShortDate(parseDateKey(d))}</div>
              <div class="day-log-ago">${daysAgo(d)}</div>
            </div>
            <div class="day-log-stats">
              <div class="day-stat">
                <div class="day-stat-val" style="color:${avgC !== '—' && parseInt(avgC) >= 7 ? 'var(--danger)' : parseInt(avgC) >= 4 ? 'var(--warning)' : 'var(--text)'}">${avgC}</div>
                <div class="day-stat-key">Craving</div>
              </div>
              <div class="day-stat">
                <div class="day-stat-val">${avgE}</div>
                <div class="day-stat-key">Energy</div>
              </div>
              <div class="day-stat">
                <div class="day-stat-val">${peakC}</div>
                <div class="day-stat-key">Peak</div>
              </div>
              <div class="day-stat">
                <div class="day-stat-val" style="color:${slippedColor}">${slipped}</div>
                <div class="day-stat-key">Clear</div>
              </div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-3)">${dayLogs.length} log${dayLogs.length !== 1 ? 's' : ''}</div>
          </div>
        `;
      }).join('') || `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <p style="font-weight:500;margin-bottom:6px">No data yet</p>
        <p style="font-size:0.8125rem">Start logging to see your daily history</p>
      </div>`;

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:12px 16px;overflow:hidden">
        <div style="display:flex;padding:10px 16px;border-bottom:1px solid var(--border)">
          <div style="min-width:70px;font-size:0.7rem;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em">Date</div>
          <div style="flex:1;font-size:0.7rem;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em">Craving · Energy · Peak · THC</div>
        </div>
        ${items}
      </div>
    `;
  }

  function mount() {
    container.innerHTML = buildPage();
    bindEvents();
    // Draw charts after DOM is ready
    requestAnimationFrame(() => drawCharts());
  }

  function bindEvents() {
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        destroyCharts();
        activeTab = btn.dataset.tab;
        mount();
      });
    });
  }

  function drawCharts() {
    if (typeof Chart === 'undefined') return;

    const days = getLast30Days();
    const last14 = days.slice(-14);
    const labels = last14.map(d => formatShortDate(parseDateKey(d)));

    if (activeTab === 'trends') {
      const cravingCanvas = container.querySelector('#chart-craving');
      const energyCanvas = container.querySelector('#chart-energy');

      if (cravingCanvas) {
        const urgeData = last14.map(d => {
          const dayLogs = logs.filter(l => l.date === d);
          return dayLogs.length ? parseFloat((dayLogs.reduce((s,l) => s+l.craving, 0) / dayLogs.length).toFixed(1)) : null;
        });

        chartInstances['craving'] = new Chart(cravingCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              data: urgeData,
              borderColor: '#ff6b7a',
              backgroundColor: 'rgba(255,107,122,0.08)',
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#ff6b7a',
              pointRadius: 4,
              pointHoverRadius: 6,
              spanGaps: true,
            }]
          },
          options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 10 } } }
        });
      }

      if (energyCanvas) {
        const energyData = last14.map(d => {
          const dayLogs = logs.filter(l => l.date === d);
          return dayLogs.length ? parseFloat((dayLogs.reduce((s,l) => s+l.energy, 0) / dayLogs.length).toFixed(1)) : null;
        });

        chartInstances['energy'] = new Chart(energyCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              data: energyData,
              borderColor: '#8b7cf6',
              backgroundColor: 'rgba(139,124,246,0.08)',
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#8b7cf6',
              pointRadius: 4,
              pointHoverRadius: 6,
              spanGaps: true,
            }]
          },
          options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 10 } } }
        });
      }
    }

    if (activeTab === 'patterns') {
      const cpCanvas = container.querySelector('#chart-cp-bar');
      if (cpCanvas) {
        const cpData = checkpoints.map(cp => {
          const cpLogs = logs.filter(l => l.checkpoint === cp.id);
          return cpLogs.length ? parseFloat((cpLogs.reduce((s,l) => s+l.craving, 0) / cpLogs.length).toFixed(1)) : 0;
        });

        chartInstances['cp'] = new Chart(cpCanvas, {
          type: 'bar',
          data: {
            labels: checkpoints.map(c => c.label),
            datasets: [{
              data: cpData,
              backgroundColor: cpData.map(v => v >= 7 ? 'rgba(255,107,122,0.7)' : v >= 4 ? 'rgba(255,169,77,0.7)' : 'rgba(139,124,246,0.7)'),
              borderRadius: 6,
            }]
          },
          options: { ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 10 } } }
        });
      }
    }
  }

  mount();
}

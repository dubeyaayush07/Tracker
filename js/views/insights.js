import { dbGetAll } from '../db.js';
import { getLast30Days, formatShortDate, parseDateKey, daysAgo, dateKey } from '../utils/time.js';
import { navigate } from '../app.js';

let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch (e) {} });
  chartInstances = {};
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 10, right: 8 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e1e24',
      borderColor: '#28282f',
      borderWidth: 1,
      titleColor: '#eeeef0',
      bodyColor: '#8888a0',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6c6c84', font: { size: 11 }, autoSkip: true, maxTicksLimit: 8 } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6c6c84', font: { size: 11 } } },
  },
};

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getWorryDate(w) {
  if (w.date) return w.date;
  if (w.createdAt) return dateKey(new Date(w.createdAt));
  return null;
}

function avgStr(nums) {
  return nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : '—';
}

function scoreColor(val) {
  if (val === null || val === undefined || val === '—') return 'var(--text-3)';
  const n = Number(val);
  if (n >= 7) return 'var(--danger)';
  if (n >= 4) return 'var(--warning)';
  return 'var(--text)';
}

export async function renderInsights(container) {
  destroyCharts();

  const [reflections, worries] = await Promise.all([
    dbGetAll('reflections'),
    dbGetAll('worries'),
  ]);

  const days30 = getLast30Days();
  const days30Set = new Set(days30);
  const last7Set = new Set(days30.slice(-7));

  const reflMap = Object.fromEntries(reflections.map(r => [r.date, r]));
  const worriesByDate = {};
  worries.forEach(w => {
    const d = getWorryDate(w);
    if (!d) return;
    if (!worriesByDate[d]) worriesByDate[d] = [];
    worriesByDate[d].push(w);
  });
  Object.values(worriesByDate).forEach(list =>
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  );

  const allActiveDays = Array.from(
    new Set([...Object.keys(reflMap), ...Object.keys(worriesByDate)])
  ).sort((a, b) => b.localeCompare(a));

  let activeTab = 'trends';
  let chartRange = '14';
  let daysLimit = 30;
  const MENTAL_SERIES = [
    { key: 'peak_urge', label: 'Peak urge', color: '#ff6b7a', bg: 'rgba(255, 107, 122, 0.14)' },
    { key: 'pressure', label: 'Pressure', color: '#ffa94d', bg: 'rgba(255, 169, 77, 0.14)' },
    { key: 'guilt', label: 'Guilt', color: '#8b7cf6', bg: 'rgba(139, 124, 246, 0.14)' },
  ];
  const visibleSeries = new Set(['peak_urge', 'pressure', 'guilt']);

  function getChartDays(range) {
    const todayStr = dateKey(new Date());
    if (range === 'all') {
      const earliest = allActiveDays[allActiveDays.length - 1];
      if (!earliest) return days30.slice(-14);
      const start = parseDateKey(earliest);
      const end = parseDateKey(todayStr);
      const out = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        out.push(dateKey(d));
      }
      return out.length >= 14 ? out : days30.slice(-14);
    }
    const count = parseInt(range, 10);
    const out = [];
    const today = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(dateKey(d));
    }
    return out;
  }

  function groupByWeek(chartDays) {
    const weekBuckets = new Map();
    chartDays.forEach(d => {
      const dt = parseDateKey(d);
      const day = dt.getDay();
      dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
      const wk = dateKey(dt);
      if (!weekBuckets.has(wk)) weekBuckets.set(wk, []);
      weekBuckets.get(wk).push(d);
    });
    return Array.from(weekBuckets.entries());
  }

  function buildMentalSeries(chartDays, range) {
    const avgVals = (arr) => arr.length ? parseFloat((arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(1)) : null;

    if (range === '14') {
      return {
        labels: chartDays.map(d => formatShortDate(parseDateKey(d))),
        ptRadius: 3.5,
        getSeries: (key) => chartDays.map(d => reflMap[d]?.[key] ?? null),
      };
    }

    if (range === '30') {
      return {
        labels: chartDays.map(d => formatShortDate(parseDateKey(d))),
        ptRadius: 0,
        getSeries: (key) => chartDays.map(d => {
          const end = parseDateKey(d);
          const vals = [];
          for (let i = 0; i < 7; i++) {
            const wd = new Date(end);
            wd.setDate(end.getDate() - i);
            const v = reflMap[dateKey(wd)]?.[key];
            if (v != null) vals.push(v);
          }
          return avgVals(vals);
        }),
      };
    }

    const weeks = groupByWeek(chartDays);
    return {
      labels: weeks.map(([wk]) => formatShortDate(parseDateKey(wk))),
      ptRadius: weeks.length > 35 ? 2 : 3,
      getSeries: (key) => weeks.map(([, days]) =>
        avgVals(days.map(d => reflMap[d]?.[key]).filter(v => v != null))
      ),
    };
  }

  function buildWorrySeries(chartDays, range) {
    if (range === '14' || range === '30') {
      return {
        labels: chartDays.map(d => formatShortDate(parseDateKey(d))),
        counts: chartDays.map(d => worriesByDate[d]?.length || 0),
        borderRadius: range === '30' ? 3 : 5,
      };
    }
    const weeks = groupByWeek(chartDays);
    return {
      labels: weeks.map(([wk]) => formatShortDate(parseDateKey(wk))),
      counts: weeks.map(([, days]) => days.reduce((s, d) => s + (worriesByDate[d]?.length || 0), 0)),
      borderRadius: 4,
    };
  }

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
    const slippedDates = new Set(reflections.filter(r => r.slipped).map(r => r.date));
    const clearDays = reflections.filter(r => !r.slipped).length;

    const refs7 = reflections.filter(r => last7Set.has(r.date));
    const avgUrge7 = avgStr(refs7.map(r => r.peak_urge).filter(v => v != null));
    const avgPress7 = avgStr(refs7.map(r => r.pressure).filter(v => v != null));
    const avgGuilt7 = avgStr(refs7.map(r => r.guilt).filter(v => v != null));
    const worries7Count = worries.filter(w => last7Set.has(getWorryDate(w))).length;

    const chartDays = getChartDays(chartRange);
    const rangeLabel = chartRange === 'all' ? 'all time' : `last ${chartRange} days`;
    const mentalTitle = chartRange === '14'
      ? 'Mental load — last 14 days'
      : chartRange === '30'
        ? 'Mental load — 7d rolling avg (30d)'
        : chartRange === '90'
          ? 'Mental load — weekly avg (90d)'
          : 'Mental load — weekly avg (all time)';
    const worriesTitle = chartRange === '14'
      ? 'Daily worries — last 14 days'
      : chartRange === '30'
        ? 'Daily worries — last 30 days'
        : chartRange === '90'
          ? 'Weekly worries — last 90 days'
          : 'Weekly worries — all time';
    const refsInRangeCount = chartDays.filter(d => reflMap[d]).length;
    const worriesInRangeTotal = chartDays.reduce((s, d) => s + (worriesByDate[d]?.length || 0), 0);

    return `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${clearDays}</div>
          <div class="stat-label">Clear days logged</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgUrge7}</div>
          <div class="stat-label">Avg peak urge (7d)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${worries7Count}</div>
          <div class="stat-label">Worries noted (7d)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="font-size:1.375rem;line-height:1.55">${avgPress7} <span style="color:var(--text-3)">/</span> ${avgGuilt7}</div>
          <div class="stat-label">Press / Guilt avg (7d)</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 16px 2px">
        <span style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-3)">Chart Range</span>
        <div style="display:flex;gap:6px">
          ${[
            ['14', '14D'],
            ['30', '30D'],
            ['90', '90D'],
            ['all', 'All'],
          ].map(([val, lbl]) => `
            <button class="cp-chip chart-range-btn ${chartRange === val ? 'active' : ''}" data-range="${val}" style="padding:4px 10px;font-size:0.75rem">${lbl}</button>
          `).join('')}
        </div>
      </div>

      <div class="insight-card">
        <div class="insight-card-title">${mentalTitle}</div>
        ${refsInRangeCount < 2 ? `<div style="text-align:center;padding:32px 0;color:var(--text-3);font-size:0.875rem">Save at least 2 reflections to see trends</div>` : `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            ${MENTAL_SERIES.map(s => {
              const on = visibleSeries.has(s.key);
              return `
                <button class="mental-toggle-btn" data-series="${s.key}" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-full);border:1px solid ${on ? s.color : 'var(--border)'};background:${on ? s.bg : 'transparent'};color:${on ? 'var(--text)' : 'var(--text-3)'};font-family:inherit;font-size:0.75rem;font-weight:500;cursor:pointer;opacity:${on ? '1' : '0.6'};transition:all var(--transition);-webkit-tap-highlight-color:transparent">
                  <span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block"></span>
                  ${s.label}
                </button>
              `;
            }).join('')}
          </div>
          <div class="chart-wrap"><canvas id="chart-mental-load"></canvas></div>
        `}
      </div>

      <div class="insight-card">
        <div class="insight-card-title">${worriesTitle}</div>
        ${worriesInRangeTotal === 0 ? `<div style="text-align:center;padding:32px 0;color:var(--text-3);font-size:0.875rem">No worries logged in ${rangeLabel}</div>` : `
          <div class="chart-wrap"><canvas id="chart-worries-14d"></canvas></div>
        `}
      </div>

      <div class="insight-card">
        <div class="insight-card-title">Clear days (last 30)</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;padding:4px 0">
          ${days30.map(d => `
            <div style="width:28px;height:28px;border-radius:6px;background:${
              !reflMap[d] ? 'var(--surface-3)' :
              slippedDates.has(d) ? 'var(--danger-dim)' : 'var(--success-dim)'
            };display:flex;align-items:center;justify-content:center" title="${d}">
              ${slippedDates.has(d) ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` :
                reflMap[d] ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
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
    const refs30 = reflections.filter(r => days30Set.has(r.date));
    const worries30 = worries.filter(w => days30Set.has(getWorryDate(w)));

    const urge30 = refs30.map(r => r.peak_urge).filter(v => v != null);
    const press30 = refs30.map(r => r.pressure).filter(v => v != null);
    const guilt30 = refs30.map(r => r.guilt).filter(v => v != null);
    const wInt30 = worries30.map(w => w.intensity).filter(v => v != null && v > 0);

    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowStats = dowNames.map((label, dow) => {
      const dowDays = days30.filter(d => parseDateKey(d).getDay() === dow);
      const dowUrges = dowDays.map(d => reflMap[d]?.peak_urge).filter(v => v != null);
      const dowWorries = dowDays.reduce((s, d) => s + (worriesByDate[d]?.length || 0), 0);
      const avg = dowUrges.length ? parseFloat((dowUrges.reduce((s, n) => s + n, 0) / dowUrges.length).toFixed(1)) : null;
      return { label, avg, count: dowUrges.length, worries: dowWorries };
    });

    const highWorries = worries30
      .filter(w => w.intensity >= 7)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    const snapshotRow = (label, val, sub, color = 'var(--text)') => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>
          <span style="font-size:0.875rem;color:var(--text)">${label}</span>
          <span style="font-size:0.75rem;color:var(--text-3);margin-left:6px">${sub}</span>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:${color}">${val}</span>
      </div>
    `;

    return `
      <div class="insight-card">
        <div class="insight-card-title">30-day snapshot</div>
        ${refs30.length === 0 && worries30.length === 0 ? `<div style="text-align:center;padding:24px 0;color:var(--text-3);font-size:0.875rem">No data in the last 30 days</div>` : `
          <div style="display:flex;flex-direction:column">
            ${snapshotRow('Avg peak urge', avgStr(urge30), `${urge30.length} day${urge30.length !== 1 ? 's' : ''}`, scoreColor(avgStr(urge30)))}
            ${snapshotRow('Avg pressure', avgStr(press30), `${press30.length} rated`, scoreColor(avgStr(press30)))}
            ${snapshotRow('Avg guilt', avgStr(guilt30), `${guilt30.length} rated`, scoreColor(avgStr(guilt30)))}
            <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0 0">
              <div>
                <span style="font-size:0.875rem;color:var(--text)">Avg worry intensity</span>
                <span style="font-size:0.75rem;color:var(--text-3);margin-left:6px">${wInt30.length} of ${worries30.length} rated</span>
              </div>
              <span style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:${scoreColor(avgStr(wInt30))}">${avgStr(wInt30)}</span>
            </div>
          </div>
        `}
      </div>

      <div class="insight-card">
        <div class="insight-card-title">Avg peak urge & worries by day (30d)</div>
        ${refs30.length < 3 && worries30.length === 0 ? `<div style="text-align:center;padding:24px 0;color:var(--text-3);font-size:0.875rem">Log more reflections to spot weekly patterns</div>` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${dowStats.map(d => `
              <div style="display:flex;align-items:center;gap:10px">
                <div style="font-size:0.8125rem;width:36px;color:var(--text-2);font-weight:500">${d.label}</div>
                <div style="flex:1;height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${d.avg !== null ? (d.avg / 10 * 100) : 0}%;background:${d.avg >= 7 ? 'var(--danger)' : d.avg >= 4 ? 'var(--warning)' : 'var(--primary)'};border-radius:3px;transition:width 0.4s ease"></div>
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.8125rem;color:${d.avg !== null ? 'var(--text)' : 'var(--text-3)'};width:30px;text-align:right">${d.avg !== null ? d.avg.toFixed(1) : '—'}</div>
                <div style="font-size:0.75rem;color:var(--text-3);width:54px;text-align:right">${d.worries} ${d.worries === 1 ? 'worry' : 'worries'}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="insight-card">
        <div class="insight-card-title">High-intensity worries (7+ · 30d)</div>
        ${highWorries.length === 0 ? `<div style="font-size:0.875rem;color:var(--text-3);padding:8px 0">No worries rated 7 or higher in the last 30 days.</div>` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${highWorries.map(w => {
              const d = getWorryDate(w);
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm)">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:0.875rem;color:var(--text);line-height:1.4;word-break:break-word">${esc(w.text)}</div>
                    <div style="font-size:0.75rem;color:var(--text-3);margin-top:2px">${d ? formatShortDate(parseDateKey(d)) : ''}</div>
                  </div>
                  <span style="padding:3px 8px;border-radius:6px;background:${w.intensity >= 8 ? 'var(--danger-dim)' : 'var(--warning-dim)'};color:${w.intensity >= 8 ? 'var(--danger)' : 'var(--warning)'};font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:600;flex-shrink:0">
                    ${w.intensity}/10
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderDays() {
    const visibleDays = allActiveDays.slice(0, daysLimit);
    const remainingCount = allActiveDays.length - visibleDays.length;

    const items = visibleDays
      .map((d, idx) => {
        const ref = reflMap[d];
        const dayWorries = worriesByDate[d] || [];
        const peak = ref?.peak_urge ?? '—';
        const press = ref?.pressure ?? '—';
        const guilt = ref?.guilt ?? '—';
        const worryCount = dayWorries.length > 0 ? dayWorries.length : '—';
        const slipped = ref ? (ref.slipped ? '✗' : '✓') : '—';
        const slippedColor = ref ? (ref.slipped ? 'var(--danger)' : 'var(--success)') : 'var(--text-3)';
        const notes = ref?.observations?.trim() || '';
        const isLast = idx === visibleDays.length - 1;

        return `
          <div class="day-item-wrap" style="${isLast ? '' : 'border-bottom:1px solid var(--border)'}">
            <div class="day-log-item" data-date="${d}" style="cursor:pointer;border-bottom:none;-webkit-tap-highlight-color:transparent">
              <div>
                <div class="day-log-date">${formatShortDate(parseDateKey(d))}</div>
                <div class="day-log-ago">${daysAgo(d)}</div>
              </div>
              <div class="day-log-stats" style="justify-content:space-between;gap:6px">
                <div class="day-stat">
                  <div class="day-stat-val" style="color:${scoreColor(peak)}">${peak}</div>
                  <div class="day-stat-key">Urge</div>
                </div>
                <div class="day-stat">
                  <div class="day-stat-val" style="color:${scoreColor(press)}">${press}</div>
                  <div class="day-stat-key">Press</div>
                </div>
                <div class="day-stat">
                  <div class="day-stat-val" style="color:${scoreColor(guilt)}">${guilt}</div>
                  <div class="day-stat-key">Guilt</div>
                </div>
                <div class="day-stat">
                  <div class="day-stat-val" style="color:${dayWorries.length > 0 ? 'var(--text)' : 'var(--text-3)'}">${worryCount}</div>
                  <div class="day-stat-key">Wrry</div>
                </div>
                <div class="day-stat">
                  <div class="day-stat-val" style="color:${slippedColor}">${slipped}</div>
                  <div class="day-stat-key">Clear</div>
                </div>
              </div>
              <svg class="day-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3);flex-shrink:0;transition:transform 0.2s ease"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="day-detail" style="display:none;padding:0 16px 14px">
              ${notes ? `
                <div style="padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.8125rem;color:var(--text-2);line-height:1.45;white-space:pre-wrap;margin-bottom:${dayWorries.length > 0 ? '8px' : '0'}">${esc(notes)}</div>
              ` : ''}
              ${dayWorries.length > 0 ? `
                <div style="display:flex;flex-direction:column;gap:6px">
                  ${dayWorries.map(w => `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm)">
                      <div style="flex:1;min-width:0">
                        <div style="font-size:0.8125rem;color:var(--text);line-height:1.4;word-break:break-word">${esc(w.text)}</div>
                        <div style="font-size:0.6875rem;color:var(--text-3);margin-top:2px">${new Date(w.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                      ${w.intensity ? `
                        <span style="padding:2px 7px;border-radius:6px;background:var(--warning-dim);color:var(--warning);font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:600;flex-shrink:0">${w.intensity}/10</span>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${!notes && dayWorries.length === 0 ? `
                <div style="font-size:0.75rem;color:var(--text-3);font-style:italic">No notes or worries recorded</div>
              ` : ''}
              <div style="margin-top:10px;display:flex;justify-content:flex-end">
                <button class="btn btn-xs btn-ghost edit-day-reflect" data-date="${d}" style="font-size:0.75rem">
                  ${ref ? 'Edit reflection' : 'Add reflection'}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('') || `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <p style="font-weight:500;margin-bottom:6px">No reflections yet</p>
        <p style="font-size:0.8125rem">Save a reflection or note a worry to see your daily history</p>
      </div>`;

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:12px 16px;overflow:hidden">
        ${items}
      </div>
      ${remainingCount > 0 ? `
        <div style="padding:4px 16px 16px">
          <button class="btn btn-secondary" id="load-more-days" style="width:100%">
            Show older (${remainingCount} more)
          </button>
        </div>
      ` : ''}
    `;
  }

  function mount() {
    container.innerHTML = buildPage();
    bindEvents();
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

    container.querySelectorAll('.chart-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (chartRange === btn.dataset.range) return;
        destroyCharts();
        chartRange = btn.dataset.range;
        mount();
      });
    });

    container.querySelectorAll('.mental-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.series;
        if (visibleSeries.has(key)) {
          if (visibleSeries.size === 1) return;
          visibleSeries.delete(key);
        } else {
          visibleSeries.add(key);
        }
        destroyCharts();
        mount();
      });
    });

    container.querySelectorAll('.day-log-item').forEach(row => {
      row.addEventListener('click', () => {
        const wrap = row.closest('.day-item-wrap');
        const detail = wrap?.querySelector('.day-detail');
        const chevron = row.querySelector('.day-chevron');
        if (!detail) return;
        const isOpen = detail.style.display === 'block';
        detail.style.display = isOpen ? 'none' : 'block';
        if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    });

    container.querySelectorAll('.edit-day-reflect').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(`/reflect?date=${btn.dataset.date}&from=insights`);
      });
    });

    container.querySelector('#load-more-days')?.addEventListener('click', () => {
      daysLimit += 30;
      mount();
    });
  }

  function drawCharts() {
    if (typeof Chart === 'undefined') return;

    const chartDays = getChartDays(chartRange);

    if (activeTab === 'trends') {
      const mentalCanvas = container.querySelector('#chart-mental-load');
      if (mentalCanvas) {
        const mental = buildMentalSeries(chartDays, chartRange);
        const xTicks = { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: mental.labels.length > 20 ? 6 : 8 };
        const makeLine = (label, data, color) => ({
          label,
          data,
          borderColor: color,
          backgroundColor: 'transparent',
          tension: chartRange === '30' ? 0.4 : 0.35,
          pointBackgroundColor: color,
          pointRadius: mental.ptRadius,
          pointHitRadius: 10,
          pointHoverRadius: 5.5,
          borderWidth: 2,
          spanGaps: true,
          clip: false,
        });

        chartInstances['mental'] = new Chart(mentalCanvas, {
          type: 'line',
          data: {
            labels: mental.labels,
            datasets: MENTAL_SERIES
              .filter(s => visibleSeries.has(s.key))
              .map(s => makeLine(s.label, mental.getSeries(s.key), s.color)),
          },
          options: {
            ...CHART_DEFAULTS,
            scales: {
              x: { ...CHART_DEFAULTS.scales.x, ticks: xTicks },
              y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 10 },
            },
          },
        });
      }

      const worriesCanvas = container.querySelector('#chart-worries-14d');
      if (worriesCanvas) {
        const worry = buildWorrySeries(chartDays, chartRange);
        const xTicks = { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: worry.labels.length > 20 ? 6 : 8 };
        chartInstances['worries14'] = new Chart(worriesCanvas, {
          type: 'bar',
          data: {
            labels: worry.labels,
            datasets: [{
              label: 'Worries',
              data: worry.counts,
              backgroundColor: 'rgba(255, 169, 77, 0.7)',
              borderRadius: worry.borderRadius,
            }],
          },
          options: {
            ...CHART_DEFAULTS,
            scales: {
              x: { ...CHART_DEFAULTS.scales.x, ticks: xTicks },
              y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true, ticks: { ...CHART_DEFAULTS.scales.y.ticks, precision: 0 } },
            },
          },
        });
      }
    }
  }

  mount();
}

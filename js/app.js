import { openDB } from './db.js';
import { renderToday } from './views/today.js';
import { renderReflect } from './views/reflect.js';
import { renderInsights } from './views/insights.js';
import { renderSettings } from './views/settings.js';

const main = document.getElementById('main-content');
const navItems = document.querySelectorAll('.nav-item');

// ===== NAVIGATION =====
export function navigate(path) {
  window.location.hash = path;
}

// ===== TOAST =====
let toastTimer;
export function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  clearTimeout(toastTimer);
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== ROUTER =====
const ROUTES = {
  '/': { render: renderToday, navId: 'nav-today' },
  '/reflect': { render: renderReflect, navId: 'nav-today' },
  '/insights': { render: renderInsights, navId: 'nav-insights' },
  '/settings': { render: renderSettings, navId: 'nav-settings' },
};

async function route() {
  const hash = window.location.hash.replace('#', '') || '/';
  const [path, queryStr] = hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryStr || ''));

  const matched = ROUTES[path] || ROUTES['/'];

  navItems.forEach(item => {
    item.classList.toggle('active', item.id === matched.navId);
  });

  try {
    await matched.render(main, params);
  } catch (err) {
    console.error('Route render error:', err);
    main.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:var(--text-2)">
        <p style="margin-bottom:8px">Something went wrong loading this view.</p>
        <button class="btn btn-secondary btn-sm" onclick="window.location.hash='/'">Go home</button>
      </div>
    `;
  }

  main.scrollTo({ top: 0, behavior: 'instant' });
  window.scrollTo(0, 0);
}

// ===== SERVICE WORKER =====
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

// ===== INIT =====
async function init() {
  await openDB();
  registerSW();
  window.addEventListener('hashchange', route);
  await route();
}

init();

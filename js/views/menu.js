export async function renderMenu(container) {
  container.innerHTML = `
    <div class="view-enter" style="padding: 20px;">
      <div class="page-header">
        <div class="page-header-title">Menu</div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 20px;">
        <a href="#/worries" class="card" style="text-decoration: none; display: flex; align-items: center; padding: 20px; gap: 16px;">
          <div style="background: var(--surface-2); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <div style="font-size: 1.1rem; font-weight: 500; color: var(--text-1); margin-bottom: 4px;">Worry Tracker</div>
            <div style="font-size: 0.85rem; color: var(--text-2);">Log and review intrusive thoughts</div>
          </div>
        </a>

        <a href="#/settings" class="card" style="text-decoration: none; display: flex; align-items: center; padding: 20px; gap: 16px;">
          <div style="background: var(--surface-2); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div>
            <div style="font-size: 1.1rem; font-weight: 500; color: var(--text-1); margin-bottom: 4px;">App Settings</div>
            <div style="font-size: 0.85rem; color: var(--text-2);">Data, backup, and preferences</div>
          </div>
        </a>
      </div>
    </div>
  `;
}

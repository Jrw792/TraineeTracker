/* Wrestling Training site — single-page app, hash routing,
   light/dark theme, futuristic-tech aesthetic */
(() => {
  const APP = document.getElementById('app');
  const NAV_LINKS = document.querySelectorAll('nav a');
  const LAST_UPDATED = document.getElementById('last-updated');
  const THEME_BTN = document.getElementById('theme-toggle');

  let rosterCache = null;
  let indexCache = null;

  /* ---------- Theme handling ---------- */
  const THEME_KEY = 'tp-theme';

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effectiveTheme() {
    return document.documentElement.getAttribute('data-effective-theme')
      || (systemPrefersDark() ? 'dark' : 'light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-effective-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeMeta(theme);
  }

  function updateThemeMeta(theme) {
    // Keep iOS chrome in sync with the active theme
    const tag = document.querySelector('meta[name="theme-color"]:not([media])');
    if (tag) tag.setAttribute('content', theme === 'dark' ? '#07070a' : '#fafafb');
  }

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // Sync if the OS theme changes and the user hasn't picked a side yet.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener && mq.addEventListener('change', () => {
      if (!localStorage.getItem(THEME_KEY)) {
        const eff = systemPrefersDark() ? 'dark' : 'light';
        document.documentElement.setAttribute('data-effective-theme', eff);
      }
    });
  }

  /* ---------- Data loaders ---------- */
  async function loadRoster() {
    if (rosterCache) return rosterCache;
    const res = await fetch('roster.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load roster.json');
    rosterCache = await res.json();
    return rosterCache;
  }

  async function loadNotesIndex() {
    if (indexCache) return indexCache;
    const res = await fetch('notes-index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load notes-index.json');
    indexCache = await res.json();
    return indexCache;
  }

  async function loadNote(key) {
    const res = await fetch(`notes/${encodeURIComponent(key)}.md`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Note not found');
    return res.text();
  }

  /* ---------- Helpers ---------- */
  function fmtDate(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    const [, y, mo, d] = m;
    const dt = new Date(+y, +mo - 1, +d);
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function fmtDateShort(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    const [, y, mo, d] = m;
    return `${y}.${mo}.${d}`;
  }

  function fmtSessionLabel(key) {
    const m = key.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d+))?$/);
    if (!m) return key;
    const [, y, mo, d, n] = m;
    const dt = new Date(+y, +mo - 1, +d);
    const base = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return n ? `${base} — Session ${n}` : base;
  }

  function fmtSessionStamp(key) {
    const m = key.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d+))?$/);
    if (!m) return key;
    const [, y, mo, d, n] = m;
    const stamp = `${y}.${mo}.${d}`;
    return n ? `${stamp}/${n}` : stamp;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function setActiveNav(name) {
    NAV_LINKS.forEach(a => {
      a.classList.toggle('active', a.dataset.route === name);
    });
  }

  function setLoading() {
    APP.innerHTML = '<div class="loading">Loading…</div>';
  }

  /* ---------- Views ---------- */
  async function renderHome() {
    setLoading();
    let roster;
    try {
      roster = await loadRoster();
    } catch (e) {
      APP.innerHTML = `<div class="empty-state">Couldn't load roster.json. ${escapeHtml(e.message)}</div>`;
      return;
    }
    const active = roster.trainees
      .filter(t => t.active)
      .sort((a, b) => a.name.localeCompare(b.name));

    APP.innerHTML = `
      <span class="page-eyebrow">Active Roster</span>
      <h1 class="page-title">Trainees</h1>
      <p class="page-subtitle">${active.length} active member${active.length === 1 ? '' : 's'}. Tap a card to read the most recent progress summary.</p>
      <div class="roster-grid">
        ${active.map(t => {
          const summary = t.current_summary || 'No summary written yet.';
          const preview = summary.length > 200 ? summary.slice(0, 200).trimEnd() + '…' : summary;
          const sessions = t.session_count_estimate
            ? `~${t.session_count_estimate} sessions · since ${fmtDateShort(t.start_date)}`
            : `Joined ${fmtDateShort(t.start_date)}`;
          return `
            <a class="trainee-card" href="#/trainee/${encodeURIComponent(t.id)}">
              <div class="trainee-card-header">
                <h3>${escapeHtml(t.name)}</h3>
                <span class="id-tag">${escapeHtml(t.id)}</span>
              </div>
              <div class="meta">${escapeHtml(sessions)}</div>
              <div class="preview">${escapeHtml(preview)}</div>
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  async function renderTrainee(id) {
    setLoading();
    let roster;
    try {
      roster = await loadRoster();
    } catch (e) {
      APP.innerHTML = `<a class="back-link" href="#/">← Roster</a><div class="empty-state">Couldn't load roster.</div>`;
      return;
    }
    const t = roster.trainees.find(x => x.id === id);
    if (!t) {
      APP.innerHTML = `<a class="back-link" href="#/">← Roster</a><div class="empty-state">Trainee not found.</div>`;
      return;
    }
    const summary = t.current_summary || 'No summary written yet.';

    APP.innerHTML = `
      <a class="back-link" href="#/">← Roster</a>
      <div class="trainee-detail">
        <div class="detail-header">
          <h1>${escapeHtml(t.name)}</h1>
          ${t.active
            ? '<span class="badge active">Active</span>'
            : '<span class="badge muted">Inactive</span>'}
        </div>
        <dl class="detail-meta">
          <div>
            <dt>Started</dt>
            <dd>${fmtDateShort(t.start_date)}</dd>
          </div>
          ${t.session_count_estimate ? `
            <div>
              <dt>Sessions</dt>
              <dd>~${t.session_count_estimate}</dd>
            </div>
            <div>
              <dt>As of</dt>
              <dd>${fmtDateShort(t.session_count_as_of)}</dd>
            </div>` : ''}
          <div>
            <dt>ID</dt>
            <dd>${escapeHtml(t.id)}</dd>
          </div>
        </dl>
        <div class="summary-card">
          <span class="summary-label">Progress summary</span>
          ${escapeHtml(summary).replace(/\n+/g, '<br><br>')}
        </div>
        ${t.notes ? `
          <div class="notes-block">
            <span class="notes-label">Notes</span>
            ${escapeHtml(t.notes)}
          </div>` : ''}
      </div>
    `;
  }

  async function renderSessions() {
    setLoading();
    let idx;
    try {
      idx = await loadNotesIndex();
    } catch (e) {
      APP.innerHTML = `<div class="empty-state">Couldn't load session index.</div>`;
      return;
    }
    const sessions = [...(idx.sessions || [])].sort((a, b) => b.date.localeCompare(a.date));

    APP.innerHTML = `
      <span class="page-eyebrow">Session Archive</span>
      <h1 class="page-title">Sessions</h1>
      <p class="page-subtitle">${sessions.length} archived session${sessions.length === 1 ? '' : 's'}, most recent first.</p>
      <ul class="session-list">
        ${sessions.map(s => `
          <li>
            <a href="#/session/${encodeURIComponent(s.date)}">
              <span class="date-stamp">${escapeHtml(fmtSessionStamp(s.date))}</span>
              <div>
                <div class="date-label">${escapeHtml(fmtSessionLabel(s.date))}</div>
                ${s.attendees && s.attendees.length
                  ? `<div class="attendees">${escapeHtml(s.attendees.join(', '))}</div>`
                  : ''}
              </div>
            </a>
          </li>
        `).join('')}
      </ul>
    `;
  }

  async function renderSession(key) {
    setLoading();
    try {
      const md = await loadNote(key);
      const html = window.marked ? marked.parse(md) : `<pre>${escapeHtml(md)}</pre>`;
      APP.innerHTML = `
        <a class="back-link" href="#/sessions">← Sessions</a>
        <article class="note">${html}</article>
      `;
    } catch (e) {
      APP.innerHTML = `
        <a class="back-link" href="#/sessions">← Sessions</a>
        <div class="empty-state">Session not found.</div>
      `;
    }
  }

  /* ---------- Router ---------- */
  function route() {
    const hash = window.location.hash || '#/';
    const path = hash.replace(/^#/, '');
    window.scrollTo(0, 0);

    if (path === '/' || path === '') {
      setActiveNav('home');
      return renderHome();
    }
    if (path === '/sessions') {
      setActiveNav('sessions');
      return renderSessions();
    }
    if (path.startsWith('/trainee/')) {
      setActiveNav('home');
      const id = decodeURIComponent(path.slice('/trainee/'.length));
      return renderTrainee(id);
    }
    if (path.startsWith('/session/')) {
      setActiveNav('sessions');
      const key = decodeURIComponent(path.slice('/session/'.length));
      return renderSession(key);
    }
    setActiveNav('home');
    renderHome();
  }

  /* ---------- Wire up ---------- */
  THEME_BTN && THEME_BTN.addEventListener('click', toggleTheme);
  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    updateThemeMeta(effectiveTheme());
    route();
    loadNotesIndex().then(idx => {
      if (idx && idx.last_updated) {
        LAST_UPDATED.textContent = `LAST UPDATED · ${fmtDateShort(idx.last_updated)}`;
      }
    }).catch(() => { /* swallow */ });
  });
})();

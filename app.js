/* Wrestling Training site — single-page app, hash routing */
(() => {
  const APP = document.getElementById('app');
  const NAV_LINKS = document.querySelectorAll('nav a');
  const LAST_UPDATED = document.getElementById('last-updated');

  let rosterCache = null;
  let indexCache = null;

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

  function fmtSessionLabel(key) {
    const m = key.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d+))?$/);
    if (!m) return key;
    const [, y, mo, d, n] = m;
    const dt = new Date(+y, +mo - 1, +d);
    const base = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return n ? `${base} — Session ${n}` : base;
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
      <h1>Roster</h1>
      <p class="subtitle">${active.length} active trainee${active.length === 1 ? '' : 's'}. Tap a card for the most recent progress summary.</p>
      <div class="roster-grid">
        ${active.map(t => {
          const summary = t.current_summary || 'No summary written yet.';
          const preview = summary.length > 200 ? summary.slice(0, 200).trimEnd() + '…' : summary;
          const sessionsLine = t.session_count_estimate
            ? `Started ${fmtDate(t.start_date)} · ~${t.session_count_estimate} sessions`
            : `Started ${fmtDate(t.start_date)}`;
          return `
            <a class="trainee-card" href="#/trainee/${encodeURIComponent(t.id)}">
              <h3>${escapeHtml(t.name)}</h3>
              <div class="meta">${escapeHtml(sessionsLine)}</div>
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
    const sessionsLine = t.session_count_estimate
      ? `Started ${fmtDate(t.start_date)} · ~${t.session_count_estimate} sessions (as of ${fmtDate(t.session_count_as_of)})`
      : `Started ${fmtDate(t.start_date)}`;

    APP.innerHTML = `
      <a class="back-link" href="#/">← Roster</a>
      <div class="trainee-detail">
        <div class="header-row">
          <h1>${escapeHtml(t.name)}</h1>
          ${t.active ? '' : '<span class="badge muted">Inactive</span>'}
        </div>
        <p class="subtitle">${escapeHtml(sessionsLine)}</p>
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
      <h1>Sessions</h1>
      <p class="subtitle">${sessions.length} archived session${sessions.length === 1 ? '' : 's'}, most recent first.</p>
      <ul class="session-list">
        ${sessions.map(s => `
          <li>
            <a href="#/session/${encodeURIComponent(s.date)}">
              <div class="date">${escapeHtml(fmtSessionLabel(s.date))}</div>
              ${s.attendees && s.attendees.length
                ? `<div class="attendees">${escapeHtml(s.attendees.join(', '))}</div>`
                : ''}
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

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    route();
    loadNotesIndex().then(idx => {
      if (idx && idx.last_updated) {
        LAST_UPDATED.textContent = `Last updated ${fmtDate(idx.last_updated)}`;
      }
    }).catch(() => { /* swallow */ });
  });
})();

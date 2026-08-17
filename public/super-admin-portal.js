(function () {
  'use strict';

  const views = ['overview', 'schools', 'users', 'curriculum', 'calls', 'security', 'settings'];
  const view = views.includes(new URLSearchParams(location.search).get('view'))
    ? new URLSearchParams(location.search).get('view')
    : 'overview';
  const navigation = [
    ['overview', 'Overview'],
    ['schools', 'Schools'],
    ['users', 'Users & roles'],
    ['curriculum', 'Curriculum'],
    ['calls', 'Voice & calls'],
    ['security', 'Security'],
    ['settings', 'Platform settings']
  ];
  const titles = {
    overview: ['Platform overview', 'A staging-only view of Penny AI platform activity.'],
    schools: ['Schools', 'School management will be connected here.'],
    users: ['Users & roles', 'Platform-level role controls will be connected here.'],
    curriculum: ['Curriculum', 'Global lesson management will be connected here.'],
    calls: ['Voice & calls', 'Platform call operations will be connected here.'],
    security: ['Security', 'Audit and security controls will be connected here.'],
    settings: ['Platform settings', 'Environment and feature controls will be connected here.']
  };
  let data = { adminName: 'Super Admin', counts: {} };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = name => String(name || 'SA').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const count = key => Number(data.counts[key] || 0).toLocaleString('en-US');
  const navLink = ([key, label]) => `<a class="${view === key ? 'active' : ''}" href="?view=${key}">${esc(label)}</a>`;
  const comingSoon = (title, message) => `<section class="super-panel super-empty"><span class="live-tag">COMING SOON</span><h2>${esc(title)}</h2><p>${esc(message)}</p><p class="super-muted">This workspace intentionally does not display sample data. It will show real staging information once this area is connected.</p></section>`;

  function overview() {
    return `<section class="super-hero"><div><small>STAGING COMMAND CENTRE</small><h2>Welcome, ${esc(data.adminName.split(/\s+/)[0])}</h2><p>These numbers are loaded from the Penny AI staging environment.</p></div><div class="super-actions"><a class="super-button" href="?view=users">Review users</a></div></section>
      <section class="super-stats">
        <article class="super-stat"><span>Schools</span><b>${count('schools')}</b><small>Staging records</small></article>
        <article class="super-stat"><span>All users</span><b>${count('users')}</b><small>All roles</small></article>
        <article class="super-stat"><span>Teachers</span><b>${count('teachers')}</b><small>Teacher accounts</small></article>
        <article class="super-stat"><span>Learners</span><b>${count('students')}</b><small>Learner accounts</small></article>
        <article class="super-stat"><span>Lesson attempts</span><b>${count('lessonAttempts')}</b><small>Recorded attempts</small></article>
      </section>
      <section class="super-grid">
        <article class="super-panel"><span class="live-tag">LIVE STAGING DATA</span><h3>Platform foundation</h3><p>The current staging environment contains ${count('lessons')} lessons and ${count('callLogs')} recorded call logs. Counts are read-only in this first release.</p><div class="control-list"><div class="control-item"><b>Schools</b><small>${count('schools')} staging school record${data.counts.schools === 1 ? '' : 's'}</small></div><div class="control-item"><b>Identity</b><small>${count('teachers')} teachers and ${count('students')} learners</small></div><div class="control-item"><b>Learning activity</b><small>${count('lessonAttempts')} lesson attempt${data.counts.lessonAttempts === 1 ? '' : 's'} recorded</small></div></div></article>
        <aside class="super-panel"><h3>Next connections</h3><p>Build these after the dashboard review.</p><div class="control-list"><div class="control-item"><b>School management</b><small>Coming soon</small></div><div class="control-item"><b>Role management</b><small>Coming soon</small></div><div class="control-item"><b>Audit history</b><small>Coming soon</small></div></div></aside>
      </section>
      <div class="super-notice"><span>Staging only. No production data, settings, or credentials are shown here.</span><b>Read-only foundation</b></div>`;
  }

  function content() {
    if (view === 'overview') return overview();
    const [title, description] = titles[view];
    return comingSoon(title, description);
  }

  function render() {
    const [title, description] = titles[view];
    document.getElementById('superAdminPortal').innerHTML = `<aside class="super-sidebar"><div class="super-brand">PENNY AI<small>SUPER ADMIN · STAGING</small></div><nav class="super-nav">${navigation.map(navLink).join('')}</nav><div class="super-security">Restricted staging workspace<br>System administrators only</div><button class="preview-return" id="signOutButton">Sign out</button></aside><main class="super-main"><header class="super-top"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="super-user"><span class="super-avatar">${esc(initials(data.adminName))}</span></div></header><div class="super-content">${content()}</div></main><nav class="super-mobile">${navigation.slice(0, 5).map(navLink).join('')}</nav>`;
  }

  async function initialize() {
    try {
      const config = await fetch('/api/config').then(response => response.json());
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data: { session } } = await client.auth.getSession();
      if (!session) { window.location.href = '/signin.html'; return; }
      const response = await fetch('/api/super-admin/overview', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (response.status === 401 || response.status === 403) { window.location.href = '/signin.html'; return; }
      if (!response.ok) throw new Error('Unable to load the platform overview');
      data = await response.json();
      render();
      document.getElementById('signOutButton').addEventListener('click', async () => {
        await client.auth.signOut();
        window.location.href = '/signin.html';
      });
    } catch (error) {
      console.error(error);
      document.getElementById('superAdminPortal').innerHTML = '<main class="super-main"><div class="super-content"><section class="super-panel super-empty"><h2>Unable to load the Super Admin workspace</h2><p>Please sign in again and confirm this account has the System Admin role in staging.</p></section></div></main>';
    }
  }

  initialize();
})();

(function () {
  'use strict';
  const roles = {
    student: {
      greeting: 'Good morning, Sofia 👋', subtitle: 'Ready for another step towards confident English?', initials: 'SM', name: 'Sofia Moretti', role: 'B1 Intermediate',
      nav: ['Home','My Lessons','Self-Study','Practice with Penny','Progress'], tag: 'B1 • INTERMEDIATE', hero: 'Continue your journey', heroMeta: 'Unit 6 · Speaking with confidence', action: 'Continue lesson', ring: '68%', ringLabel: 'B1 progress',
      stats: [['My Lessons','12','2 new'],['Self-Study','24','6 this week'],['Practice sessions','8','Confidence building'],['Lesson credits','8','Self-Study unlimited']],
      kind: 'student'
    },
    teacher: {
      greeting: 'Good morning, Marco 👋', subtitle: "Here’s what needs your attention today", initials: 'MR', name: 'Marco Rossi', role: 'English Teacher',
      nav: ['Overview','My Students','Lessons','Student Progress','Feedback','Messages','Calendar'], tag: 'TEACHER OVERVIEW', hero: 'Your teaching day', heroMeta: '4 lessons · 38 students · 6 feedback items', action: 'View schedule', ring: '4', ringLabel: 'lessons today',
      stats: [['Assigned students','38','5 need attention'],['Lessons today','4','Next at 10:30'],['Feedback due','6','2 high priority'],['New messages','3','Reply when ready']],
      kind: 'teacher'
    },
    school: {
      greeting: 'Good morning, Sofia', subtitle: "Here’s your school overview for today", initials: 'SC', name: 'Sofia Conti', role: 'School Administrator',
      nav: ['Overview','Learn','Sales & Growth','Users','Reports','Messages','Settings','Help'], tag: 'SCHOOL OVERVIEW', hero: 'Everything in one view', heroMeta: '284 students · 18 teachers · 34 active leads', action: 'View reports', ring: '92', ringLabel: 'school health',
      stats: [['Active students','284','+12 this month'],['Teachers','18','3 available today'],['Lessons this week','126','91% attendance'],['Qualified leads','34','8 ready to call']],
      kind: 'school'
    },
    super: {
      greeting: 'Good morning, Alex', subtitle: "Here’s the Penny AI platform overview for today", initials: 'AR', name: 'Alex Romano', role: 'Platform Superadmin',
      nav: ['Overview','Schools','Users & Permissions','Learn Management','Sales & Growth','Publishing','Reports','System & Audit','Settings'], tag: 'PLATFORM OVERVIEW', hero: 'Penny AI at a glance', heroMeta: '24 schools · 8,420 learners · 312 teachers', action: 'Open control center', ring: '98', ringLabel: 'platform health',
      stats: [['Schools','24','+3 this quarter'],['Active learners','8,420','+318 this month'],['Teachers','312','94% active'],['Approvals','17','6 urgent']],
      kind: 'super'
    }
  };
  const requested = new URLSearchParams(location.search).get('role');
  const model = roles[requested] || roles.student;
  const nav = model.nav.map((item,i) => `<span class="nav-link ${i === 0 ? 'active' : ''}">${item}</span>`).join('');
  const stats = model.stats.map(s => `<article class="summary-card"><span class="label">${s[0]}</span><strong>${s[1]}</strong><small>${s[2]}</small></article>`).join('');
  const studentBody = `
    <div class="section-title"><h2>Choose your next activity</h2><a href="#">View all activities →</a></div>
    <section class="activity-grid">
      <article class="activity-card"><h3>My Lessons</h3><p>Pick up where you left off or review your completed lessons.</p><a href="#">Open lessons →</a></article>
      <article class="activity-card"><h3>Self-Study</h3><p>Unlimited static practice with no lesson credits or AI cost.</p><a href="#">Start practicing →</a></article>
      <article class="activity-card"><h3>Practice with Penny</h3><p>Build confidence through a friendly AI conversation.</p><a href="#">Talk to Penny →</a></article>
    </section>
    <section class="details-grid">
      <article class="panel"><h3>Upcoming lesson</h3><div class="lesson-row"><div class="date-tile"><div><small>AUG</small>12</div></div><div><strong>Making travel arrangements</strong><span>Wednesday · 16:30–17:15 · Conversation lesson</span></div></div><div class="lesson-row"><div class="avatar" style="width:34px;height:34px">EC</div><div><strong>Elena Conti · Your teacher</strong></div></div></article>
      <article class="panel"><h3>Your weekly goal</h3><div style="font-size:28px;color:#5b5ce2;font-weight:700">4 / 5 <small style="font-size:10px;color:#636b82;font-weight:400">activities complete</small></div><div class="bar"><span style="width:80%"></span></div><p style="color:#636b82;font-size:11px;margin-top:22px">M &nbsp; T &nbsp; W &nbsp; T &nbsp; F &nbsp; S &nbsp; S</p></article>
    </section>`;
  const teacherBody = `
    <section class="details-grid">
      <article class="panel"><h3>Today’s lessons</h3>${[['B1 Conversation: Travel plans','10:30–11:15 · Sofia Moretti'],['A2 English: Daily routines','13:00–13:45 · Luca Bianchi'],['B2 Conversation: Work & culture','16:30–17:15 · Amélie Dubois']].map((x,i)=>`<div class="lesson-row"><div class="date-tile"><div><small>AUG</small>11</div></div><div><strong>${x[0]}</strong><span>${x[1]}</span></div></div>`).join('')}</article>
      <article class="panel"><h3>Students to watch</h3>${[['Sofia Moretti',82],['Luca Bianchi',61],['Amélie Dubois',74]].map(x=>`<div class="watch-row"><div><span>${x[0]}</span><span>${x[1]}%</span></div><div class="bar"><span style="width:${x[1]}%"></span></div></div>`).join('')}</article>
    </section>`;
  function operationsBody(superAdmin) {
    return `<section class="split-panels"><article class="operations"><h3>${superAdmin ? 'Learning Operations' : 'Learn'}</h3><p>${superAdmin ? 'Schools, users, content and publishing' : 'Students, teachers and learning activity'}</p><div class="metrics"><div><strong>${superAdmin?'8,420':'284'}</strong><small>${superAdmin?'Learners':'Students'}</small></div><div><strong>${superAdmin?'312':'18'}</strong><small>Teachers</small></div><div><strong>${superAdmin?'4,860':'126'}</strong><small>Lessons today</small></div></div><div class="mini-actions"><button>+ Add ${superAdmin?'school':'student'}</button><button>+ Add ${superAdmin?'user':'teacher'}</button></div></article><article class="growth"><h3>${superAdmin?'Growth Oversight':'Sales & Growth'}</h3><p>Emma and sales activity ${superAdmin?'across schools':'and the enrollment pipeline'}</p><div class="metrics"><div><strong>${superAdmin?'19':'34'}</strong><small>${superAdmin?'Emma schools':'Active leads'}</small></div><div><strong>${superAdmin?'486':'12'}</strong><small>Qualified leads</small></div><div><strong>${superAdmin?'73':'8'}</strong><small>Follow-ups</small></div></div><div class="mini-actions"><button>Open Emma</button><button>${superAdmin?'Platform reports':'Import prospects'}</button></div></article></section>`;
  }
  const lower = model.kind === 'student' ? studentBody : model.kind === 'teacher' ? teacherBody : operationsBody(model.kind === 'super');
  document.getElementById('dashboard').innerHTML = `
    <aside class="sidebar"><div class="brand"><span class="brand-mark">P</span><strong>PENNY AI</strong></div><nav class="side-nav">${nav}</nav><a class="preview-return" href="/figma-hub.html">← Preview hub</a></aside>
    <main class="workspace"><header class="topbar"><div class="welcome"><h1>${model.greeting}</h1><p>${model.subtitle}</p></div><div class="header-actions"><div class="search">Search the Penny AI platform</div><div class="bell">●</div><div class="profile"><div class="avatar">${model.initials}</div><div><strong>${model.name}</strong><small>${model.role}</small></div></div></div></header>
      <div class="content"><section class="hero"><div class="hero-copy"><span class="eyebrow">${model.tag}</span><h2>${model.hero}</h2><p>${model.heroMeta}</p><button class="dark-button">${model.action} →</button></div><div class="health-ring" style="--ring:${model.kind==='student'?'68%':model.kind==='teacher'?'78%':model.kind==='school'?'92%':'98%'}"><div class="ring-copy"><strong>${model.ring}</strong><small>${model.ringLabel}</small></div></div></section><section class="summary-grid">${stats}</section>${lower}<section class="attention"><div><strong>${model.kind==='student'?'Excellent progress—your pronunciation is becoming much clearer.':model.kind==='teacher'?'6 students are waiting for lesson feedback':model.kind==='school'?'3 students need a teacher · 8 follow-ups are overdue':'2 schools await approval · 4 integrations need review'}</strong><small>Demonstration content for visual approval</small></div><div class="queue"><b>${model.kind==='student'?'8':model.kind==='teacher'?'3':model.kind==='school'?'11':'23'}</b><span>items</span></div></section></div>
    </main><nav class="mobile-nav">${model.nav.slice(0,4).map((n,i)=>`<span class="${i===0?'active':''}">${n}</span>`).join('')}<span>More</span></nav>`;
})();

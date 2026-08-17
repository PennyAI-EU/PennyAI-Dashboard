(function () {
  'use strict';
  const pages = ['home','lessons','details','live','result','review','failed','incomplete','out-of-minutes','self-study','practice','progress'];
  const requested = new URLSearchParams(location.search).get('view') || 'home';
  const view = pages.includes(requested) ? requested : 'home';
  const navItems = [
    ['home','Home'],['lessons','My Lessons'],['self-study','Self-Study'],['practice','Practice with Penny'],['progress','Progress']
  ];
  const titleMap = {
    home: ['Good morning, Sofia','Your current lesson plan and results, all in one place.'],
    lessons: ['My Lessons','Plan, join and review your English lessons.'],
    details: ['Lesson details','Everything you need before your call with Penny.'],
    live: ['Live lesson with Penny','B2 Lesson 1 · 09:42 remaining'],
    result: ['Lesson complete','Your lesson result is ready.'],
    review: ['Lesson review','Listen back and revisit Penny’s feedback.'],
    failed: ['Lesson result','Your next step is ready.'],
    incomplete: ['Lesson incomplete','You can continue when you are ready.'],
    'out-of-minutes': ['Lesson minutes used','Renewal or an updated plan will unlock your next lesson.'],
    'self-study': ['Self-Study','This feature is coming soon.'],
    practice: ['Practice with Penny','This feature is coming soon.'],
    progress: ['Progress & profile','Your learning history, messages and preferences.']
  };
  const pct = value => `<div class="proto-bar"><span style="width:${value}%"></span></div>`;
  let liveData = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const firstName = () => (liveData?.profile?.name || 'Sofia').trim().split(/\s+/)[0] || 'Learner';
  const nextLesson = () => liveData?.nextLesson || null;
  const lessonSummary = lesson => lesson
    ? 'Practice speaking, reasoning, and useful English in your next lesson with Penny.'
    : 'Your next lesson details will appear here.';
  const attempts = () => liveData?.attempts || [];
  const score = attempt => {
    const value = Number(attempt?.final_score ?? attempt?.overall_score ?? attempt?.score);
    return Number.isFinite(value) ? value.toFixed(1) : '—';
  };
  const statusAttempts = status => attempts().filter(attempt => attempt.attempt_status === status);
  const lessonTitle = attempt => attempt?.lessons?.title || 'English lesson';
  const completedAttempts = () => attempts().filter(attempt => ['passed', 'failed'].includes(attempt.attempt_status));
  const skillAverages = () => [
    ['Vocabulary', 'vocabulary_score'],
    ['Grammar', 'grammar_score'],
    ['Fluency', 'fluency_score']
  ].map(([label, field]) => {
    const values = completedAttempts()
      .map(attempt => attempt[field])
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(Number)
      .filter(Number.isFinite);
    return values.length ? [label, Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))] : null;
  }).filter(Boolean);
  const card = (attempt, label, page) => `<article class="proto-card white"><h3>${esc(lessonTitle(attempt))}</h3><p>${esc(label)} · Final score: ${score(attempt)}%</p><span class="proto-pill">${attempt.attempt_status === 'passed' ? 'Passed' : attempt.attempt_status === 'failed' ? 'Retry recommended' : 'Continue when ready'}</span><a class="proto-btn dark" href="?view=${page}">${page === 'review' ? 'Review' : 'View details'} →</a></article>`;
  const top = titleMap[view];
  function link(page,label) { return `<a class="proto-nav ${view === page || (page === 'lessons' && ['details','live'].includes(view)) ? 'active' : ''}" href="?view=${page}">${label}</a>`; }
  function home() { const lesson = nextLesson(); const latest = statusAttempts('passed')[0]; const completion = liveData?.subscription?.completionPercentage ?? 30; return `
    <section class="proto-hero mint-hero home-focus"><div><span class="proto-pill">${esc(liveData?.profile?.englishLevel || 'B1')} · INTERMEDIATE</span><h2>Welcome back, ${esc(firstName())}</h2><p>${lesson ? 'Your next lesson is ready to begin.' : 'Your next lesson will appear here when it is scheduled.'}</p><a class="proto-btn dark" href="?view=details">View lesson details →</a></div><div class="hero-number"><b>${completion}%</b><small>completion percentage</small></div></section>
    <h2 class="proto-heading">Your learning spaces</h2><section class="proto-cards three"><a class="proto-card lavender lesson-primary" href="?view=lessons"><span class="proto-label">ACTIVE</span><h3>My Lessons</h3><p>Plan, join and review your personalized lessons.</p><span class="tile-action">Open lessons →</span></a><article class="proto-card mint muted-tile"><span class="proto-label">COMING SOON</span><h3>Self-Study</h3><p>Personalized independent practice.</p></article><article class="proto-card coral muted-tile"><span class="proto-label">COMING SOON</span><h3>Practice with Penny</h3><p>On-demand practice between lessons.</p></article></section>
    <section class="proto-grid two"><article class="proto-panel"><span class="proto-label">UPCOMING LESSON</span><h3>${esc(lesson?.title || 'No lesson scheduled yet')}</h3><p>${lesson ? `${esc(lesson.level)} Lesson ${lesson.lesson_number} · ${esc(lesson.type || 'Voice lesson')}` : 'Your teacher or Penny will schedule the next lesson.'}</p><a class="proto-btn" href="?view=details">View lesson →</a></article><article class="proto-panel"><span class="proto-label">LATEST RESULT</span><h3>${esc(latest ? lessonTitle(latest) : 'No completed lessons yet')}</h3><b class="purple-number">${latest ? `${score(latest)}% · Passed` : '—'}</b><p>${latest ? 'Vocabulary, grammar and fluency met the required standard.' : 'Your result will appear here after your first completed lesson.'}</p><a class="subtle" href="?view=result">View result →</a></article></section>`; }
  function lessons() { const lesson = nextLesson(); const passed = statusAttempts('passed'); const failed = statusAttempts('failed'); const incompleteAttempts = statusAttempts('incomplete'); return `
    <div class="proto-tabs"><span class="active">Upcoming</span><span>Completed</span></div>
    <article class="proto-panel lesson-feature"><span class="proto-pill mint">UPCOMING</span><h2>${esc(lesson?.title || 'No lesson scheduled')}</h2><p>${esc(lessonSummary(lesson))}</p><b>${lesson ? `${esc(lesson.level)} Lesson ${lesson.lesson_number} · Penny voice lesson` : 'Check back soon.'}</b><a class="proto-btn" href="?view=details">View details →</a></article>
    <h2 class="proto-heading">Completed lessons</h2><section class="proto-cards two">${passed.length ? passed.map(a => card(a, 'Completed', 'review')).join('') : '<article class="proto-card white"><h3>No completed lessons yet</h3><p>Your completed lessons will be shown here.</p></article>'}</section>
    <h2 class="proto-heading">Lessons not passed yet</h2><section class="proto-cards two">${failed.length ? failed.map(a => card(a, 'Not passed yet', 'failed')).join('') : '<article class="proto-card white"><h3>No lessons need a retry</h3><p>Great work—there are no lessons awaiting another attempt.</p></article>'}</section>
    <h2 class="proto-heading">Incomplete lessons</h2><section class="proto-cards two">${incompleteAttempts.length ? incompleteAttempts.map(a => card(a, 'Incomplete', 'incomplete')).join('') : '<article class="proto-card white"><h3>No incomplete lessons</h3><p>Your incomplete lessons will be shown here if a lesson ends early.</p></article>'}</section>`; }
  function details() { const lesson = nextLesson() || {}; const objectives = lesson.objectives?.length ? lesson.objectives : ['Lesson objectives will appear here.']; const phrases = lesson.target_phrases?.length ? lesson.target_phrases : ['Target phrases will appear here.']; const remaining = Math.max(0, (liveData?.subscription?.minutesAllocated || 0) - (liveData?.subscription?.minutesUsed || 0)); return `
    <section class="proto-hero lavender-hero"><div><span class="proto-pill">${esc(lesson.level || '—')} · LESSON ${esc(lesson.lesson_number || '—')}</span><h2>${esc(lesson.title || 'Your next lesson')}</h2><p>${remaining} minutes remaining this cycle</p></div><a class="proto-btn" href="?view=live">Join lesson call →</a></section>
    <section class="proto-grid two"><article class="proto-panel"><span class="proto-label">OBJECTIVES</span><h3>By the end of this lesson, you will be able to:</h3><ul class="objective-list">${objectives.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article><article class="proto-panel"><span class="proto-label">TARGET PHRASES</span><h3>Language to use today</h3><div class="phrase-list">${phrases.map(item => `<span>${esc(item)}</span>`).join('')}</div></article></section>
    <article class="proto-panel"><h3>Before you begin</h3><p>Find a quiet place and check your microphone. Penny will help you practice the lesson objectives with feedback during the call.</p><button class="proto-btn dark">Check audio</button></article>`; }
  function live() { return `
    <section class="live-stage"><div class="live-top"><span class="live-status">LIVE</span><b>09:42 remaining</b></div><div class="penny-orb">P</div><h2>Penny is listening…</h2><p>“On balance, which option would you recommend, Sofia?”</p><div class="live-actions"><button>Mute</button><button>Notes</button><a href="?view=result">End lesson</a></div></section>
    <section class="proto-grid two"><article class="proto-panel tip"><h3>Live coaching tip</h3><p>Take your time. Penny waits for you to finish, then gives one or two useful corrections.</p></article><article class="proto-panel video-option"><span class="proto-label">COMING SOON</span><h3>Video lesson</h3><p>Video lessons will be available in a future release.</p></article></section>`; }
  function result() { return `
    <section class="proto-hero result-hero"><div><span class="proto-label">LESSON COMPLETE</span><h2>You passed this lesson</h2><p>You made a clear, balanced recommendation and met the required standard in all three assessed skills.</p></div><div class="hero-number green"><b>80.0%</b><small>final score</small></div></section>
    <section class="score-explainer"><b>Passed</b><span>Final score is the unrounded average of vocabulary, grammar and fluency. Each assessed skill must also be at least 40.0%.</span></section>
    <h2 class="proto-heading">Your assessed skills</h2><section class="score-grid">${[['Vocabulary','78.0',78],['Grammar','82.0',82],['Fluency','80.0',80]].map(x=>`<article class="proto-panel"><span>${x[0]}</span><b>${x[1]}%</b>${pct(x[2])}</article>`).join('')}<article class="proto-panel premium-score"><span>Pronunciation</span><b>Premium</b><p>Available with optional pronunciation assessment.</p></article></section>
    <article class="proto-panel feedback"><h3>Penny’s feedback</h3><p>Your reasoning was strong. Next time, practice using “whereas” more naturally and slow down slightly before your conclusion.</p><div class="metric-pair"><span><b>86 WPM</b>Speaking pace</span><span><b>72%</b>Your share of talk time</span></div><a class="proto-btn" href="?view=review">Review lesson →</a><a class="proto-btn dark" href="?view=lessons">Next lesson →</a></article>`; }
  function selfStudy() { return `<section class="state-card info-state"><span class="proto-pill">COMING SOON</span><h2>Self-Study is on its way</h2><p>Independent personalized practice will be introduced after the live-lesson experience is complete.</p><a class="proto-btn dark" href="?view=home">Back to Home →</a></section>`; }
  function practice() { return `<section class="state-card info-state"><span class="proto-pill">COMING SOON</span><h2>Practice with Penny is coming soon</h2><p>On-demand conversations will be available after the scheduled lesson experience launches.</p><a class="proto-btn dark" href="?view=home">Back to Home →</a></section>`; }
  function review() { return `
    <section class="proto-grid two review-layout"><article class="proto-panel review-recording"><span class="proto-label">RECORDING</span><h3>Speaking with confidence</h3><p>Lesson completed today · 15 minutes</p><div class="audio-player"><button>▶</button><span><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>14:52</b></div><div class="metric-pair"><span><b>86 WPM</b>Your speaking pace</span><span><b>72%</b>Your share of talk time</span></div></article><article class="proto-panel"><span class="proto-label">SCORES</span><h3>Lesson result: Passed · 80.0%</h3>${[['Vocabulary',78],['Grammar',82],['Fluency',80]].map(x=>`<div class="skill-line"><span>${x[0]} ${x[1]}.0%</span>${pct(x[1])}</div>`).join('')}<a class="subtle" href="?view=result">View full result →</a></article></section>
    <article class="proto-panel"><span class="proto-label">TRANSCRIPT</span><h3>Conversation highlights</h3><p class="transcript"><b>Penny:</b> Which option would you recommend, and why?<br><br><b>You:</b> On balance, I would choose the online option, whereas the in-person course has the advantage of immediate feedback.</p></article>`; }
  function failed() { return `<section class="state-card warning-state"><span class="proto-pill">LESSON RESULT</span><h2>Not passed this time</h2><p>Your final score was 73.4%, but Vocabulary was 38.0%. A score below 40.0% in any assessed skill means this lesson needs another attempt.</p><p class="state-note">This attempt used your lesson minutes. Penny will guide you through a focused retry.</p><a class="proto-btn dark" href="?view=details">View retry lesson →</a></section>`; }
  function incomplete() { return `<section class="state-card info-state"><span class="proto-pill">LESSON INCOMPLETE</span><h2>Your lesson ended early</h2><p>You completed less than one-third of the planned lesson time, so no lesson minutes were used.</p><a class="proto-btn dark" href="?view=details">Return to lesson details →</a></section>`; }
  function outOfMinutes() { return `<section class="state-card coral-state"><span class="proto-pill">LESSON MINUTES USED</span><h2>You have no minutes remaining this cycle</h2><p>Your next lesson will unlock when your subscription renews or your plan is updated.</p><a class="proto-btn dark" href="?view=home">Back to Home →</a></section>`; }
  function progress() { const skills = skillAverages(); const completed = completedAttempts().length; const used = Number(liveData?.subscription?.minutesUsed || 0); const allocated = Number(liveData?.subscription?.minutesAllocated || 0); const remaining = Math.max(0, allocated - used); return `
    <section class="proto-cards three stat-row"><article class="proto-card lavender"><span>Current level</span><h2>${esc(liveData?.profile?.englishLevel || '—')}</h2><p>Your current course level</p></article><article class="proto-card mint"><span>Completed lessons</span><h2>${completed}</h2><p>${completed === 1 ? 'Result recorded' : 'Results recorded'}</p></article><article class="proto-card coral"><span>Minutes used</span><h2>${used} / ${allocated || '—'}</h2><p>${allocated ? `${remaining} remaining` : 'Plan allocation pending'}</p></article></section>
    <section class="proto-grid progress-grid"><article class="proto-panel"><h3>Skill progress</h3>${skills.length ? `<p>Average scores from completed assessed lessons.</p>${skills.map(([label, value])=>`<div class="skill-line"><span>${label} ${value.toFixed(1)}%</span>${pct(value)}</div>`).join('')}` : '<p>Your Vocabulary, Grammar, and Fluency scores will appear here after a completed assessed lesson.</p>'}</article><article class="proto-panel account"><span class="proto-label">COMING SOON</span><h3>Account & support</h3><p>Messages, notifications, profile settings, and help will be added when these features are connected.</p></article></section>`; }
  const renderers = {home,lessons,details,live,result,review,failed,incomplete,'out-of-minutes':outOfMinutes,'self-study':selfStudy,practice,progress};
  function render() {
    const name = liveData?.profile?.name || 'Learner';
    const level = liveData?.profile?.englishLevel || '—';
    const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
    const pageTitle = view === 'home' ? [`Good morning, ${firstName()}`, titleMap.home[1]] : top;
    document.getElementById('learnerPortal').innerHTML = `
      <aside class="sidebar proto-sidebar"><div class="brand"><span class="brand-mark">P</span><strong>PENNY AI</strong></div><nav class="proto-nav-list">${navItems.map(x=>link(x[0],x[1])).join('')}<a class="proto-nav" href="?view=progress">More</a></nav><div class="prototype-note"><b>Live staging dashboard</b><span>Your profile, lessons, results, and subscription minutes are loaded securely.</span></div></aside>
      <main class="workspace"><header class="topbar"><div class="welcome"><h1>${esc(pageTitle[0])}</h1><p>${esc(pageTitle[1])}</p></div><div class="header-actions"><div class="search">Search learning content</div><div class="notification-count">3</div><div class="profile"><div class="avatar">${esc(initials)}</div><div><strong>${esc(name)}</strong><small>${esc(level)} Intermediate</small></div></div></div></header><div class="content proto-content">${renderers[view]()}</div></main>
      <nav class="mobile-nav">${navItems.slice(0,4).map(x=>`<a class="${view===x[0]?'active':''}" href="?view=${x[0]}">${x[1]}</a>`).join('')}<a href="?view=progress">More</a></nav>`;
  }
  async function initialize() {
    try {
      const cfg = await fetch('/api/config').then(response => response.json());
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data: { session } } = await client.auth.getSession();
      if (!session) { window.location.href = '/signin.html'; return; }
      const response = await fetch('/api/learner-dashboard', { headers: { Authorization: 'Bearer ' + session.access_token } });
      if (!response.ok) throw new Error('Unable to load learner dashboard');
      liveData = await response.json();
    } catch (error) {
      console.error(error);
    }
    render();
  }
  initialize();
})();

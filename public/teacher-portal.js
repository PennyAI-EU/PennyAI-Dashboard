(function () {
  'use strict';
  const views = ['overview', 'students', 'schedule', 'feedback', 'messages', 'reports'];
  const view = views.includes(new URLSearchParams(location.search).get('view')) ? new URLSearchParams(location.search).get('view') : 'overview';
  const nav = [['overview', 'Overview'], ['students', 'My Students'], ['schedule', 'Lessons'], ['reports', 'Student Progress'], ['feedback', 'Feedback'], ['messages', 'Messages']];
  const titles = { overview: ['Teacher portal', 'Your assigned learners, lesson activity, and feedback in one place.'], students: ['My students', 'Review learner levels, lesson activity, and support needs.'], schedule: ['Lessons & schedule', 'Scheduling will appear here when the calendar is connected.'], feedback: ['Feedback', 'Review and add teacher feedback after completed lessons.'], messages: ['Messages', 'Teacher–learner messages will be connected in a future release.'], reports: ['Student progress', 'Real Vocabulary, Grammar, and Fluency results will be available here.'] };
  let teacherName = 'Teacher';
  let students = [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = name => String(name || 'Teacher').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const status = student => student.current_lesson_id ? 'Lesson assigned' : 'Awaiting lesson';
  const navLink = ([key, label]) => `<a class="teacher-nav ${view === key ? 'active' : ''}" href="?view=${key}">${label}</a>`;
  const comingSoon = (title, message) => `<section class="teacher-panel"><span class="proto-label">COMING SOON</span><h2>${esc(title)}</h2><p>${esc(message)}</p></section>`;
  function overview() {
    const assigned = students.length;
    const assignedLessons = students.filter(student => student.current_lesson_id).length;
    return `<section class="teacher-hero"><h2>Welcome, ${esc(teacherName.split(/\s+/)[0])}</h2><p>${assigned ? `You have ${assigned} assigned learner${assigned === 1 ? '' : 's'} in staging.` : 'No learners are assigned to this teacher yet.'}</p><a class="teacher-btn" href="?view=students">View students</a></section><section class="teacher-stat-grid"><article><i class="lilac"></i><span>Assigned students</span><b>${assigned}</b></article><article><i class="mint"></i><span>Lessons assigned</span><b>${assignedLessons}</b></article><article><i class="sand"></i><span>Feedback due</span><b>—</b></article><article><i class="pink"></i><span>New messages</span><b>—</b></article></section><section class="teacher-grid wide"><article class="teacher-panel"><h3>Assigned learners</h3>${assigned ? students.slice(0, 6).map(student => `<a class="teacher-row" href="?view=students"><b>${esc(student.english_level || '—')}</b><span>${esc(student.name || 'Learner')} · ${esc(status(student))}</span></a>`).join('') : '<p>No learners are currently assigned to this teacher.</p>'}</article><article class="teacher-panel"><h3>Assessed skills</h3><p>Vocabulary, Grammar, and Fluency results will appear after completed assessed lessons are available.</p></article></section>`;
  }
  function studentList() {
    return `<section class="teacher-panel table-panel"><div class="student-head"><span>Student</span><span>Level</span><span>Current lesson</span><span>Status</span><span></span><span></span></div>${students.length ? students.map((student, index) => `<div class="student-row"><span><i class="student-dot d${index % 4}"></i><b>${esc(student.name || 'Learner')}</b><small>${esc(student.email || 'No email on file')}</small></span><span>${esc(student.english_level || '—')}</span><span>${student.current_lesson_id ? `Lesson ${esc(student.current_lesson_id)}` : 'Not assigned'}</span><span class="ok">${esc(status(student))}</span><span></span><span></span></div>`).join('') : '<p>No learners are currently assigned to this teacher.</p>'}</section>`;
  }
  function content() {
    if (view === 'overview') return overview();
    if (view === 'students') return studentList();
    if (view === 'schedule') return comingSoon('Lessons & schedule', 'Lesson scheduling will be connected when calendar data is available.');
    if (view === 'feedback') return comingSoon('Feedback', 'Completed lesson results will appear here for teacher review and feedback.');
    if (view === 'messages') return comingSoon('Messages', 'Secure teacher–learner messaging will be connected in a future release.');
    return comingSoon('Student progress', 'Vocabulary, Grammar, and Fluency progress will appear after assessed lessons are completed.');
  }
  function render() {
    const title = titles[view];
    document.getElementById('teacherPortal').innerHTML = `<aside class="sidebar teacher-sidebar"><div class="teacher-brand">PENNY AI</div><small>TEACHER WORKSPACE</small><nav>${nav.map(navLink).join('')}</nav></aside><main class="workspace"><header class="teacher-topbar"><span>Teacher portal&nbsp;&nbsp;/&nbsp;&nbsp;${esc(title[0])}</span><div><input placeholder="Search students, lessons…"><div class="teacher-avatar">${esc(initials(teacherName))}</div></div></header><div class="content teacher-content"><div class="teacher-title"><h1>${esc(title[0])}</h1><p>${esc(title[1])}</p></div>${content()}</div></main><nav class="mobile-nav">${nav.slice(0, 4).map(([key, label]) => `<a class="${view === key ? 'active' : ''}" href="?view=${key}">${label}</a>`).join('')}</nav>`;
  }
  async function initialize() {
    try {
      const config = await fetch('/api/config').then(response => response.json());
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data: { session } } = await client.auth.getSession();
      if (!session) { window.location.href = '/signin.html'; return; }
      teacherName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Teacher';
      const response = await fetch('/api/teacher/students', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (response.ok) students = await response.json();
    } catch (error) { console.error('Unable to load teacher portal', error); }
    render();
  }
  initialize();
})();

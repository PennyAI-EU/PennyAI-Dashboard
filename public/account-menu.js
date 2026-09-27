/*
 * Penny AI — shared account menu (top right of every dashboard).
 * One place for: profile photo, My profile, Change photo, Change password, Sign out.
 *
 * Usage (from a page's module script, after sign-in is confirmed):
 *   window.PennyAccountMenu.mount({
 *     mount: document.getElementById('account-slot'),  // element to render into
 *     supabase,                                          // the page's Supabase client
 *     me,                                                // row from /api/me
 *     email: session.user.email,
 *     theme: 'dark' | 'light',                           // dark = on the lilac top bar
 *     onProfile: () => {...}                             // optional: page's own profile screen
 *   });
 */
(function () {
  'use strict';

  var ROLE_LABELS = {
    student: 'Student',
    teacher: 'Teacher',
    school_admin: 'School Admin',
    system_admin: 'Super Admin'
  };

  var CSS = [
    '.pam { position: relative; flex-shrink: 0; }',
    '.pam-trigger { display: flex; align-items: center; gap: 11px; background: none; border: none; cursor: pointer;',
    '  font: inherit; text-align: left; padding: 4px 8px 4px 4px; border-radius: 28px; transition: background .15s; }',
    '.pam-dark .pam-trigger:hover, .pam-dark .pam-trigger[aria-expanded="true"] { background: rgba(255,255,255,.16); }',
    '.pam-light .pam-trigger:hover, .pam-light .pam-trigger[aria-expanded="true"] { background: #f1ecfc; }',
    '.pam-trigger:focus-visible { outline: 2px solid #6b4fc4; outline-offset: 2px; }',
    '.pam-dark .pam-trigger:focus-visible { outline-color: #fff; }',
    '.pam-avatar { width: 44px; height: 44px; border-radius: 22px; background: #e2589a; color: #fff; font-size: 13px;',
    '  font-weight: 700; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }',
    '.pam-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }',
    '.pam-meta strong { display: block; font-size: 12.5px; font-weight: 600; }',
    '.pam-meta span { display: block; font-size: 10.5px; margin-top: 2px; }',
    '.pam-dark .pam-meta strong { color: #fff; } .pam-dark .pam-meta span { color: rgba(255,255,255,.75); }',
    '.pam-light .pam-meta strong { color: #1f1d2b; } .pam-light .pam-meta span { color: #6b6780; }',
    '.pam-caret { width: 16px; height: 16px; transition: transform .15s; }',
    '.pam-dark .pam-caret { color: rgba(255,255,255,.85); } .pam-light .pam-caret { color: #6b6780; }',
    '.pam-trigger[aria-expanded="true"] .pam-caret { transform: rotate(180deg); }',
    '.pam-dropdown { position: absolute; right: 0; top: calc(100% + 8px); z-index: 1000; width: 250px; background: #fff;',
    '  border-radius: 14px; padding: 6px; box-shadow: 0 14px 34px rgba(49,28,110,.22); }',
    '.pam-dropdown[hidden] { display: none; }',
    '.pam-head { padding: 10px 12px 12px; border-bottom: 1px solid #eee8f8; margin-bottom: 4px; }',
    '.pam-head-name { font-size: 14px; font-weight: 700; color: #1f1d2b; }',
    '.pam-head-email { font-size: 12px; color: #6b6780; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.pam-item { width: 100%; display: flex; align-items: center; gap: 10px; background: none; border: none; cursor: pointer;',
    '  text-align: left; padding: 10px 12px; border-radius: 9px; font-family: inherit; font-size: 14px; font-weight: 500; color: #2b2840; }',
    '.pam-item svg { width: 18px; height: 18px; color: #6b4fc4; flex-shrink: 0; }',
    '.pam-item:hover, .pam-item:focus-visible { background: #f1ecfc; outline: none; }',
    '.pam-signout, .pam-signout svg { color: #b42318; }',
    '.pam-signout:hover, .pam-signout:focus-visible { background: #fdecea; }',
    '.pam-toast { position: absolute; right: 0; top: calc(100% + 8px); z-index: 999; background: #fff; color: #2b2840;',
    '  font-size: 12.5px; padding: 8px 12px; border-radius: 10px; box-shadow: 0 8px 22px rgba(49,28,110,.18); white-space: nowrap; }',
    '.pam-toast[hidden] { display: none; } .pam-toast.pam-bad { color: #b42318; }',
    '.pam-modal-bg { position: fixed; inset: 0; background: rgba(31,29,43,.45); z-index: 1100; display: flex;',
    '  align-items: center; justify-content: center; padding: 16px; }',
    '.pam-modal-bg[hidden] { display: none; }',
    '.pam-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 420px; padding: 26px;',
    '  box-shadow: 0 24px 60px rgba(31,29,43,.3); color: #1f1d2b; font-family: inherit; }',
    '.pam-modal h2 { font-size: 20px; font-weight: 700; margin: 0 0 18px; }',
    '.pam-photo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }',
    '.pam-photo-row .pam-avatar { width: 64px; height: 64px; border-radius: 32px; font-size: 20px; }',
    '.pam-link { background: none; border: none; color: #5b5ce2; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; }',
    '.pam-field { margin-bottom: 14px; }',
    '.pam-field label { display: block; font-size: 13px; font-weight: 600; color: #4a4760; margin-bottom: 6px; }',
    '.pam-field input { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1px solid #dcd6ea; border-radius: 10px;',
    '  font: inherit; font-size: 14px; color: #1f1d2b; background: #fff; }',
    '.pam-field input:focus { outline: 2px solid #6b4fc4; outline-offset: 0; border-color: transparent; }',
    '.pam-field input[readonly] { background: #f6f4fb; color: #6b6780; }',
    '.pam-hint { font-size: 12px; color: #6b6780; margin-top: 5px; }',
    '.pam-err { color: #b42318; font-size: 13px; margin: 4px 0 10px; }',
    '.pam-err[hidden] { display: none; }',
    '.pam-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }',
    '.pam-btn { border-radius: 10px; padding: 10px 18px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid #dcd6ea; background: #fff; color: #1f1d2b; }',
    '.pam-btn-primary { background: #FFBF00; border-color: #FFBF00; color: #181b30; }',
    '.pam-btn:disabled { opacity: .6; cursor: default; }',
    '@media (max-width: 800px) { .pam-meta, .pam-caret { display: none; } }'
  ].join('\n');

  var ICONS = {
    caret: '<svg class="pam-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    signout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return p.length ? (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase() : '?';
  }
  function injectCss() {
    if (document.getElementById('pam-css')) return;
    var st = document.createElement('style');
    st.id = 'pam-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function paintAvatar(el, url, name) {
    el.textContent = '';
    if (url) {
      var img = document.createElement('img');
      img.src = url; img.alt = '';
      img.onerror = function () { el.textContent = initials(name); };
      el.appendChild(img);
    } else {
      el.textContent = initials(name);
    }
  }

  // Shrink a chosen photo to a 256px square JPEG before upload.
  function squareJpeg(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var side = Math.min(img.naturalWidth, img.naturalHeight);
        var c = document.createElement('canvas'); c.width = c.height = 256;
        c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function mount(opts) {
    injectCss();
    var root = opts.mount;
    var supabase = opts.supabase;
    var me = Object.assign({}, opts.me || {});
    var email = opts.email || me.email || '';
    var displayName = function () { return me.full_name || me.name || 'Account'; };
    var roleLabel = ROLE_LABELS[me.role] || '';

    root.classList.add('pam', opts.theme === 'light' ? 'pam-light' : 'pam-dark');
    root.innerHTML =
      '<button class="pam-trigger" type="button" aria-haspopup="menu" aria-expanded="false">' +
        '<div class="pam-avatar"></div>' +
        '<div class="pam-meta"><strong class="pam-name"></strong><span>' + esc(opts.subtitle || roleLabel) + '</span></div>' +
        ICONS.caret +
      '</button>' +
      '<div class="pam-dropdown" role="menu" hidden>' +
        '<div class="pam-head"><div class="pam-head-name"></div><div class="pam-head-email">' + esc(email) + '</div></div>' +
        '<button type="button" role="menuitem" class="pam-item" data-act="profile">' + ICONS.profile + 'My profile</button>' +
        '<button type="button" role="menuitem" class="pam-item" data-act="photo">' + ICONS.photo + 'Change photo</button>' +
        '<button type="button" role="menuitem" class="pam-item" data-act="password">' + ICONS.lock + 'Change password</button>' +
        '<button type="button" role="menuitem" class="pam-item pam-signout" data-act="signout">' + ICONS.signout + 'Sign out</button>' +
      '</div>' +
      '<input type="file" accept="image/jpeg,image/png,image/webp" hidden>' +
      '<div class="pam-toast" role="status" hidden></div>';

    var trigger = root.querySelector('.pam-trigger');
    var dropdown = root.querySelector('.pam-dropdown');
    var fileInput = root.querySelector('input[type=file]');
    var toastEl = root.querySelector('.pam-toast');

    function refresh() {
      root.querySelector('.pam-name').textContent = displayName();
      root.querySelector('.pam-head-name').textContent = displayName();
      paintAvatar(root.querySelector('.pam-avatar'), me.avatar_url, displayName());
      var modalAvatar = document.getElementById('pam-profile-avatar');
      if (modalAvatar) paintAvatar(modalAvatar, me.avatar_url, displayName());
    }
    function toast(msg, bad) {
      toastEl.textContent = msg; toastEl.hidden = !msg; toastEl.classList.toggle('pam-bad', !!bad);
      clearTimeout(toast._t);
      if (msg && !/\.\.\.$/.test(msg)) toast._t = setTimeout(function () { toastEl.hidden = true; }, 3500);
    }
    function close() { dropdown.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dropdown.hidden;
      dropdown.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      if (open) { var first = dropdown.querySelector('.pam-item'); if (first) first.focus(); }
    });
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dropdown.hidden) { close(); trigger.focus(); }
    });

    async function token() {
      var s = await supabase.auth.getSession();
      return s && s.data && s.data.session ? s.data.session.access_token : null;
    }

    async function uploadPhoto(file) {
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Please choose a JPG, PNG or WebP photo.', true);
      if (file.size > 15 * 1024 * 1024) return toast('That photo is too large (max 15 MB).', true);
      toast('Uploading photo...');
      try {
        var dataUrl = await squareJpeg(file);
        var t = await token();
        if (!t) return toast('Please sign in again.', true);
        var res = await fetch('/api/me/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
          body: JSON.stringify({ image: dataUrl })
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) return toast(out.error || 'Could not upload your photo.', true);
        me.avatar_url = out.avatar_url;
        refresh();
        toast('Photo updated');
        if (typeof opts.onChange === 'function') opts.onChange(me);
      } catch (err) {
        toast('Could not read that photo. Try another one.', true);
      }
    }
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      uploadPhoto(f);
    });

    // ---- modals (created once per page) ----
    function modal(id, html) {
      var bg = document.getElementById(id);
      if (!bg) {
        bg = document.createElement('div');
        bg.id = id; bg.className = 'pam-modal-bg'; bg.hidden = true;
        bg.innerHTML = '<div class="pam-modal" role="dialog" aria-modal="true">' + html + '</div>';
        document.body.appendChild(bg);
        bg.addEventListener('click', function (e) { if (e.target === bg) bg.hidden = true; });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') bg.hidden = true; });
      }
      return bg;
    }

    function openProfile() {
      if (typeof opts.onProfile === 'function') { opts.onProfile(); return; }
      var bg = modal('pam-profile',
        '<h2>My profile</h2>' +
        '<div class="pam-photo-row"><div class="pam-avatar" id="pam-profile-avatar"></div>' +
          '<button type="button" class="pam-link" id="pam-profile-photo">Change photo</button></div>' +
        '<div class="pam-field"><label for="pam-profile-name">First name</label><input id="pam-profile-name" autocomplete="given-name"></div>' +
        '<div class="pam-field"><label for="pam-profile-last">Surname</label><input id="pam-profile-last" autocomplete="family-name"></div>' +
        '<div class="pam-field"><label>Sign-in email</label><input id="pam-profile-email" readonly>' +
          '<div class="pam-hint">To change your sign-in email, ask the super admin.</div></div>' +
        '<div class="pam-field"><label>Role</label><input id="pam-profile-role" readonly></div>' +
        '<div class="pam-err" id="pam-profile-err" hidden></div>' +
        '<div class="pam-actions"><button type="button" class="pam-btn" id="pam-profile-cancel">Cancel</button>' +
          '<button type="button" class="pam-btn pam-btn-primary" id="pam-profile-save">Save</button></div>');
      document.getElementById('pam-profile-name').value = me.name || '';
      document.getElementById('pam-profile-last').value = me.last_name || '';
      document.getElementById('pam-profile-email').value = email;
      document.getElementById('pam-profile-role').value = roleLabel;
      document.getElementById('pam-profile-err').hidden = true;
      paintAvatar(document.getElementById('pam-profile-avatar'), me.avatar_url, displayName());
      document.getElementById('pam-profile-photo').onclick = function () { fileInput.click(); };
      document.getElementById('pam-profile-cancel').onclick = function () { bg.hidden = true; };
      document.getElementById('pam-profile-save').onclick = async function () {
        var btn = this, err = document.getElementById('pam-profile-err');
        var name = document.getElementById('pam-profile-name').value.trim();
        var last = document.getElementById('pam-profile-last').value.trim();
        if (!name) { err.textContent = 'Please enter your first name.'; err.hidden = false; return; }
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
          var r = await supabase.from('users').update({ name: name, last_name: last || null }).eq('id', me.id);
          if (r.error) throw r.error;
          await supabase.auth.updateUser({ data: { name: name } });
          me.name = name;
          me.last_name = last || null;
          me.full_name = (name + ' ' + (me.last_name || '')).trim();
          refresh();
          bg.hidden = true;
          toast('Profile saved');
          if (typeof opts.onChange === 'function') opts.onChange(me);
        } catch (e) {
          err.textContent = 'Could not save your profile. Please try again.'; err.hidden = false;
        } finally {
          btn.disabled = false; btn.textContent = 'Save';
        }
      };
      bg.hidden = false;
      document.getElementById('pam-profile-name').focus();
    }

    function openPassword() {
      var bg = modal('pam-password',
        '<h2>Change password</h2>' +
        '<div class="pam-field"><label for="pam-pw-1">New password</label><input id="pam-pw-1" type="password" autocomplete="new-password">' +
          '<div class="pam-hint">At least 8 characters.</div></div>' +
        '<div class="pam-field"><label for="pam-pw-2">Repeat new password</label><input id="pam-pw-2" type="password" autocomplete="new-password"></div>' +
        '<div class="pam-err" id="pam-pw-err" hidden></div>' +
        '<div class="pam-actions"><button type="button" class="pam-btn" id="pam-pw-cancel">Cancel</button>' +
          '<button type="button" class="pam-btn pam-btn-primary" id="pam-pw-save">Change password</button></div>');
      var p1 = document.getElementById('pam-pw-1'), p2 = document.getElementById('pam-pw-2'), err = document.getElementById('pam-pw-err');
      p1.value = ''; p2.value = ''; err.hidden = true;
      document.getElementById('pam-pw-cancel').onclick = function () { bg.hidden = true; };
      document.getElementById('pam-pw-save').onclick = async function () {
        var btn = this;
        err.hidden = true;
        if (p1.value.length < 8) { err.textContent = 'Please use at least 8 characters.'; err.hidden = false; return; }
        if (p1.value !== p2.value) { err.textContent = 'The two passwords do not match.'; err.hidden = false; return; }
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
          var r = await supabase.auth.updateUser({ password: p1.value, data: { must_change_password: false } });
          if (r.error) throw r.error;
          bg.hidden = true;
          toast('Password changed');
        } catch (e) {
          var m = String((e && e.message) || '');
          err.textContent = /different from the old/i.test(m)
            ? 'Please choose a password different from your current one.'
            : 'Could not change your password. Please try again.';
          err.hidden = false;
        } finally {
          btn.disabled = false; btn.textContent = 'Change password';
        }
      };
      bg.hidden = false;
      p1.focus();
    }

    dropdown.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      close();
      var act = btn.getAttribute('data-act');
      if (act === 'profile') openProfile();
      else if (act === 'photo') fileInput.click();
      else if (act === 'password') openPassword();
      else if (act === 'signout') {
        try { await supabase.auth.signOut(); } catch (_) {}
        window.location.href = '/signin.html';
      }
    });

    refresh();
    return {
      refresh: refresh,
      openPassword: openPassword,
      update: function (patch) { Object.assign(me, patch || {}); refresh(); }
    };
  }

  window.PennyAccountMenu = { mount: mount, roleLabel: function (r) { return ROLE_LABELS[r] || ''; } };
})();

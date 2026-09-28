/* =========================================================
   서버 연동 (Supabase) — 공용 데이터 · 파일 · 로그인
   모든 PC·휴대폰이 같은 데이터를 보고, 변경 사항은 실시간으로 반영된다.
   ========================================================= */

/* ▼▼▼ 서버 설정 (Supabase 프로젝트 → Project Settings → API) ▼▼▼ */
const SUPABASE_URL = 'https://oqefkpbkbkzaeravpkuu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dFeqKPEfOpUrRzZCkTXBMA_GIuzVxnK';
/* ▲▲▲ 서버 설정 ▲▲▲ */

const AUTH_DOMAIN = 'myunghye-office.app';   // 아이디를 내부 로그인 주소로 바꿀 때만 쓰임 (메일 발송 없음)
const OWNER_USERNAME = 'admin';              // 대표 관리자 아이디 (관리자 탭은 비밀번호만 입력)
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
const FILE_LIMIT_MB = 50;
const LIST_COLS = ['events', 'meetings', 'docs', 'notices', 'notis', 'logs', 'trash'];

const toEmail = (username) => `${username.toLowerCase()}@${AUTH_DOMAIN}`;
function korErr(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/Invalid login credentials/i.test(m)) return '아이디 또는 비밀번호가 올바르지 않습니다.';
  if (/already registered|already exists|duplicate/i.test(m)) return '이미 사용 중인 아이디입니다. 다른 아이디를 입력하세요.';
  if (/Password should be at least|weak/i.test(m)) return '비밀번호는 6자 이상으로 입력하세요.';
  if (/Email not confirmed/i.test(m)) return '서버 설정에서 이메일 확인(Confirm email)을 꺼야 합니다. 관리자에게 알려 주세요.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return '서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.';
  if (/rate limit/i.test(m)) return '요청이 너무 많습니다. 잠시 후 다시 시도하세요.';
  if (/Payload too large|exceeded the maximum/i.test(m)) return `파일이 너무 큽니다. ${FILE_LIMIT_MB}MB 이하만 올릴 수 있습니다.`;
  return m || '알 수 없는 오류가 발생했습니다.';
}

/* ---------- Remote: Supabase 호출 모음 (테스트에서는 REMOTE_MOCK으로 대체) ---------- */
const Remote = window.REMOTE_MOCK || (() => {
  let sb = null; let channel = null;
  const must = (r) => { if (r.error) throw new Error(korErr(r.error)); return r.data; };
  return {
    get configured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); },
    async init() {
      if (!this.configured) return;
      if (!window.supabase) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = SUPABASE_JS; s.onload = res; s.onerror = () => rej(new Error('서버 연결 도구를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); document.head.appendChild(s); });
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mh_office_auth' } });
    },
    async sessionUserId() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user.id : null; },
    async signIn(username, password) { const r = await sb.auth.signInWithPassword({ email: toEmail(username), password }); return must(r).user.id; },
    async signUp({ username, password, name, dept: d }) {
      const r = await sb.auth.signUp({ email: toEmail(username), password, options: { data: { username: username.toLowerCase(), name, dept: d } } });
      const data = must(r);
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('이미 사용 중인 아이디입니다. 다른 아이디를 입력하세요.');
      await sb.auth.signOut();
    },
    async signOut() { try { await sb.auth.signOut(); } catch (e) { /* ignore */ } },
    async updatePassword(password) { must(await sb.auth.updateUser({ password })); },
    async loadDepts() { return must(await sb.from('items').select('id,data').eq('collection', 'depts')); },
    async myProfile(id) { return must(await sb.from('profiles').select('*').eq('id', id).maybeSingle()); },
    async loadProfiles() { return must(await sb.from('profiles').select('*').order('created_at')); },
    async loadItems() {
      const out = [];
      for (let i = 0; ; i += 1000) {
        const rows = must(await sb.from('items').select('collection,id,data').order('collection').order('id').range(i, i + 999));
        out.push(...rows); if (rows.length < 1000) break;
      }
      return out;
    },
    async upsertItems(rows) { for (let i = 0; i < rows.length; i += 200) must(await sb.from('items').upsert(rows.slice(i, i + 200), { onConflict: 'collection,id' })); },
    async deleteItems(keys) {
      const by = {}; keys.forEach(([c, id]) => { (by[c] = by[c] || []).push(id); });
      for (const [c, ids] of Object.entries(by)) for (let i = 0; i < ids.length; i += 200) must(await sb.from('items').delete().eq('collection', c).in('id', ids.slice(i, i + 200)));
    },
    async updateProfile(id, patch) { must(await sb.from('profiles').update(patch).eq('id', id)); },
    async upload(id, blob) { must(await sb.storage.from('files').upload(id, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })); },
    async download(id) { return must(await sb.storage.from('files').download(id)); },
    async removeFile(id) { must(await sb.storage.from('files').remove([id])); },
    async rpc(name, args) { return must(await sb.rpc(name, args)); },
    subscribe(onItem, onProfile) {
      channel = sb.channel('mh-office-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => onItem(p.eventType === 'DELETE' ? 'delete' : 'upsert', p.eventType === 'DELETE' ? p.old : p.new))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (p) => onProfile(p.eventType === 'DELETE' ? 'delete' : 'upsert', p.eventType === 'DELETE' ? p.old : p.new))
        .subscribe();
    },
    unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } },
  };
})();

/* ---------- 파일: 서버 저장소 + 메모리 캐시 ---------- */
const FileStore = (() => {
  const mem = new Map();
  return {
    async put(id, blob) {
      if (blob.size > FILE_LIMIT_MB * 1048576) throw new Error(`파일이 너무 큽니다. ${FILE_LIMIT_MB}MB 이하만 올릴 수 있습니다.`);
      await Remote.upload(id, blob); mem.set(id, blob);
    },
    async get(id) {
      if (mem.has(id)) return mem.get(id);
      try { const b = await Remote.download(id); if (b) mem.set(id, b); return b || null; } catch (e) { console.warn(e); return null; }
    },
    async del(id) { mem.delete(id); try { await Remote.removeFile(id); } catch (e) { /* ignore */ } },
    async clear() { mem.clear(); },
  };
})();

/* ---------- 동기화: 화면은 DB(메모리)를 고치고 saveDB()만 부르면 서버에 반영된다 ---------- */
let SNAP = new Map();   // collection|id → 마지막으로 서버와 같았던 JSON
let PSNAP = new Map();  // 교직원 프로필
const PROFILE_MAP = { name: 'name', dept: 'dept', title: 'title', level: 'level', status: 'status', mealManager: 'meal_manager', lastLogin: 'last_login', approvedAt: 'approved_at' };

function profileToUser(p) {
  return { id: p.id, username: p.username, name: p.name, dept: p.dept || '', title: p.title || '', level: p.level, status: p.status, mealManager: !!p.meal_manager, isOwner: !!p.is_owner, requestedAt: p.created_at, approvedAt: p.approved_at, lastLogin: p.last_login };
}
const profileJSON = (u) => JSON.stringify(Object.keys(PROFILE_MAP).map((k) => u[k] ?? null));

function emptyDB() {
  const d = seedDB();
  return { ...d, users: [], depts: [], meetingTypes: [], categories: [], settings: {} };
}
function applyItem(r) {
  const c = r.collection; const data = r.data;
  if (LIST_COLS.includes(c)) {
    const arr = DB[c]; const i = arr.findIndex((x) => x.id === r.id);
    if (i >= 0) arr[i] = data; else if (c === 'logs' || c === 'notis' || c === 'trash' || c === 'docs' || c === 'notices') arr.unshift(data); else arr.push(data);
  } else if (c === 'meals') DB.meals[r.id] = data;
  else if (c === 'depts') {
    const i = DB.depts.findIndex((x) => x.id === r.id); const d = { ...data }; delete d.order;
    if (i >= 0) DB.depts[i] = d; else DB.depts.push(d);
    DB._deptOrder = DB._deptOrder || {}; DB._deptOrder[r.id] = data.order ?? 99;
    DB.depts.sort((a, b) => (DB._deptOrder[a.id] ?? 99) - (DB._deptOrder[b.id] ?? 99));
  } else if (c === 'config') {
    if (r.id === 'settings') DB.settings = data; else DB[r.id] = data.list;
  }
}
function removeItem(c, id) {
  if (LIST_COLS.includes(c)) DB[c] = DB[c].filter((x) => x.id !== id);
  else if (c === 'meals') delete DB.meals[id];
  else if (c === 'depts') DB.depts = DB.depts.filter((x) => x.id !== id);
}
function currentRows() {
  const m = new Map();
  const put = (collection, id, data) => m.set(collection + '|' + id, { collection, id, data, dept: (data && data.dept) || null, sensitive: !!(data && data.sensitive) });
  LIST_COLS.forEach((c) => DB[c].forEach((x) => { if (!x.id) x.id = uid(c.slice(0, 2)); put(c, x.id, x); }));
  Object.entries(DB.meals).forEach(([d, v]) => put('meals', d, v));
  DB.depts.forEach((d, i) => put('depts', d.id, { ...d, order: i }));
  put('config', 'meetingTypes', { list: DB.meetingTypes });
  put('config', 'categories', { list: DB.categories });
  put('config', 'settings', DB.settings);
  return m;
}
async function loadAllData() {
  const [profiles, items] = await Promise.all([Remote.loadProfiles(), Remote.loadItems()]);
  DB = emptyDB(); SNAP = new Map(); PSNAP = new Map();
  items.sort((a, b) => ((a.data && (a.data.t || a.data.createdAt)) || '').localeCompare((b.data && (b.data.t || b.data.createdAt)) || ''));
  items.forEach((r) => { applyItem(r); SNAP.set(r.collection + '|' + r.id, JSON.stringify(r.data)); });
  ['logs', 'notis', 'trash'].forEach((c) => DB[c].sort((a, b) => (b.t || b.at || '').localeCompare(a.t || a.at || '')));
  DB.users = profiles.map(profileToUser);
  DB.users.forEach((u) => PSNAP.set(u.id, profileJSON(u)));
  // 처음 시작한 학교: 기본 부서·분류·설정 채우기 (관리자가 로그인하면 서버에 저장됨)
  const def = seedDB();
  if (!DB.depts.length) DB.depts = def.depts;
  if (!DB.meetingTypes.length) DB.meetingTypes = def.meetingTypes;
  if (!DB.categories.length) DB.categories = def.categories;
  DB.settings = { lockMinutes: 30, ...def.settings, ...DB.settings };
}

let flushTimer = null; let flushing = false; let flushAgain = false; let flushFails = 0;
function saveDB() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 200); }
async function flush() {
  if (!ME || !DB) return;
  if (flushing) { flushAgain = true; return; }
  flushing = true;
  const errs = [];
  try {
    // 1) 교직원 정보 (승인·권한 등) — 자료 저장과 별개로 먼저 저장
    for (const u of DB.users) {
      if (!isAdmin() && u.id !== ME.id) continue;
      const j = profileJSON(u); const old = PSNAP.get(u.id);
      if (old === undefined || old === j) continue;
      const prev = JSON.parse(old); const patch = {};
      Object.entries(PROFILE_MAP).forEach(([k, col], i) => { if ((u[k] ?? null) !== prev[i]) patch[col] = u[k] ?? null; });
      try { await Remote.updateProfile(u.id, patch); PSNAP.set(u.id, j); } catch (e) { errs.push(e); }
    }
    // 2) 교무실 자료
    const cur = currentRows(); const ups = []; const dels = [];
    const writable = (k) => isAdmin() || !(k.startsWith('depts|') || k.startsWith('config|'));
    for (const [k, r] of cur) { const j = JSON.stringify(r.data); if (SNAP.get(k) !== j && writable(k)) ups.push({ k, j, r }); }
    for (const k of SNAP.keys()) if (!cur.has(k) && writable(k)) dels.push(k);
    if (ups.length) { try { await Remote.upsertItems(ups.map((u) => u.r)); ups.forEach((u) => SNAP.set(u.k, u.j)); } catch (e) { errs.push(e); } }
    if (dels.length) { try { await Remote.deleteItems(dels.map((k) => [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)])); dels.forEach((k) => SNAP.delete(k)); } catch (e) { errs.push(e); } }
    if (errs.length) throw errs[0];
    flushFails = 0; setSyncState('ok');
  } catch (e) {
    console.error(e); flushFails++;
    setSyncState('error', korErr(e));
    if (flushFails === 1) toast('서버 저장 실패: ' + korErr(e) + ' — 자동으로 다시 시도합니다.');
    setTimeout(saveDB, Math.min(30000, 3000 * flushFails));
  } finally {
    flushing = false;
    if (flushAgain) { flushAgain = false; saveDB(); }
  }
}
async function flushNow() { clearTimeout(flushTimer); await flush(); while (flushing) await new Promise((r) => setTimeout(r, 50)); }
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && ME) flush(); });
window.addEventListener('beforeunload', (e) => { if (flushTimer && ME) { flush(); } });
function setSyncState(s, msg) {
  const el = $('#syncState'); if (!el) return;
  el.className = 'sync ' + s; el.title = s === 'ok' ? '서버와 동기화됨' : '서버 저장 실패: ' + (msg || '');
}

/* 다른 선생님의 변경이 실시간으로 들어오면 반영 */
let remoteRenderTimer = null;
function scheduleRemoteRender() {
  clearTimeout(remoteRenderTimer);
  remoteRenderTimer = setTimeout(() => {
    updateBell();
    const a = document.activeElement;
    const editing = a && $('#view') && $('#view').contains(a) && (a.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(a.tagName));
    if (!editing && ME) rerender();
  }, 400);
}
function localItemJSON(c, id) {
  if (LIST_COLS.includes(c)) { const x = DB[c].find((v) => v.id === id); return x ? JSON.stringify(x) : undefined; }
  if (c === 'meals') return DB.meals[id] ? JSON.stringify(DB.meals[id]) : undefined;
  if (c === 'depts') { const i = DB.depts.findIndex((d) => d.id === id); return i >= 0 ? JSON.stringify({ ...DB.depts[i], order: i }) : undefined; }
  if (c === 'config') return JSON.stringify(id === 'settings' ? DB.settings : { list: DB[id] });
  return undefined;
}
function onRemoteItem(ev, row) {
  if (!DB || !row || !row.collection) return;
  const k = row.collection + '|' + row.id;
  // 아직 서버에 저장되지 않은 내 변경이 있으면 내 변경을 우선(곧 저장됨)
  const dirty = SNAP.has(k) && localItemJSON(row.collection, row.id) !== SNAP.get(k);
  if (ev === 'delete') { if (!SNAP.has(k)) return; if (dirty) { SNAP.delete(k); saveDB(); return; } removeItem(row.collection, row.id); SNAP.delete(k); }
  else {
    const j = JSON.stringify(row.data); if (SNAP.get(k) === j) return;
    if (dirty) { SNAP.set(k, j); saveDB(); return; }
    applyItem(row); SNAP.set(k, j);
  }
  scheduleRemoteRender();
}
function onRemoteProfile(ev, p) {
  if (!DB || !p || !p.id) return;
  if (ev === 'delete') { DB.users = DB.users.filter((u) => u.id !== p.id); PSNAP.delete(p.id); if (ME && p.id === ME.id) return forceLogout('계정이 삭제되었습니다.'); }
  else {
    const nu = profileToUser(p); const i = DB.users.findIndex((u) => u.id === p.id);
    if (i >= 0) {
      // 필드별 병합: 내가 바꾸고 아직 저장 안 된 항목은 유지
      const cur = DB.users[i]; const prev = PSNAP.has(p.id) ? JSON.parse(PSNAP.get(p.id)) : null;
      Object.keys(PROFILE_MAP).forEach((key, idx) => { if (prev && (cur[key] ?? null) !== prev[idx]) nu[key] = cur[key]; });
      const serverJSON = JSON.stringify(Object.keys(PROFILE_MAP).map((key) => profileToUser(p)[key] ?? null));
      Object.assign(cur, nu); PSNAP.set(p.id, serverJSON);
      if (profileJSON(cur) !== serverJSON) saveDB();
    } else { DB.users.push(nu); PSNAP.set(p.id, profileJSON(nu)); }
    if (ME && p.id === ME.id && nu.status !== 'active') return forceLogout('계정이 비활성화되었습니다. 관리자에게 문의하세요.');
  }
  scheduleRemoteRender();
}

/* ---------- 로그인 · 가입 ---------- */
let SESSION = null;
function authMsg(msg) {
  if (!msg) return '';
  return `<p class="tag ${msg.startsWith('✓') ? 'green' : 'orange'}" style="display:block;padding:10px 12px;margin-bottom:16px;white-space:normal;font-size:13px;text-align:left;line-height:1.5">${esc(msg)}</p>`;
}
function authCard(inner) { $('#root').innerHTML = `<div class="auth"><div class="auth-card">${inner}</div></div>`; }
function authBusy(form, on) { $$('button, input, select', form).forEach((b) => { b.disabled = on; }); const s = $('button[type=submit]', form); if (s && on) s.textContent = '확인 중…'; }
function showLoading(text) { authCard(`<div class="auth-logo">${icon('school')}</div><h1 style="font-size:22px">${SCHOOL} 온라인 교무실</h1><p class="sub" style="margin-bottom:0">${esc(text || '불러오는 중…')}</p>`); }

function renderAuth(mode = 'login', msg = '') {
  if (mode === 'admin') {
    authCard(`<div class="auth-logo">${icon('shield')}</div><h1>관리자 로그인</h1><p class="sub">비밀번호를 입력하면 바로 들어갑니다.</p>
      <div class="segmented" style="display:flex;margin-bottom:20px"><button style="flex:1" data-act="toLogin">교직원</button><button class="active" style="flex:1">관리자</button></div>
      ${authMsg(msg)}
      <form id="adminForm"><div class="field"><input class="input" type="password" name="pw" placeholder="관리자 비밀번호" autocomplete="current-password" autofocus style="text-align:center;font-size:18px" required></div>
      <button class="btn lg block" type="submit">들어가기</button></form>`);
    $('#adminForm').addEventListener('submit', (e) => { e.preventDefault(); doLogin(OWNER_USERNAME, formData(e.target).pw, e.target, 'admin'); });
    return;
  }
  if (mode === 'register') {
    authCard(`<div class="auth-logo">${icon('users')}</div><h1>교직원 가입 신청</h1>
      <p class="sub">가입 신청 후 <b>관리자가 승인하면</b> 어느 PC·휴대폰에서든 로그인할 수 있습니다.</p>
      ${authMsg(msg)}
      <form id="regForm">
        <div class="row"><div class="field"><label>이름</label><input class="input" name="name" autocomplete="name" required></div>
          <div class="field"><label>소속 부서</label><select class="input" name="dept">${deptOptions(DB && DB.depts.length ? DB.depts[0].id : 'd1')}</select></div></div>
        <div class="field"><label>아이디 (영문 소문자·숫자 3~20자)</label><input class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="예: hong01" required></div>
        <div class="row"><div class="field"><label>비밀번호 (6자 이상)</label><input class="input" type="password" name="pw" autocomplete="new-password" required></div>
          <div class="field"><label>비밀번호 확인</label><input class="input" type="password" name="pw2" autocomplete="new-password" required></div></div>
        <button class="btn lg block" type="submit">가입 신청</button>
        <button class="btn ghost block" type="button" data-act="toLogin" style="margin-top:8px">로그인 화면으로</button>
      </form>`);
    $('#regForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(e.target); const username = f.username.toLowerCase();
      if (!/^[a-z0-9._-]{3,20}$/.test(username)) return renderAuth('register', '아이디는 영문 소문자·숫자(._- 가능) 3~20자로 입력하세요.');
      if (username === OWNER_USERNAME) return renderAuth('register', '사용할 수 없는 아이디입니다.');
      if (f.pw.length < 6) return renderAuth('register', '비밀번호는 6자 이상으로 입력하세요.');
      if (f.pw !== f.pw2) return renderAuth('register', '비밀번호 확인이 일치하지 않습니다.');
      authBusy(e.target, true);
      try {
        await Remote.signUp({ username, password: f.pw, name: f.name.trim(), dept: f.dept });
        renderAuth('login', `✓ ${f.name} 선생님, 가입 신청이 접수되었습니다. 관리자 승인 후 아이디 「${username}」로 로그인하세요.`);
      } catch (err) { renderAuth('register', korErr(err)); }
    });
    return;
  }
  authCard(`<div class="auth-logo">${icon('school')}</div><h1>${SCHOOL} 온라인 교무실</h1><p class="sub">교직원 전용 디지털 교무실입니다.</p>
    <div class="segmented" style="display:flex;margin-bottom:20px"><button class="active" style="flex:1">교직원</button><button style="flex:1" data-act="toAdmin">관리자</button></div>
    ${authMsg(msg)}
    <form id="loginForm">
      <div class="field"><label>아이디</label><input class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label>비밀번호</label><input class="input" type="password" name="pw" autocomplete="current-password" required></div>
      <button class="btn lg block" type="submit" style="margin-top:6px">로그인</button>
    </form>
    <button class="btn ghost block" data-act="toRegister" style="margin-top:10px">처음 오셨나요? 가입 신청하기</button>
    <p class="foot">비밀번호를 잊으셨으면 관리자에게 초기화를 요청하세요.</p>`);
  $('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); const f = formData(e.target); doLogin(f.username.toLowerCase(), f.pw, e.target, 'login'); });
}
ACT.toLogin = () => renderAuth('login');
ACT.toAdmin = () => renderAuth('admin');
ACT.toRegister = () => renderAuth('register');

async function doLogin(username, pw, form, mode) {
  authBusy(form, true);
  try { const id = await Remote.signIn(username, pw); await enterApp(id, true); }
  catch (e) { renderAuth(mode, korErr(e)); }
}
async function enterApp(id, fresh) {
  const p = await Remote.myProfile(id);
  if (!p) { await Remote.signOut(); return renderAuth('login', '계정 정보를 찾을 수 없습니다. 관리자에게 문의하세요.'); }
  if (p.status === 'pending') { await Remote.signOut(); return renderAuth('login', '가입 승인 대기 중입니다. 관리자가 승인하면 로그인할 수 있습니다.'); }
  if (p.status !== 'active') { await Remote.signOut(); return renderAuth('login', '비활성화된 계정입니다. 관리자에게 문의하세요.'); }
  showLoading('교무실 자료를 불러오는 중…');
  await loadAllData();
  ME = DB.users.find((u) => u.id === id);
  SESSION = { lastActive: Date.now() };
  if (fresh) { ME.lastLogin = nowISO(); log('login', 'session', ME.name); }
  saveDB();
  Remote.subscribe(onRemoteItem, onRemoteProfile);
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#home');
  renderShell(); route();
}
async function logout(msg, forced) {
  if (ME && !forced) { log('logout', 'session', ME.name); await flushNow(); }
  Remote.unsubscribe(); await Remote.signOut();
  ME = null; SESSION = null; DB = null; SNAP = new Map(); PSNAP = new Map(); FileStore.clear();
  closeAllModals(); $('#lockScreen')?.remove(); locked = false;
  history.replaceState(null, '', location.pathname);
  DB = emptyDB(); DB.depts = seedDB().depts;
  renderAuth('login', msg || '');
}
function forceLogout(msg) { toast(msg); logout(msg, true); }
ACT.logout = async () => { if (await confirmBox('로그아웃할까요?', '로그아웃')) logout(); };

ACT.changeMyPw = () => {
  const m = openModal({
    title: '내 비밀번호 변경',
    body: `<form id="cpForm"><div class="field"><label>새 비밀번호 (6자 이상)</label><input class="input" type="password" name="pw" autocomplete="new-password"></div>
      <div class="field"><label>새 비밀번호 확인</label><input class="input" type="password" name="pw2" autocomplete="new-password"></div></form>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="cpGo">변경</button>`,
  });
  $('#cpGo', m).addEventListener('click', async () => {
    const f = formData($('#cpForm', m));
    if (f.pw.length < 6) return toast('비밀번호는 6자 이상이어야 합니다.');
    if (f.pw !== f.pw2) return toast('비밀번호 확인이 일치하지 않습니다.');
    try { await Remote.updatePassword(f.pw); log('update', 'user', ME.name, '비밀번호 변경'); saveDB(); closeModal(); toast('비밀번호가 변경되었습니다.'); }
    catch (e) { toast(korErr(e)); }
  });
};

/* ---------- 일정 시간 미사용 시 재인증 ---------- */
let locked = false;
function touchActive() { if (SESSION && !locked) SESSION.lastActive = Date.now(); }
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, touchActive, { passive: true, capture: true }));
setInterval(() => {
  if (!ME || locked || !SESSION) return;
  if (Date.now() - SESSION.lastActive > (DB.settings.lockMinutes || 30) * 60000) showLock();
}, 20000);
function showLock() {
  locked = true;
  const el = document.createElement('div');
  el.className = 'lock-screen'; el.id = 'lockScreen';
  el.innerHTML = `<div class="auth-card"><div class="auth-logo">${icon('lock')}</div>
    <h1 style="font-size:24px">잠금 상태</h1>
    <p class="sub">${DB.settings.lockMinutes || 30}분 동안 사용하지 않아 잠겼습니다.<br>${esc(ME.name)} 선생님의 비밀번호를 입력하세요.</p>
    <form id="unlockForm"><div class="field"><input class="input" name="pw" type="password" placeholder="비밀번호" autocomplete="current-password"></div>
    <button class="btn lg block">잠금 해제</button><button type="button" class="btn ghost block" data-act="logout" style="margin-top:8px">다른 계정으로 로그인</button></form></div>`;
  document.body.appendChild(el);
  $('#unlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await Remote.signIn(ME.username, formData(e.target).pw); }
    catch (err) { return toast('비밀번호가 올바르지 않습니다.'); }
    locked = false; SESSION.lastActive = Date.now(); el.remove(); log('unlock', 'session', ME.name); saveDB();
  });
}

/* ---------- Boot ---------- */
async function boot() {
  DB = emptyDB(); DB.depts = seedDB().depts;
  if (!Remote.configured) {
    authCard(`<div class="auth-logo">${icon('info')}</div><h1 style="font-size:22px">서버 설정이 필요합니다</h1>
      <p class="sub" style="margin-bottom:0">index.html 안의 SUPABASE_URL · SUPABASE_ANON_KEY 값을 입력한 뒤 다시 열어 주세요.</p>`);
    return;
  }
  showLoading('연결 중…');
  try {
    await Remote.init();
    const id = await Remote.sessionUserId();
    if (id) return await enterApp(id, false);
    try {
      const rows = await Remote.loadDepts();
      if (rows && rows.length) DB.depts = rows.sort((x, y) => (x.data.order ?? 99) - (y.data.order ?? 99)).map((r) => { const dd = { ...r.data }; delete dd.order; return dd; });
    } catch (e) { /* 기본 부서 사용 */ }
    renderAuth('login');
  } catch (e) {
    console.error(e);
    authCard(`<div class="auth-logo">${icon('info')}</div><h1 style="font-size:22px">연결할 수 없습니다</h1><p class="sub">${esc(korErr(e))}</p><button class="btn block" onclick="location.reload()">다시 시도</button>`);
  }
}

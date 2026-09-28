'use strict';
/* =========================================================
   명혜학교 온라인 교무실 — core (utils, store, auth, shell)
   ========================================================= */

const SCHOOL = '명혜학교';

/* ---------- small utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowISO = () => new Date().toISOString();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function todayStr() { return ymd(today()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); return x; }
function mondayOf(d) { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; }
/** 주말에는 다가오는 주를 '이번 주'로 본다 */
function workWeekStart(d = today()) { const w = d.getDay(); return w === 0 ? addDays(d, 1) : w === 6 ? addDays(d, 2) : mondayOf(d); }
function fmtKo(d) { return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${DOW[d.getDay()]}요일`; }
function fmtMD(s) { const d = parseYmd(s); return `${d.getMonth() + 1}.${d.getDate()}(${DOW[d.getDay()]})`; }
function fmtDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtFull(iso) { const d = new Date(iso); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function relTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return fmtDT(iso);
}
function fmtSize(b) { if (!b && b !== 0) return ''; if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }
function hexA(hex, a) { const h = hex.replace('#', ''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function extOf(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
function hashSeed(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(arr, seed) { return arr[seed % arr.length]; }

/* ---------- icons ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 13h18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.2c3 .2 5 2.3 5 5.3"/>',
  meal: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1-4 3.8-4 7v3h4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4.2l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  megaphone: '<path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin: '<path d="M9 3h6l-1 6 4 3v2H6v-2l4-3zM12 14v7"/>',
  school: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};
function icon(name, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name] || ''}</svg>`;
}

const FILE_COLORS = {
  hwp: '#1e88e5', hwpx: '#1e88e5', xls: '#1d8a4e', xlsx: '#1d8a4e', csv: '#1d8a4e', doc: '#2b579a', docx: '#2b579a',
  ppt: '#d24726', pptx: '#d24726', pdf: '#e5252a', jpg: '#af52de', jpeg: '#af52de', png: '#af52de', gif: '#af52de', txt: '#8e8e93',
};
function fileIcon(ext) {
  const e = (ext || '?').toLowerCase();
  return `<div class="ficon" style="background:${FILE_COLORS[e] || '#8e8e93'}">${esc(e.toUpperCase().slice(0, 4))}</div>`;
}

/* ---------- lazy CDN libs ---------- */
const LIBS = {
  XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  JSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
};
const libLoading = {};
function loadLib(name) {
  if (window[name]) return Promise.resolve(window[name]);
  if (libLoading[name]) return libLoading[name];
  libLoading[name] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = LIBS[name];
    s.onload = () => res(window[name]);
    s.onerror = () => { delete libLoading[name]; rej(new Error(name + ' 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); };
    document.head.appendChild(s);
  });
  return libLoading[name];
}

/* ---------- Store ---------- */
let DB = null;
const dept = (id) => DB.depts.find((d) => d.id === id) || { id: '', name: '미지정', color: '#8e8e93' };
const user = (id) => DB.users.find((u) => u.id === id) || { id: '', name: '알 수 없음', dept: '' };
const LEVEL_NAME = { 1: '일반 교직원', 2: '업무담당자', 3: '최고관리자' };

function log(act, type, title, extra) {
  DB.logs.unshift({ id: uid('lg'), t: nowISO(), uid: ME ? ME.id : '', act, type, title: title || '', extra: extra || '' });
  if (DB.logs.length > 1500) DB.logs.length = 1500;
}
function notify(text, kind, link) {
  DB.notis.unshift({ id: uid('n'), t: nowISO(), text, kind, link: link || null, by: ME ? ME.id : '', readBy: ME ? [ME.id] : [] });
  if (DB.notis.length > 200) DB.notis.length = 200;
}
function trashItem(type, item) {
  DB.trash.unshift({ id: uid('tr'), type, item, at: nowISO(), by: ME.id });
  log('delete', type, item.title || item.name || '');
}

/* ---------- Session & permissions ---------- */
let ME = null;

const isAdmin = () => !!ME && ME.level >= 3;
const isOwner = (u = ME) => !!u && !!u.isOwner;
const roleLabel = (u) => (u.title ? `${u.title}${u.level >= 3 ? ' · 관리자' : ''}` : `${dept(u.dept).name} · ${LEVEL_NAME[u.level]}`);
function canManage(deptId) { return !!ME && (ME.level >= 3 || (ME.level === 2 && ME.dept === deptId)); }
function canEdit(item) { return !!ME && (canManage(item.dept) || item.owner === ME.id || item.createdBy === ME.id); }
function canSeeSensitive(item) { return !item.sensitive || isAdmin() || ME.dept === item.dept; }
function canManageMeals() { return isAdmin() || !!ME.mealManager; }
function canDownload(doc) { return doc.allowDownload !== false || canManage(doc.dept); }

/* ---------- UI primitives ---------- */
let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

const modalStack = [];
function openModal({ title, body, foot = '', wide = false, onClose, cls = '' }) {
  const ov = document.createElement('div');
  ov.className = 'overlay ' + cls;
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-act="closeModal" aria-label="닫기">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
  </div>`;
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov);
  modalStack.push({ el: ov, onClose });
  return ov;
}
function closeModal() {
  const m = modalStack.pop();
  if (!m) return;
  m.el.remove();
  if (m.onClose) m.onClose();
}
function closeAllModals() { while (modalStack.length) closeModal(); }
function topModal() { return modalStack.length ? modalStack[modalStack.length - 1].el : null; }
function confirmBox(msg, okLabel = '확인', danger = false) {
  return new Promise((res) => {
    const m = openModal({
      title: '확인',
      body: `<p style="font-size:15px;line-height:1.6">${msg}</p>`,
      foot: `<button class="btn secondary" data-r="0">취소</button><button class="btn ${danger ? '' : ''}" style="${danger ? 'background:var(--red)' : ''}" data-r="1">${okLabel}</button>`,
      onClose: () => res(false),
    });
    $$('[data-r]', m).forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.r === '1';
      modalStack.pop(); m.remove(); res(v);
    }));
  });
}
function formData(root) {
  const o = {};
  $$('[name]', root).forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  return o;
}
function deptOptions(sel, withAll = false) {
  return (withAll ? `<option value="">전체 부서</option>` : '') + DB.depts.map((d) => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
}
function avatar(u, size = 34) {
  const d = dept(u.dept);
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${d.color};font-size:${Math.round(size * 0.4)}px">${esc((u.name || '?').slice(0, 1))}</div>`;
}
function deptTag(id) { const d = dept(id); return `<span class="tag" style="background:${hexA(d.color, 0.13)};color:${d.color}">${esc(d.name)}</span>`; }
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Action delegation ---------- */
const ACT = {
  closeModal: () => closeModal(),
  go: (d) => { closeAllModals(); location.hash = d.to; },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) closeModal();
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && ME) { e.preventDefault(); const s = $('#globalSearch'); if (s && s.offsetParent) s.focus(); else location.hash = '#search'; }
});

/* ---------- Shell ---------- */
const NAV = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'calendar', label: '일정', icon: 'calendar' },
  { id: 'weekly', label: '주중업무', icon: 'briefcase' },
  { id: 'monthly', label: '월중행사', icon: 'flag' },
  { id: 'meetings', label: '회의실', icon: 'users' },
  { id: 'meals', label: '급식', icon: 'meal' },
  { id: 'docs', label: '자료실', icon: 'folder' },
  { id: 'notices', label: '공지사항', icon: 'megaphone' },
  { id: 'search', label: '검색', icon: 'search' },
];
const BOTTOM = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'calendar', label: '일정', icon: 'calendar' },
  { id: 'docs', label: '자료', icon: 'folder' },
  { id: 'meals', label: '급식', icon: 'meal' },
  { id: 'more', label: '더보기', icon: 'grid' },
];

function renderShell() {
  $('#root').innerHTML = `<div class="app">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${icon('school')}</div><div><b>${SCHOOL} 온라인 교무실</b><span>Myunghye Digital Office</span></div></div>
      <nav class="nav" id="sideNav">
        ${NAV.map((n) => `<button class="nav-item" data-act="go" data-to="#${n.id}" data-nav="${n.id}" title="${n.label}">${icon(n.icon)}<span>${n.label}</span></button>`).join('')}
        ${isAdmin() ? `<div class="nav-sep"></div><button class="nav-item" data-act="go" data-to="#admin" data-nav="admin" title="관리자 센터">${icon('shield')}<span>관리자 센터</span></button>` : ''}
      </nav>
      <div class="me"><button class="me-btn" data-act="changeMyPw" title="내 비밀번호 변경">${avatar(ME)}<div class="who"><b>${esc(ME.name)}</b><span>${esc(roleLabel(ME))}</span></div></button>
        <button class="icon-btn" data-act="logout" title="로그아웃">${icon('logout')}</button></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="mobile-brand">${SCHOOL} 교무실</div>
        <form class="search-box" id="searchForm">${icon('search')}<input id="globalSearch" placeholder="온라인 교무실 전체 검색 (예: 고교학점제)" autocomplete="off"><span class="tag" style="font-size:10.5px">Ctrl K</span></form>
        <div class="spacer"></div>
        <span id="syncState" class="sync ok" title="서버와 동기화됨"></span>
        <button class="icon-btn mobile-only-search" data-act="go" data-to="#search" title="검색" style="display:none">${icon('search')}</button>
        <button class="icon-btn" id="bellBtn" data-act="toggleNoti" title="알림">${icon('bell')}<span id="bellBadge"></span></button>
      </header>
      <div class="content" id="view"></div>
    </div>
    <nav class="bottom-nav">${BOTTOM.map((n) => `<button data-act="${n.id === 'more' ? 'openMore' : 'go'}" data-to="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></button>`).join('')}</nav>
  </div>`;
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#globalSearch').value.trim(); if (q) location.hash = '#search/' + encodeURIComponent(q); });
  if (window.matchMedia('(max-width: 640px)').matches) $('.mobile-only-search').style.display = 'inline-flex';
  updateBell();
}

ACT.openMore = () => {
  const items = [
    ['weekly', '주중업무', 'briefcase'], ['monthly', '월중행사', 'flag'], ['meetings', '회의실', 'users'],
    ['notices', '공지사항', 'megaphone'], ['search', '통합검색', 'search'],
  ];
  if (isAdmin()) items.push(['admin', '관리자', 'shield']);
  openModal({
    title: '더보기', cls: 'more-sheet',
    body: `<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">${avatar(ME, 44)}<div><b>${esc(ME.name)} 선생님</b><div style="font-size:13px;color:var(--text-2)">${esc(roleLabel(ME))}</div></div></div>
      <div class="more-grid">${items.map(([id, l, ic]) => `<button data-act="go" data-to="#${id}">${icon(ic)}${l}</button>`).join('')}
      <button data-act="changeMyPw">${icon('lock')}비밀번호 변경</button><button data-act="logout">${icon('logout')}로그아웃</button></div>`,
  });
};

/* ---------- Notifications ---------- */
function visibleNotis() {
  return DB.notis.filter((n) => (!n.adminOnly || isAdmin()) && (!n.dept || n.dept === ME.dept || isAdmin()));
}
function reminderNotis() {
  // 내일 일정 리마인더 (저장하지 않고 계산)
  const tm = ymd(addDays(today(), 1));
  return allEvents().filter((e) => e.date === tm && (e.kind === '회의' || e.important)).map((e) => ({
    id: 'rem_' + e.id, t: nowISO(), text: `내일 ${e.start ? e.start + ' ' : ''}${e.title}${e.kind === '회의' ? '가 있습니다.' : ' 일정이 있습니다.'}`, kind: 'reminder',
    link: e.meetingId ? '#meetings/' + e.meetingId : '#calendar/day/' + e.date, readBy: [], reminder: true,
  }));
}
function pendingNotis() {
  if (!isAdmin()) return [];
  return DB.users.filter((u) => u.status === 'pending').map((u) => ({ id: 'pend_' + u.id, t: u.requestedAt || nowISO(), text: `🆕 ${u.name} 선생님(${dept(u.dept).name})이 가입을 신청했습니다. 승인해 주세요.`, kind: 'admin', link: '#admin/users', readBy: [], reminder: true, pending: true }));
}
function unreadCount() { return visibleNotis().filter((n) => !n.readBy.includes(ME.id)).length + pendingNotis().length; }
function updateBell() {
  const c = unreadCount();
  const b = $('#bellBadge');
  if (b) b.innerHTML = c ? `<span class="badge-dot">${c > 99 ? '99+' : c}</span>` : '';
}
const NOTI_STYLE = { plan: ['briefcase', '#ff9500'], doc: ['file', '#0071e3'], notice: ['megaphone', '#ff3b30'], meeting: ['users', '#af52de'], reminder: ['clock', '#34c759'], meal: ['meal', '#ff2d55'], admin: ['shield', '#5856d6'] };
ACT.toggleNoti = () => {
  const ex = $('#notiPop');
  if (ex) { ex.remove(); return; }
  const list = [...pendingNotis(), ...reminderNotis(), ...visibleNotis()].slice(0, 40);
  const pop = document.createElement('div');
  pop.className = 'popover'; pop.id = 'notiPop';
  pop.innerHTML = `<h4>알림 <button class="btn ghost sm" data-act="readAllNoti">모두 읽음</button></h4>
    ${list.length ? list.map((n) => {
      const [ic, col] = NOTI_STYLE[n.kind] || ['bell', '#8e8e93'];
      return `<div class="noti ${n.readBy.includes(ME.id) || n.reminder ? '' : 'unread'}" data-act="openNoti" data-id="${n.id}" data-link="${esc(n.link || '')}">
        <div class="ni" style="background:${col}">${icon(ic)}</div><div><p>${esc(n.text)}</p><span>${n.pending ? '가입 신청' : n.reminder ? '리마인더' : relTime(n.t)}</span></div></div>`;
    }).join('') : '<div class="empty">새 알림이 없습니다.</div>'}`;
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener('click', function h(e) { if (!pop.contains(e.target) && !e.target.closest('#bellBtn')) { pop.remove(); document.removeEventListener('click', h); } }), 0);
};
ACT.readAllNoti = () => { visibleNotis().forEach((n) => { if (!n.readBy.includes(ME.id)) n.readBy.push(ME.id); }); saveDB(); updateBell(); $('#notiPop')?.remove(); toast('모든 알림을 읽음 처리했습니다.'); };
ACT.openNoti = (d) => {
  const n = DB.notis.find((x) => x.id === d.id);
  if (n && !n.readBy.includes(ME.id)) { n.readBy.push(ME.id); saveDB(); }
  $('#notiPop')?.remove(); updateBell();
  if (d.link) { closeAllModals(); location.hash = d.link; route(); }
};

/* ---------- Router ---------- */
const VIEWS = {};
let CUR = { view: 'home', args: [] };
function route() {
  if (!ME) return;
  const h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'home';
  const [view, ...args] = h.split('/');
  CUR = { view: VIEWS[view] ? view : 'home', args };
  $$('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === CUR.view));
  $('#notiPop')?.remove();
  const v = $('#view');
  if (!v) return;
  VIEWS[CUR.view](v, args);
  updateBell();
}
function rerender() { route(); }
window.addEventListener('hashchange', () => { closeAllModals(); route(); window.scrollTo(0, 0); });

/* ---------- Unified events (일정 + 회의 = 하나의 데이터) ---------- */
function allEvents() {
  const evs = DB.events.map((e) => ({ ...e, src: 'event' }));
  DB.meetings.forEach((m) => {
    if (!canSeeSensitive(m)) return;
    evs.push({ id: 'm_' + m.id, src: 'meeting', meetingId: m.id, date: m.date, start: m.time, end: m.endTime || '', title: m.title, place: m.place, dept: m.dept, kind: '회의', important: m.important, owner: m.createdBy, memo: m.type });
  });
  return evs;
}
function eventsOn(dateStr, list = allEvents()) {
  return list.filter((e) => e.date === dateStr).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
}
function eventsBetween(from, to, list = allEvents()) {
  return list.filter((e) => e.date >= from && e.date <= to).sort((a, b) => (a.date + (a.start || '99')).localeCompare(b.date + (b.start || '99')));
}
function evColor(e) { return dept(e.dept).color; }

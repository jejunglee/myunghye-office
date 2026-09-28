/* =========================================================
   홈(오늘의 명혜) · 통합 일정 · 주중/월중 업무계획
   ========================================================= */

function visibleDocs() { return DB.docs.filter(canSeeSensitive); }
function visibleNotices() { return DB.notices.slice().sort((a, b) => (b.pinned - a.pinned) || b.createdAt.localeCompare(a.createdAt)); }
function evTimeLabel(e) { return e.start ? e.start + (e.end ? '–' + e.end : '') : '종일'; }
function kindTag(k) { return `<span class="tag ${k === '회의' ? 'purple' : k === '월중행사' ? 'orange' : k === '주중업무' ? 'blue' : ''}">${esc(k || '일반')}</span>`; }
function mealItem(s) { const m = /^(.*?)\s*\(([\d.]+)\)\s*$/.exec(s); return m ? { n: m[1], a: m[2] } : { n: s, a: '' }; }
function mealMenuHTML(meal, compact) {
  if (!meal) return '<div class="empty">등록된 식단이 없습니다.</div>';
  return `<div class="meal-menu">${meal.items.map((s) => { const it = mealItem(s); return `<div>${esc(it.n)}${it.a ? `<sup>${esc(it.a)}</sup>` : ''}</div>`; }).join('')}</div>
    ${!compact && meal.kcal ? `<div class="meal-kcal">${meal.kcal} kcal</div>` : ''}${meal.note ? `<div class="tag orange" style="margin-top:8px;white-space:normal">${esc(meal.note)}</div>` : ''}`;
}
function docRow(d, sub) {
  const v = d.versions[d.cur - 1];
  return `<div class="li" data-act="openDoc" data-id="${d.id}">${fileIcon(v.ext)}<div class="li-main"><div class="li-title">${esc(d.title)}</div>
    <div class="li-sub">${sub || `${esc(dept(d.dept).name)} · ${relTime(d.updatedAt)}`}</div></div>${d.readBy.includes(ME.id) ? '' : '<span class="new-dot" title="미확인"></span>'}</div>`;
}
function evRow(e, showDate) {
  return `<div class="li" data-act="openEvent" data-id="${e.id}"><div class="li-bar" style="background:${evColor(e)}"></div>
    <div class="li-time">${showDate ? fmtMD(e.date).replace(/\(.\)/, '') : (e.start || '종일')}</div>
    <div class="li-main"><div class="li-title">${e.important ? '⭐️ ' : ''}${esc(e.title)}</div><div class="li-sub">${showDate && e.start ? e.start + ' · ' : ''}${esc(e.place || '')}${e.place ? ' · ' : ''}${esc(dept(e.dept).name)}</div></div>
    ${kindTag(e.kind)}</div>`;
}

/* ---------------- 홈 ---------------- */
VIEWS.home = (v) => {
  const T = today(); const ts = todayStr();
  const evs = allEvents();
  const todays = eventsOn(ts, evs);
  const ws = workWeekStart(T); const weekend = T.getDay() === 0 || T.getDay() === 6;
  const weekEvs = eventsBetween(ymd(ws), ymd(addDays(ws, 4)), evs);
  const docs = visibleDocs();
  const unread = docs.filter((d) => !d.readBy.includes(ME.id));
  const recentNew = docs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentMod = docs.filter((d) => d.versions.length > 1).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const notices = visibleNotices().filter((n) => n.important || n.pinned).slice(0, 4);
  let meal = DB.meals[ts]; let mealLabel = '오늘의 급식';
  if (!meal) {
    for (let i = 1; i <= 7; i++) { const d = ymd(addDays(T, i)); if (DB.meals[d]) { meal = DB.meals[d]; mealLabel = `다음 급식 · ${fmtMD(d)}`; break; } }
  }
  const upcomingMeetings = DB.meetings.filter((m) => m.date >= ts && canSeeSensitive(m)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 4);
  const byDay = [0, 1, 2, 3, 4].map((i) => { const d = ymd(addDays(ws, i)); return { d, list: weekEvs.filter((e) => e.date === d) }; });

  const quick = [
    ['오늘 일정', 'calendar', '#ff3b30', '#calendar/day/' + ts], ['주중 업무', 'briefcase', '#0071e3', '#weekly'], ['월중 행사', 'flag', '#ff9500', '#monthly'],
    ['회의자료', 'users', '#af52de', '#meetings'], ['급식', 'meal', '#ff2d55', '#meals'], ['자료실', 'folder', '#34c759', '#docs'], ['통합검색', 'search', '#5856d6', '#search'],
  ];

  v.innerHTML = `
  <section class="hero">
    <div><div class="date">${fmtKo(T)}</div><h1>안녕하세요, ${esc(ME.name)} 선생님</h1></div>
    <div class="stats">
      <div class="stat"><b>${todays.length}</b><span>오늘 일정</span></div>
      <div class="stat"><b>${weekEvs.length}</b><span>${weekend ? '다음 주' : '이번 주'} 업무</span></div>
      <div class="stat"><b>${unread.length}</b><span>미확인 자료</span></div>
    </div>
  </section>
  <div class="quick">${quick.map(([l, ic, c, to]) => `<button data-act="go" data-to="${to}"><div class="qi" style="background:${c}">${icon(ic)}</div>${l}</button>`).join('')}</div>

  <div class="grid c3" style="margin-bottom:20px">
    <div class="card"><div class="card-head"><h3>📢 중요 공지</h3><a class="more" href="#notices">전체</a></div>
      <div class="list">${notices.length ? notices.map((n) => `<div class="li" data-act="openNotice" data-id="${n.id}"><div class="li-main"><div class="li-title">${n.pinned ? '📌 ' : ''}${esc(n.title)}</div><div class="li-sub">${esc(user(n.createdBy).name)} · ${relTime(n.createdAt)}</div></div>${n.readBy.includes(ME.id) || n.createdBy === ME.id ? '' : '<span class="new-dot"></span>'}</div>`).join('') : '<div class="empty">중요 공지가 없습니다.</div>'}</div></div>
    <div class="card"><div class="card-head"><h3>📅 오늘의 일정</h3><a class="more" href="#calendar/day/${ts}">일별 보기</a></div>
      <div class="list">${todays.length ? todays.map((e) => evRow(e)).join('') : `<div class="empty">${weekend ? '주말입니다. 오늘은 등록된 일정이 없습니다.' : '오늘 등록된 일정이 없습니다.'}</div>`}</div></div>
    <div class="card"><div class="card-head"><h3>🍚 ${mealLabel}</h3><a class="more" href="#meals">식단표</a></div>${mealMenuHTML(meal)}</div>
  </div>

  <div class="grid c2" style="margin-bottom:20px">
    <div class="card"><div class="card-head"><h3>🗓 ${weekend ? '다음 주' : '이번 주'} 업무 <span style="font-weight:400;color:var(--text-3);font-size:13px">${fmtMD(ymd(ws))} ~ ${fmtMD(ymd(addDays(ws, 4)))}</span></h3><a class="more" href="#weekly/${ymd(ws)}">주중업무</a></div>
      ${byDay.map(({ d, list }) => `<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:${d === ts ? 'var(--red)' : 'var(--text-2)'};padding:4px 0">${fmtMD(d)}${d === ts ? ' · 오늘' : ''}</div>
        <div class="list">${list.length ? list.map((e) => evRow(e)).join('') : '<div class="li-sub" style="padding:4px 0 8px">일정 없음</div>'}</div></div>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="card"><div class="card-head"><h3>👥 다가오는 회의</h3><a class="more" href="#meetings">회의실</a></div>
        <div class="list">${upcomingMeetings.length ? upcomingMeetings.map((m) => `<div class="li" data-act="openMeeting" data-id="${m.id}"><div class="li-bar" style="background:${dept(m.dept).color}"></div><div class="li-time">${fmtMD(m.date).replace(/\(.\)/, '')}</div><div class="li-main"><div class="li-title">${esc(m.title)}</div><div class="li-sub">${m.time} · ${esc(m.place)} · 자료 ${m.docIds.length}건</div></div><span class="tag purple">${esc(m.type)}</span></div>`).join('') : '<div class="empty">예정된 회의가 없습니다.</div>'}</div></div>
      <div class="card"><div class="card-head"><h3>📂 월중 행사</h3><a class="more" href="#monthly">전체</a></div>
        <div class="list">${eventsBetween(ts, ymd(addDays(T, 45)), evs).filter((e) => e.kind === '월중행사').slice(0, 4).map((e) => evRow(e, true)).join('') || '<div class="empty">예정된 행사가 없습니다.</div>'}</div></div>
    </div>
  </div>

  <div class="grid c3">
    <div class="card"><div class="card-head"><h3>🆕 최근 등록자료</h3><a class="more" href="#docs">자료실</a></div><div class="list">${recentNew.map((d) => docRow(d, `${esc(user(d.createdBy).name)} · ${relTime(d.createdAt)}`)).join('') || '<div class="empty">자료가 없습니다.</div>'}</div></div>
    <div class="card"><div class="card-head"><h3>✏️ 최근 수정자료</h3></div><div class="list">${recentMod.map((d) => docRow(d, `v${d.cur} · ${esc(user(d.updatedBy).name)} · ${relTime(d.updatedAt)}`)).join('') || '<div class="empty">수정된 자료가 없습니다.</div>'}</div></div>
    <div class="card"><div class="card-head"><h3>🔵 내가 확인하지 않은 자료 <span class="tag blue">${unread.length}</span></h3></div><div class="list">${unread.slice(0, 5).map((d) => docRow(d)).join('') || '<div class="empty">모든 자료를 확인했습니다 👏</div>'}</div></div>
  </div>`;
};

/* ---------------- 통합 일정 ---------------- */
let calDeptFilter = new Set();
VIEWS.calendar = (v, args) => {
  const mode = ['day', 'week', 'month', 'year'].includes(args[0]) ? args[0] : 'month';
  const base = args[1] && /^\d{4}-\d{2}-\d{2}$/.test(args[1]) ? parseYmd(args[1]) : today();
  const ts = todayStr();
  let evs = allEvents();
  if (calDeptFilter.size) evs = evs.filter((e) => calDeptFilter.has(e.dept));
  let title = ''; let body = ''; let prev; let next;

  if (mode === 'day') {
    title = fmtKo(base); prev = addDays(base, -1); next = addDays(base, 1);
    const list = eventsOn(ymd(base), evs);
    const allDay = list.filter((e) => !e.start);
    const hours = []; for (let h = 7; h <= 18; h++) hours.push(h);
    body = `<div class="card">${allDay.length ? `<div style="margin-bottom:12px">${allDay.map((e) => `<div class="day-ev" data-act="openEvent" data-id="${e.id}" style="background:${hexA(evColor(e), 0.14)};margin-bottom:6px"><b>${esc(e.title)}</b><span>종일 · ${esc(e.place || '')} · ${esc(dept(e.dept).name)}</span></div>`).join('')}</div>` : ''}
      <div class="day-timeline">${hours.map((h) => {
        const at = list.filter((e) => e.start && clamp(parseInt(e.start, 10), 7, 18) === h);
        return `<div class="day-row"><div class="h">${pad(h)}:00</div><div class="evs">${at.map((e) => `<div class="day-ev" data-act="openEvent" data-id="${e.id}" style="background:${hexA(evColor(e), 0.14)};border-left:3px solid ${evColor(e)}"><b>${e.important ? '⭐️ ' : ''}${esc(e.title)}</b><span>${evTimeLabel(e)} · ${esc(e.place || '')} · ${esc(dept(e.dept).name)} ${e.kind === '회의' ? '· 회의' : ''}</span></div>`).join('')}</div></div>`;
      }).join('')}</div>
      ${!list.length ? '<div class="empty">이 날은 등록된 일정이 없습니다.</div>' : ''}</div>`;
  } else if (mode === 'week') {
    const ws = mondayOf(base); prev = addDays(ws, -7); next = addDays(ws, 7);
    title = `${ws.getMonth() + 1}월 ${weekOfMonth(ws)}주차 <span style="font-weight:400;color:var(--text-3);font-size:15px">${fmtMD(ymd(ws))} ~ ${fmtMD(ymd(addDays(ws, 4)))}</span>`;
    const weekendEvs = eventsBetween(ymd(addDays(ws, 5)), ymd(addDays(ws, 6)), evs);
    body = `<div class="week-grid">${[0, 1, 2, 3, 4].map((i) => {
      const d = addDays(ws, i); const ds = ymd(d); const list = eventsOn(ds, evs);
      return `<div class="week-col ${ds === ts ? 'today' : ''}"><h4><b>${d.getDate()}</b>${DOW[d.getDay()]}요일 <button class="btn ghost sm" style="margin-left:auto;padding:2px 6px" data-act="newEvent" data-date="${ds}" title="일정 추가">${icon('plus', 'width="14" height="14"')}</button></h4>
        ${list.map((e) => `<div class="week-ev" data-act="openEvent" data-id="${e.id}" style="border-left-color:${evColor(e)}"><div class="t">${evTimeLabel(e)}</div><div class="n">${e.important ? '⭐️ ' : ''}${esc(e.title)}</div><div class="p">${esc(e.place || '')}${e.place ? ' · ' : ''}${esc(dept(e.dept).name)}</div></div>`).join('') || '<div class="li-sub">일정 없음</div>'}</div>`;
    }).join('')}</div>
    ${weekendEvs.length ? `<div class="card" style="margin-top:14px"><div class="card-head"><h3>주말</h3></div><div class="list">${weekendEvs.map((e) => evRow(e, true)).join('')}</div></div>` : ''}`;
  } else if (mode === 'month') {
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    prev = addMonths(first, -1); next = addMonths(first, 1);
    title = `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
    const start = addDays(first, -first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i); const ds = ymd(d);
      if (i >= 35 && d.getMonth() !== first.getMonth()) break;
      const list = eventsOn(ds, evs);
      cells.push(`<div class="cell ${d.getMonth() !== first.getMonth() ? 'other' : ''} ${ds === ts ? 'today' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}" data-act="go" data-to="#calendar/day/${ds}">
        <div class="num">${d.getDate()}</div>
        ${list.slice(0, 3).map((e) => `<div class="ev-chip" style="background:${hexA(evColor(e), 0.15)};color:${evColor(e)}" data-act="openEvent" data-id="${e.id}">${e.start ? e.start + ' ' : ''}${esc(e.title)}</div>`).join('')}
        ${list.length > 3 ? `<div class="ev-more">+${list.length - 3}개 더</div>` : ''}</div>`);
    }
    body = `<div class="card" style="padding:12px"><div class="month-grid">${DOW.map((d, i) => `<div class="dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('')}${cells.join('')}</div></div>`;
  } else {
    const y = base.getFullYear(); prev = new Date(y - 1, 0, 1); next = new Date(y + 1, 0, 1);
    title = `${y}년`;
    const cm = today().getFullYear() === y ? today().getMonth() : -1;
    body = `<div class="year-grid">${Array.from({ length: 12 }, (_, m) => {
      const from = ymd(new Date(y, m, 1)); const to = ymd(new Date(y, m + 1, 0));
      const list = eventsBetween(from, to, evs).filter((e) => e.kind === '월중행사' || e.important);
      return `<div class="year-month ${m === cm ? 'current' : ''}" data-act="go" data-to="#calendar/month/${from}"><h4>${m + 1}월</h4>
        ${list.slice(0, 6).map((e) => `<div class="ym-ev"><em>${parseYmd(e.date).getDate()}</em><span class="dot" style="background:${evColor(e)};margin-top:6px"></span>${esc(e.title)}</div>`).join('') || '<div class="li-sub">주요 행사 없음</div>'}
        ${list.length > 6 ? `<div class="ev-more">+${list.length - 6}개</div>` : ''}</div>`;
    }).join('')}</div>`;
  }

  const seg = [['today', '오늘'], ['day', '일'], ['week', '주'], ['month', '월'], ['year', '연']];
  v.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">통합 일정</div><h1>일정</h1></div>
      <div class="actions"><button class="btn secondary" data-act="planImport" data-kind="">${icon('upload', 'width="16" height="16"')}일정 불러오기 (한글·엑셀)</button><button class="btn" data-act="newEvent" data-date="${ymd(base)}">${icon('plus', 'width="16" height="16"')}일정 추가</button></div></div>
    <div class="cal-toolbar">
      <div class="segmented">${seg.map(([m, l]) => `<button class="${m === mode ? 'active' : ''}" data-act="go" data-to="#calendar/${m === 'today' ? 'day' : m}/${m === 'today' ? ts : ymd(base)}">${l}</button>`).join('')}</div>
      <div class="cal-nav"><button class="icon-btn" data-act="go" data-to="#calendar/${mode}/${ymd(prev)}" aria-label="이전">${icon('chevL')}</button><button class="icon-btn" data-act="go" data-to="#calendar/${mode}/${ymd(next)}" aria-label="다음">${icon('chevR')}</button></div>
      <h2>${title}</h2>
    </div>
    <div class="filters">${DB.depts.map((d) => `<button class="chip ${calDeptFilter.has(d.id) ? 'active' : ''}" data-act="calFilter" data-id="${d.id}"><span class="dot" style="background:${d.color};margin-right:6px"></span>${esc(d.name)}</button>`).join('')}
      ${calDeptFilter.size ? '<button class="btn ghost sm" data-act="calFilter" data-id="">필터 해제</button>' : ''}</div>
    ${body}`;
};
function weekOfMonth(d) { const first = new Date(d.getFullYear(), d.getMonth(), 1); return Math.ceil((d.getDate() + ((first.getDay() + 6) % 7)) / 7); }
ACT.calFilter = (d) => { if (!d.id) calDeptFilter.clear(); else if (calDeptFilter.has(d.id)) calDeptFilter.delete(d.id); else calDeptFilter.add(d.id); rerender(); };

/* ---------------- 일정 상세/편집 ---------------- */
ACT.openEvent = (d, el, e) => {
  if (e) e.stopPropagation();
  if (d.id.startsWith('m_')) return ACT.openMeeting({ id: d.id.slice(2) });
  const ev = DB.events.find((x) => x.id === d.id);
  if (!ev) return toast('일정을 찾을 수 없습니다.');
  const editable = canEdit(ev);
  openModal({
    title: esc(ev.title),
    body: `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${kindTag(ev.kind)}${deptTag(ev.dept)}${ev.important ? '<span class="tag red">중요</span>' : ''}</div>
      <div class="list">
        <div class="li" style="cursor:default">${icon('calendar', 'width="18" height="18" style="color:var(--text-3)"')}<div class="li-main">${fmtKo(parseYmd(ev.date))}</div></div>
        <div class="li" style="cursor:default">${icon('clock', 'width="18" height="18" style="color:var(--text-3)"')}<div class="li-main">${evTimeLabel(ev)}</div></div>
        ${ev.place ? `<div class="li" style="cursor:default">${icon('home', 'width="18" height="18" style="color:var(--text-3)"')}<div class="li-main">${esc(ev.place)}</div></div>` : ''}
        <div class="li" style="cursor:default">${icon('users', 'width="18" height="18" style="color:var(--text-3)"')}<div class="li-main">담당: ${esc(ev.manager || user(ev.owner).name)} (${esc(dept(ev.dept).name)})</div></div>
      </div>
      ${ev.memo ? `<div class="card" style="background:var(--card-2);box-shadow:none;margin-top:12px;white-space:pre-wrap;font-size:14px">${esc(ev.memo)}</div>` : ''}
      <p style="font-size:12px;color:var(--text-3);margin-top:14px">최종 수정: ${esc(user(ev.updatedBy).name)} · ${fmtFull(ev.updatedAt)}</p>`,
    foot: `${editable ? `<div class="left"><button class="btn danger" data-act="deleteEvent" data-id="${ev.id}">${icon('trash', 'width="16" height="16"')}삭제</button></div><button class="btn" data-act="editEvent" data-id="${ev.id}">${icon('edit', 'width="16" height="16"')}수정</button>` : '<span style="font-size:12px;color:var(--text-3);margin-right:auto">담당 부서만 수정할 수 있습니다.</span>'}
      <button class="btn secondary" data-act="go" data-to="#calendar/day/${ev.date}">일별 보기</button>`,
  });
};
ACT.newEvent = (d, el, e) => { if (e) e.stopPropagation(); eventForm(null, d.date || todayStr(), d.kind); };
ACT.editEvent = (d) => { closeModal(); eventForm(DB.events.find((x) => x.id === d.id)); };
ACT.deleteEvent = async (d) => {
  const ev = DB.events.find((x) => x.id === d.id);
  if (!ev || !(await confirmBox(`「${esc(ev.title)}」 일정을 삭제할까요?<br><span style="color:var(--text-3);font-size:13px">관리자는 휴지통에서 복구할 수 있습니다.</span>`, '삭제', true))) return;
  DB.events = DB.events.filter((x) => x.id !== ev.id); trashItem('event', ev); saveDB(); closeAllModals(); toast('삭제되었습니다.'); rerender();
};
function eventForm(ev, date, kind) {
  const isNew = !ev;
  const e = ev || { title: '', date, start: '', end: '', place: '', dept: ME.dept, kind: kind || '주중업무', important: false, memo: '', manager: '' };
  const deptSel = isAdmin() ? deptOptions(e.dept) : DB.depts.filter((x) => x.id === ME.dept || x.id === e.dept).map((x) => `<option value="${x.id}" ${x.id === e.dept ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const m = openModal({
    title: isNew ? '일정 추가' : '일정 수정',
    body: `<form id="evForm">
      <div class="field"><label>제목</label><input class="input" name="title" value="${esc(e.title)}" placeholder="예: 교육과정협의회" required></div>
      <div class="row"><div class="field"><label>날짜</label><input class="input" type="date" name="date" value="${e.date}" required></div>
        <div class="field"><label>시작</label><input class="input" type="time" name="start" value="${e.start}"></div>
        <div class="field"><label>종료</label><input class="input" type="time" name="end" value="${e.end}"></div></div>
      <div class="row"><div class="field"><label>장소</label><input class="input" name="place" value="${esc(e.place)}" placeholder="회의실"></div>
        <div class="field"><label>담당자</label><input class="input" name="manager" value="${esc(e.manager || '')}" placeholder="${esc(ME.name)}"></div></div>
      <div class="row"><div class="field"><label>담당 부서</label><select class="input" name="dept">${deptSel}</select></div>
        <div class="field"><label>유형</label><select class="input" name="kind">${['주중업무', '월중행사', '일반'].map((k) => `<option ${k === e.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></div></div>
      <div class="field"><label>메모</label><textarea class="input" name="memo" placeholder="준비물, 참석 대상 등">${esc(e.memo || '')}</textarea></div>
      <label class="check"><input type="checkbox" name="important" ${e.important ? 'checked' : ''}> 중요 일정 (연간 일정·알림에 표시)</label>
    </form>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="evSave">저장</button>`,
  });
  $('#evSave', m).addEventListener('click', () => {
    const f = formData($('#evForm', m));
    if (!f.title || !f.date) return toast('제목과 날짜를 입력하세요.');
    const data = { title: f.title, date: f.date, start: f.start, end: f.end, place: f.place, manager: f.manager, dept: f.dept, kind: f.kind, memo: f.memo, important: f.important, updatedAt: nowISO(), updatedBy: ME.id };
    if (isNew) {
      DB.events.push({ id: uid('e'), owner: ME.id, createdAt: nowISO(), ...data });
      log('create', 'event', f.title);
      if (f.important) notify(`새 중요 일정: ${fmtMD(f.date)} ${f.title}`, 'plan', '#calendar/day/' + f.date);
    } else {
      Object.assign(ev, data); log('update', 'event', f.title);
    }
    saveDB(); closeModal(); toast(isNew ? '일정이 등록되었습니다.' : '일정이 수정되었습니다.'); rerender(); updateBell();
  });
}

/* ---------------- 주중업무 · 월중행사 ---------------- */
VIEWS.weekly = (v, args) => planView(v, 'week', args[0]);
VIEWS.monthly = (v, args) => planView(v, 'month', args[0]);

function planView(v, type, arg) {
  const base = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? parseYmd(arg) : (type === 'week' ? workWeekStart() : today());
  let from; let to; let title; let prev; let next; let list;
  if (type === 'week') {
    const ws = mondayOf(base); from = ymd(ws); to = ymd(addDays(ws, 6));
    title = `${ws.getFullYear()}년 ${ws.getMonth() + 1}월 ${weekOfMonth(ws)}주차`;
    prev = ymd(addDays(ws, -7)); next = ymd(addDays(ws, 7));
    list = eventsBetween(from, to);
  } else {
    const f = new Date(base.getFullYear(), base.getMonth(), 1);
    from = ymd(f); to = ymd(new Date(f.getFullYear(), f.getMonth() + 1, 0));
    title = `${f.getFullYear()}년 ${f.getMonth() + 1}월`;
    prev = ymd(addMonths(f, -1)); next = ymd(addMonths(f, 1));
    list = eventsBetween(from, to).filter((e) => e.kind === '월중행사' || e.important);
  }
  const kindName = type === 'week' ? '주중업무' : '월중행사';
  const origDocs = DB.docs.filter((d) => d.planRange && d.planRange.from <= to && d.planRange.to >= from && canSeeSensitive(d));

  v.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">${type === 'week' ? '주중업무계획' : '월중행사계획'}</div><h1>${kindName}</h1></div>
      <div class="actions">
        <button class="btn secondary" data-act="planTemplate">${icon('table', 'width="16" height="16"')}양식</button>
        <button class="btn secondary" data-act="planOutput" data-from="${from}" data-to="${to}" data-type="${type}">🖨 A4 인쇄</button>
        <button class="btn secondary" data-act="planOutput" data-from="${from}" data-to="${to}" data-type="${type}">${icon('download', 'width="16" height="16"')}엑셀 저장</button>
        <button class="btn secondary" data-act="planImport" data-kind="${kindName}">${icon('upload', 'width="16" height="16"')}일정 불러오기 (한글·엑셀)</button>
        <button class="btn" data-act="planAddRow" data-date="${type === 'week' ? ymd(mondayOf(base)) : from}" data-kind="${kindName}">${icon('plus', 'width="16" height="16"')}행 추가</button>
      </div></div>
    <div class="cal-toolbar">
      <div class="cal-nav"><button class="icon-btn" data-act="go" data-to="#${type === 'week' ? 'weekly' : 'monthly'}/${prev}">${icon('chevL')}</button><button class="icon-btn" data-act="go" data-to="#${type === 'week' ? 'weekly' : 'monthly'}/${next}">${icon('chevR')}</button></div>
      <h2>${title} <span style="font-weight:400;color:var(--text-3);font-size:15px">${fmtMD(from)} ~ ${fmtMD(to)}</span></h2>
      <button class="btn ghost sm" data-act="go" data-to="#${type === 'week' ? 'weekly' : 'monthly'}">${type === 'week' ? '이번 주' : '이번 달'}</button>
      <button class="btn ghost sm" style="margin-left:auto" data-act="go" data-to="#calendar/${type === 'week' ? 'week' : 'month'}/${from}">${icon('calendar', 'width="16" height="16"')}달력으로 보기</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap" style="border:none;border-radius:0">
        <table class="tbl" id="planTable"><thead><tr><th style="width:90px">날짜</th><th style="width:120px">시간</th><th>업무</th><th>장소</th><th style="width:130px">담당부서</th><th style="width:90px">담당자</th><th style="width:90px">구분</th><th style="width:44px"></th></tr></thead>
        <tbody>${list.length ? list.map((e) => planRow(e)).join('') : `<tr><td colspan="8"><div class="empty">등록된 ${kindName}가 없습니다. 엑셀 파일을 불러오거나 행을 추가하세요.</div></td></tr>`}</tbody></table>
      </div>
    </div>
    <p style="font-size:12.5px;color:var(--text-3);margin-top:10px">💡 표의 셀을 클릭해 바로 수정하면 일정(일·주·월·연), 통합검색, 알림에 즉시 반영됩니다. 수정 권한: 담당 부서 업무담당자·작성자·최고관리자</p>
    ${origDocs.length ? `<div class="card" style="margin-top:16px"><div class="card-head"><h3>📎 원본 파일 (보존)</h3></div><div class="list">${origDocs.map((d) => docRow(d)).join('')}</div></div>` : ''}`;

  $$('#planTable td[contenteditable="true"]').forEach((td) => {
    td.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); td.blur(); } });
    td.addEventListener('blur', () => planCellSave(td));
  });
  $$('#planTable select').forEach((s) => s.addEventListener('change', () => {
    const ev = DB.events.find((x) => x.id === s.dataset.id); if (!ev) return;
    ev[s.dataset.f] = s.value; ev.updatedAt = nowISO(); ev.updatedBy = ME.id; log('update', 'event', ev.title); saveDB(); toast('일정에 반영되었습니다.'); rerender();
  }));
}
function planRow(e) {
  const ed = e.src === 'event' && canEdit(e);
  const ce = ed ? 'contenteditable="true"' : '';
  const time = e.start ? e.start + (e.end ? '~' + e.end : '') : '';
  const deptCell = ed ? `<select class="input" style="padding:4px 8px;font-size:13px" data-id="${e.id}" data-f="dept">${(isAdmin() ? DB.depts : DB.depts.filter((x) => x.id === e.dept || x.id === ME.dept)).map((x) => `<option value="${x.id}" ${x.id === e.dept ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : deptTag(e.dept);
  return `<tr data-id="${e.id}">
    <td class="num" ${ce} data-f="date">${fmtMD(e.date)}</td>
    <td class="num" ${ce} data-f="time">${esc(time)}</td>
    <td ${ce} data-f="title" style="font-weight:500">${esc(e.title)}</td>
    <td ${ce} data-f="place">${esc(e.place || '')}</td>
    <td>${deptCell}</td>
    <td ${ce} data-f="manager">${esc(e.manager || (e.src === 'event' ? user(e.owner).name : ''))}</td>
    <td>${kindTag(e.kind)}</td>
    <td>${e.src === 'meeting' ? `<button class="icon-btn" data-act="openMeeting" data-id="${e.meetingId}" title="회의 열기">${icon('chevR')}</button>` : ed ? `<button class="icon-btn" data-act="planDelRow" data-id="${e.id}" title="삭제">${icon('trash')}</button>` : ''}</td></tr>`;
}
function planCellSave(td) {
  const tr = td.closest('tr'); const ev = DB.events.find((x) => x.id === tr.dataset.id);
  if (!ev) return;
  const val = td.textContent.trim(); const f = td.dataset.f;
  let changed = false;
  if (f === 'date') {
    const d = parseDateText(val, parseYmd(ev.date).getFullYear());
    if (!d) { toast('날짜 형식을 확인하세요. 예: 9.22'); td.textContent = fmtMD(ev.date); return; }
    if (d !== ev.date) { ev.date = d; changed = true; }
  } else if (f === 'time') {
    const t = parseTimeText(val);
    if (t.start !== ev.start || t.end !== ev.end) { ev.start = t.start; ev.end = t.end; changed = true; }
  } else if (f === 'title') {
    if (!val) { td.textContent = ev.title; return toast('업무명은 비울 수 없습니다.'); }
    if (val !== ev.title) { ev.title = val; changed = true; }
  } else if ((ev[f] || '') !== val) { ev[f] = val; changed = true; }
  if (!changed) return;
  ev.updatedAt = nowISO(); ev.updatedBy = ME.id; log('update', 'event', ev.title, f); saveDB();
  toast('일정에 반영되었습니다.');
  if (f === 'date' || f === 'time') rerender();
}
ACT.planAddRow = (d) => {
  const ev = { id: uid('e'), date: d.date, start: '', end: '', title: '새 업무', place: '', dept: ME.dept, kind: d.kind, important: false, owner: ME.id, memo: '', manager: ME.name, createdAt: nowISO(), updatedAt: nowISO(), updatedBy: ME.id };
  DB.events.push(ev); log('create', 'event', ev.title); saveDB(); rerender();
  const td = $(`#planTable tr[data-id="${ev.id}"] td[data-f="title"]`);
  if (td) { td.focus(); document.getSelection().selectAllChildren(td); }
};
ACT.planDelRow = async (d) => {
  const ev = DB.events.find((x) => x.id === d.id);
  if (!ev || !(await confirmBox(`「${esc(ev.title)}」을(를) 삭제할까요?`, '삭제', true))) return;
  DB.events = DB.events.filter((x) => x.id !== ev.id); trashItem('event', ev); saveDB(); rerender();
};

/* ---------- 날짜·시간 파싱 ---------- */
function inferYear(m, refYear) {
  const T = today();
  const y = refYear || T.getFullYear();
  // 학년도(3월~2월) 기준: 가을 이후에 1~2월 일정을 올리면 다음 해로 본다
  if (!refYear && m <= 2 && T.getMonth() + 1 >= 8) return y + 1;
  return y;
}
function parseDateText(s, refYear) {
  s = String(s || '').trim();
  if (!s) return null;
  let m = /(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s);
  if (m) return mkDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return mkDate(y, +m[1], +m[2]); }
  m = /(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s);
  if (m) return mkDate(inferYear(+m[1], refYear), +m[1], +m[2]);
  return null;
  function mkDate(y, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; const dt = new Date(y, mo - 1, d); return dt.getMonth() === mo - 1 ? ymd(dt) : null; }
}
function parseTimeText(s) {
  s = String(s || '').trim();
  const out = { start: '', end: '' };
  if (!s) return out;
  const parts = s.split(/[~\-–]/);
  const one = (p, pmHint) => {
    const m = /(\d{1,2})\s*(?:[:시]\s*(\d{1,2})?)?/.exec(p);
    if (!m) return '';
    let h = +m[1]; const mi = m[2] ? +m[2] : 0;
    if (/오후|pm/i.test(p) || (pmHint && h < 12)) { if (h < 12) h += 12; }
    if (h > 23 || mi > 59) return '';
    return `${pad(h)}:${pad(mi)}`;
  };
  const pm = /오후|pm/i.test(s);
  out.start = one(parts[0], pm && /오후|pm/i.test(parts[0]));
  if (parts[1]) out.end = one(parts[1], pm);
  // 1~6시는 학교 일과상 오후로 해석 (예: 3:00 → 15:00)
  const toPm = (t) => { const h = parseInt(t, 10); return t && h >= 1 && h <= 6 && !/오전|am/i.test(s) ? `${pad(h + 12)}:${t.slice(3)}` : t; };
  out.start = toPm(out.start); out.end = toPm(out.end);
  return out;
}
function cellToDate(raw, txt, refYear) {
  if (typeof raw === 'number' && raw > 20000 && window.XLSX) { const c = XLSX.SSF.parse_date_code(raw); if (c) return ymd(new Date(c.y, c.m - 1, c.d)); }
  return parseDateText(txt, refYear);
}
function cellToTime(raw, txt) {
  if (typeof raw === 'number' && raw < 1 && raw > 0) { const mins = Math.round(raw * 1440); return { start: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`, end: '' }; }
  return parseTimeText(txt);
}
function matchDept(s) {
  s = String(s || '').replace(/\s/g, '');
  if (!s) return '';
  const exact = DB.depts.find((d) => d.name === s);
  if (exact) return exact.id;
  const d = DB.depts.find((x) => x.name.includes(s) || s.includes(x.name.replace(/부$|실$/, '')));
  return d ? d.id : '';
}

/* ---------- 일정 파일 불러오기: 엑셀·한글 · 목록형 / 날짜별 행 / 달력형 / 문단 자동 인식 ---------- */
const PLACE_HINT = /(실|강당|관|교실|운동장|도서관|체육관|센터|청|홀|장|방|카페|박물관|미술관|공원|교육청|학교|온라인|원격|줌|zoom|본관|별관|동)$/i;
const PLAN_SKIP = /^(시간|업무|업무\s*내용|내용|행사|행사\s*내용|장소|담당|담당부서|담당자|비고|요일|날짜|일자|일정|주요\s*업무|구분|[월화수목금토일](요일)?)$/;
function deptOf(s) {
  s = String(s || '').replace(/\s/g, '');
  if (s.length < 2) return '';
  const exact = DB.depts.find((d) => d.name === s || d.name.replace(/부$/, '') === s);
  if (exact) return exact.id;
  const pre = DB.depts.filter((d) => d.name.startsWith(s));
  return pre.length === 1 ? pre[0].id : '';
}
function yearFor(mo, ym) { return mo < ym.m - 6 ? ym.y + 1 : mo > ym.m + 6 ? ym.y - 1 : ym.y; }
function headDate(m, ym) { const mo = m[2] ? +m[2] : ym.m; return mkYmd(m[1] ? +m[1] : yearFor(mo, ym), mo, +m[3]); }

/* 일정 한 줄 → 시간 · 제목 · 장소 · 부서 */
function parseEventLine(line) {
  let s = String(line || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[-–·•◦○●◎□■▶▷※*]+\s*/, '').replace(/^\d{1,2}[.)]\s+/, '').trim();
  if (!s || s.length > 80 || PLAN_SKIP.test(s)) return null;
  let start = ''; let end = '';
  const tm = /^(?:(?:오전|오후)\s*)?\d{1,2}\s*[:시]\s*(?:\d{1,2}\s*분?)?(?:\s*[~\-–]\s*(?:(?:오전|오후)\s*)?\d{1,2}\s*(?:[:시]\s*(?:\d{1,2}\s*분?)?)?)?/.exec(s);
  if (tm && /[:시]/.test(tm[0])) { const t = parseTimeText(tm[0]); start = t.start; end = t.end; s = s.slice(tm[0].length).replace(/^[\s,/)\]\-:]+/, '').trim(); }
  let place = ''; let dp = '';
  for (let k = 0; k < 2; k++) {
    const m = /\s*[(\[<〈]\s*([^()\[\]<>〈〉]{1,20}?)\s*[)\]>〉]\s*$/.exec(s);
    if (!m) break;
    const inner = m[1].trim(); const d = deptOf(inner);
    if (d && !dp) { dp = d; s = s.slice(0, m.index).trim(); continue; }
    if (!place && PLACE_HINT.test(inner)) { place = inner; s = s.slice(0, m.index).trim(); continue; }
    break;
  }
  if (!place) { const m = /\s*[/@]\s*([^/@]{1,15})$/.exec(s); if (m && PLACE_HINT.test(m[1].trim())) { place = m[1].trim(); s = s.slice(0, m.index).trim(); } }
  if (!s || /^[\d\s.:~\-()]+$/.test(s)) return null;
  return { title: s, start, end, place, dept: dp };
}
const cellLines = (t) => String(t || '').replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean);

/* ① 목록형: 머리글에 날짜 + 업무(내용·행사) 열 */
function planFromList(grid, raw, ym) {
  const h = grid.slice(0, 15).findIndex((r) => r.some((c) => /날짜|일자|일시/.test(String(c))) && r.some((c) => /업무|내용|행사|일정|제목|활동/.test(String(c))));
  if (h < 0) return null;
  const head = grid[h].map((c) => String(c).replace(/\s/g, ''));
  const col = (re, not) => head.findIndex((c) => re.test(c) && !(not && not.test(c)));
  const C = { date: col(/날짜|일자|일시/), time: col(/시간|시각/), title: col(/업무|내용|행사|일정|제목|활동/, /장소|부서|담당|날짜|일자/), place: col(/장소/), dept: col(/담당부서|부서|주관|담당/, /담당자/), manager: col(/담당자/) };
  if (C.title < 0) return null;
  const out = []; let lastDate = '';
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i]; const rr = (raw && raw[i]) || [];
    let date = C.date >= 0 ? cellToDate(rr[C.date], r[C.date], ym.y) : '';
    if (!date && C.date >= 0) { const m = DATE_HEAD.exec(cellLines(r[C.date])[0] || ''); if (m) date = headDate(m, ym); }
    if (date) lastDate = date; else date = lastDate;   // 병합 셀
    const lines = cellLines(r[C.title]); if (!date || !lines.length) continue;
    const colTime = C.time >= 0 ? cellToTime(rr[C.time], r[C.time]) : { start: '', end: '' };
    const colDept = C.dept >= 0 ? (matchDept(r[C.dept]) || deptOf(r[C.dept])) : '';
    lines.forEach((ln) => {
      const e = parseEventLine(ln); if (!e) return;
      out.push({ date, start: e.start || (lines.length === 1 ? colTime.start : ''), end: e.end || (lines.length === 1 ? colTime.end : ''), title: e.title,
        place: e.place || (C.place >= 0 ? String(r[C.place] || '').trim() : ''), dept: e.dept || colDept, manager: C.manager >= 0 ? String(r[C.manager] || '').trim() : '' });
    });
  }
  return out.length ? out : null;
}
/* ② 날짜별 행: 한 열에 날짜가 세로로 3개 이상, 같은 행의 다른 칸이 그날 일정 */
function planFromDateRows(grid, ym) {
  const W = Math.max(0, ...grid.map((r) => r.length));
  let dc = -1;
  for (let c = 0; c < Math.min(3, W); c++) if (grid.filter((r) => DATE_HEAD.test(cellLines(r[c])[0] || '')).length >= 3) { dc = c; break; }
  if (dc < 0) return null;
  const out = []; let cur = '';
  grid.forEach((r) => {
    const first = cellLines(r[dc]);
    const m = DATE_HEAD.exec(first[0] || '');
    if (m) cur = headDate(m, ym);
    if (!cur) return;
    const lines = [...(m ? first.slice(1) : first), ...r.flatMap((c, i) => (i === dc ? [] : cellLines(c)))];
    // 부서 이름만 있는 칸은 일정이 아니라 그 줄 일정의 담당 부서
    const rowDept = lines.map((ln) => deptOf(ln) || (DB.depts.some((x) => x.name === ln.replace(/\s/g, '')) ? matchDept(ln) : '')).find(Boolean) || '';
    lines.filter((ln) => !deptOf(ln)).forEach((ln) => { const e = parseEventLine(ln); if (e) out.push({ date: cur, ...e, dept: e.dept || rowDept, manager: '' }); });
  });
  return out.length ? out : null;
}
/* ③ 달력형: 칸의 첫 줄이 날짜, 아래 줄(또는 아래 칸)이 일정 */
function planFromCalendar(grid, ym) {
  const head = (t) => DATE_HEAD.exec(cellLines(t)[0] || '');
  const found = [];
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
    const m = head(grid[r][c]); if (!m) continue;
    let lines = cellLines(grid[r][c]).slice(1);
    if (!lines.length) for (let rr = r + 1; rr < Math.min(grid.length, r + 8); rr++) { if (head(grid[rr][c])) break; lines.push(...cellLines(grid[rr][c])); }
    found.push({ r, m, lines });
  }
  const perRow = {}; found.forEach((f) => { perRow[f.r] = (perRow[f.r] || 0) + 1; });
  const weekdayHead = grid.some((row) => row.filter((c) => /^\s*[(\[]?[월화수목금토일][)\]]?(요일)?\s*$/.test(String(c))).length >= 3);
  if (!found.length || (!weekdayHead && !Object.values(perRow).some((n) => n >= 2))) return null;
  const noMo = found.filter((f) => !f.m[2]);
  let off = (noMo.length && +noMo[0].m[3] > 20 && noMo.some((f) => +f.m[3] <= 7)) ? -1 : 0; let prev = null;
  const out = [];
  found.forEach((f) => {
    let date;
    if (f.m[2]) date = headDate(f.m, ym);
    else { if (prev && +f.m[3] < +prev.m[3] - 15) off++; prev = f; const b = new Date(ym.y, ym.m - 1 + off, 1); date = mkYmd(b.getFullYear(), b.getMonth() + 1, +f.m[3]); }
    if (date) f.lines.forEach((ln) => { const e = parseEventLine(ln); if (e) out.push({ date, ...e, manager: '' }); });
  });
  return out.length ? out : null;
}
/* ④ 문단: 「9. 22.(월) 14:00 교직원 연수(강당)」처럼 날짜로 시작하는 줄 */
function planFromParas(paras, ym) {
  const out = [];
  const re = /^\s*(?:[-·•○◦▶]\s*)?(?:(20\d{2})\s*[.년]\s*)?(\d{1,2})\s*[./월]\s*(\d{1,2})\s*[.일]?\s*(?:[(\[]\s*[월화수목금토일]\s*[)\]])?\s*[:.\-]?\s+(.+)$/;
  paras.flatMap(cellLines).forEach((p) => {
    const m = re.exec(p); if (!m) return;
    const date = mkYmd(m[1] ? +m[1] : yearFor(+m[2], ym), +m[2], +m[3]); const e = parseEventLine(m[4]);
    if (date && e) out.push({ date, ...e, manager: '' });
  });
  return out.length ? out : null;
}
function parsePlanSource(src, ym) {
  const all = []; const kinds = new Set();
  src.grids.forEach((g) => {
    let r = planFromList(g.grid, g.raw, ym); if (r) { kinds.add('목록형 표'); all.push(...r); return; }
    r = planFromDateRows(g.grid, ym); if (r) { kinds.add('날짜별 행'); all.push(...r); return; }
    r = planFromCalendar(g.grid, ym); if (r) { kinds.add('달력형'); all.push(...r); }
  });
  const p = planFromParas(src.paras || [], ym); if (p) { kinds.add('문단'); all.push(...p); }
  const seen = new Set();
  const rows = all.filter((e) => { const k = e.date + '|' + e.start + '|' + e.title; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.date + (a.start || '99')).localeCompare(b.date + (b.start || '99')));
  return { rows, kinds: [...kinds] };
}

ACT.planImport = (d) => {
  const kinds = ['주중업무', '월중행사', '일반'];
  const m = openModal({
    title: '일정 불러오기 (한글·엑셀)', wide: true,
    body: `<div class="flow" style="margin-bottom:14px"><span class="on">① 파일 업로드</span>→<span id="st2">② 내용 확인</span>→<span id="st3">③ 일정 데이터 변환</span>→<span>④ 웹에서 수정</span>→<span>⑤ 일정에 반영</span></div>
      <label class="dropzone" id="planDrop">${icon('upload')}<div><b>주중·월중업무계획 파일 (한글 HWP·HWPX / 엑셀 XLSX·XLS·CSV)</b>을 끌어오거나 클릭하여 선택</div>
      <div style="font-size:12px;margin-top:4px;color:var(--text-3)">목록형 표(날짜 | 시간 | 업무 | 장소 | 담당) · 날짜별 행 · 달력형 · 「9.22(월) 14:00 연수(강당)」 같은 문장 모두 자동 인식</div><input type="file" accept=".xlsx,.xls,.csv,.hwp,.hwpx" hidden></label>
      <div id="planPreview"></div>`,
    foot: `<div class="left"><select class="input" id="impKind" style="width:auto">${kinds.map((k) => `<option ${k === d.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="impKeep" checked> 원본 파일 자료실에 보존</label></div>
      <button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="impGo" disabled>일정으로 반영</button>`,
  });
  let rows = []; let srcFile = null; let src = null; let ym = null; let kindsFound = [];
  const drop = $('#planDrop', m); const input = $('input', drop);
  const parse = () => {
    const res = parsePlanSource(src, ym); rows = res.rows; kindsFound = res.kinds;
    const exists = new Set(DB.events.map((e) => e.date + '|' + e.title));
    rows.forEach((r) => { r.dept = r.dept || ME.dept; r.dup = exists.has(r.date + '|' + r.title); r.ok = !r.dup; });
    if (!d.kind) $('#impKind', m).value = kindsFound.includes('달력형') ? '월중행사' : '주중업무';
  };
  const handle = async (file) => {
    if (!file) return;
    srcFile = file;
    $('#planPreview', m).innerHTML = '<div class="empty">파일을 읽는 중…</div>';
    try {
      src = await readMealSource(file);
      const det = detectYM(src.texts); const T = today();
      ym = { y: (det && det.y) || T.getFullYear(), m: (det && det.m) || T.getMonth() + 1 };
      if (det && !det.y) ym.y = yearFor(det.m, { y: T.getFullYear(), m: T.getMonth() + 1 });
      parse();
      $('#st2', m).className = 'on'; $('#st3', m).className = 'on';
      renderPreview();
    } catch (err) { $('#planPreview', m).innerHTML = `<div class="empty" style="color:var(--red)">${esc(err.message)}</div>`; }
  };
  function renderPreview() {
    const box = $('#planPreview', m);
    if (!rows.length) {
      box.innerHTML = `<div class="empty" style="color:var(--red);text-align:left;padding:16px 4px">일정을 찾지 못했습니다.<br><span style="font-size:13px;color:var(--text-2)">· 목록형: 첫 줄에 「날짜」「업무(내용·행사)」 제목이 있는 표<br>· 날짜별 행: 한 열에 날짜(예: 9.22(월))가 세로로, 옆 칸에 일정<br>· 달력형: 칸의 첫 줄에 날짜, 그 아래에 일정<br>· 문장: 「9. 22.(월) 14:00 교직원 연수(강당)」처럼 날짜로 시작하는 줄</span></div>`;
      $('#impGo', m).disabled = true; return;
    }
    const years = [ym.y - 1, ym.y, ym.y + 1];
    box.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0 8px">
        ${kindsFound.map((k) => `<span class="tag blue">${k}</span>`).join('')}<b>${esc(srcFile.name)}</b> — ${rows.length}건 인식
        <span style="margin-left:auto;font-size:13px;color:var(--text-2)">날짜에 연·월이 없을 때 기준</span>
        <select class="input" id="pvY" style="width:auto;padding:6px 10px">${years.map((y) => `<option ${y === ym.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <select class="input" id="pvM" style="width:auto;padding:6px 10px">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === ym.m ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select></div>
      <div class="table-wrap" style="max-height:46vh;overflow:auto"><table class="tbl"><thead><tr><th></th><th>날짜</th><th>시간</th><th>일정</th><th>장소</th><th>담당부서</th><th>상태</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><input type="checkbox" data-i="${i}" ${r.ok ? 'checked' : ''}></td>
        <td><input class="input" style="padding:4px 8px;font-size:13px;width:140px" type="date" data-i="${i}" data-f="date" value="${r.date || ''}"></td>
        <td class="num">${r.start}${r.end ? '~' + r.end : ''}</td>
        <td><input class="input" style="padding:4px 8px;font-size:13px;min-width:200px" data-i="${i}" data-f="title" value="${esc(r.title)}"></td>
        <td><input class="input" style="padding:4px 8px;font-size:13px;width:110px" data-i="${i}" data-f="place" value="${esc(r.place)}"></td>
        <td><select class="input" style="padding:4px 8px;font-size:13px" data-i="${i}" data-f="dept">${deptOptions(r.dept)}</select></td>
        <td>${r.dup ? '<span class="tag orange">이미 있음</span>' : '<span class="tag green">새로</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
    $$('input[type=checkbox]', box).forEach((c) => c.addEventListener('change', () => { rows[c.dataset.i].ok = c.checked; }));
    $$('[data-f]', box).forEach((c) => c.addEventListener('change', () => { rows[c.dataset.i][c.dataset.f] = c.value; }));
    [$('#pvY', box), $('#pvM', box)].forEach((s) => s.addEventListener('change', () => { ym = { y: +$('#pvY', box).value, m: +$('#pvM', box).value }; parse(); renderPreview(); }));
    $('#impGo', m).disabled = false;
  }
  input.addEventListener('change', () => handle(input.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); handle(e.dataTransfer.files[0]); });
  $('#impGo', m).addEventListener('click', async () => {
    const kind = $('#impKind', m).value;
    const sel = rows.filter((r) => r.ok && r.date && r.title);
    if (!sel.length) return toast('반영할 일정을 선택하세요.');
    $('#impGo', m).disabled = true;
    sel.forEach((r) => DB.events.push({
      id: uid('e'), date: r.date, start: r.start, end: r.end, title: r.title, place: r.place, dept: r.dept, manager: r.manager || '', kind, important: false,
      owner: ME.id, memo: '', createdAt: nowISO(), updatedAt: nowISO(), updatedBy: ME.id, fromFile: srcFile.name,
    }));
    const dates = sel.map((r) => r.date).sort();
    if ($('#impKeep', m).checked) {
      try { const doc = await createDoc(srcFile, { title: srcFile.name.replace(/\.[^.]+$/, ''), category: '업무계획', dept: ME.dept, note: `${kind} ${sel.length}건 일정 반영` }, true); doc.planRange = { from: dates[0], to: dates[dates.length - 1] }; }
      catch (e) { toast('원본 보존 실패: ' + e.message); }
    }
    const to = kind === '주중업무' ? `#weekly/${dates[0]}` : kind === '월중행사' ? `#monthly/${dates[0]}` : `#calendar/month/${dates[0]}`;
    log('import', 'plan', `${kind} ${sel.length}건`, srcFile.name);
    notify(`새로운 ${kind === '주중업무' ? '주중업무계획' : kind === '월중행사' ? '월중행사계획' : '일정'}이 등록되었습니다. (${sel.length}건)`, 'plan', to);
    saveDB(); closeModal(); toast(`${sel.length}건이 일정에 반영되었습니다.`);
    location.hash = to; rerender();
  });
};

/* ---------- 인쇄(A4 세로) · 엑셀 저장 ---------- */
function schoolYear(d) { return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1; }
function planInfo(type, from, to) {
  const f = parseYmd(from);
  if (type === 'week') {
    const ws = mondayOf(f);
    return { kind: '주중업무계획', title: `${schoolYear(ws)}학년도 ${ws.getMonth() + 1}월 ${weekOfMonth(ws)}주 주중업무계획`, period: `${fmtMD(ymd(ws))} ~ ${fmtMD(ymd(addDays(ws, 4)))}` };
  }
  return { kind: '월중행사계획', title: `${schoolYear(f)}학년도 ${f.getMonth() + 1}월 월중행사계획`, period: `${f.getFullYear()}. ${f.getMonth() + 1}. 1. ~ ${f.getMonth() + 1}. ${parseYmd(to).getDate()}.` };
}
function planOutputEvents(type, from, to, scope) {
  let list = eventsBetween(from, to);
  if (type === 'month' && scope !== 'all') list = list.filter((e) => e.kind === '월중행사' || e.important);
  return list;
}
function planDays(type, from, to, list, allDays) {
  const days = []; const has = new Set(list.map((e) => e.date));
  for (let d = parseYmd(from); ymd(d) <= to; d = addDays(d, 1)) {
    const ds = ymd(d); const wkend = d.getDay() === 0 || d.getDay() === 6;
    if (type === 'week' ? (!wkend || has.has(ds)) : (allDays || has.has(ds))) days.push(ds);
  }
  return days;
}
const evTime = (e) => (e.start ? e.start + (e.end ? '~' + e.end : '') : '');

function printHeader(info, opt) {
  const sign = opt.sign ? `<table class="pr-sign"><tr><th rowspan="2">결<br>재</th><th>담당</th><th>부장</th><th>교감</th><th>교장</th></tr><tr><td></td><td></td><td></td><td></td></tr></table>` : '';
  return `<div class="pr-head${opt.sign ? ' has-sign' : ''}"><div class="pr-title">${esc(info.title)}</div>${sign}</div>
    <div class="pr-sub"><span>기간: ${esc(info.period)}</span><span>${SCHOOL} · 작성 ${esc(dept(ME.dept).name)} ${esc(ME.name)} · ${fmtKo(today()).replace(/ .요일$/, '')}</span></div>`;
}
function printListHtml(type, from, to, list, opt) {
  const days = planDays(type, from, to, list, opt.allDays);
  const rows = days.map((ds) => {
    const d = parseYmd(ds); const evs = list.filter((e) => e.date === ds);
    const cls = d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
    const dateCells = (n) => `<td class="c ${cls}" rowspan="${n}">${d.getMonth() + 1}.${d.getDate()}</td><td class="c ${cls}" rowspan="${n}">${DOW[d.getDay()]}</td>`;
    if (!evs.length) return `<tr class="${cls}">${dateCells(1)}<td></td><td></td><td></td><td></td></tr>`;
    return evs.map((e, i) => `<tr class="${cls}">${i === 0 ? dateCells(evs.length) : ''}<td class="c">${esc(evTime(e))}</td><td>${e.important ? '★ ' : ''}${esc(e.title)}</td><td>${esc(e.place || '')}</td><td class="c">${esc(dept(e.dept).name)}</td></tr>`).join('');
  }).join('');
  return `${printHeader(planInfo(type, from, to), opt)}
    <table class="pr-table"><colgroup><col style="width:12mm"><col style="width:9mm"><col style="width:21mm"><col><col style="width:25mm"><col style="width:26mm"></colgroup>
    <thead><tr><th>날짜</th><th>요일</th><th>시간</th><th>${type === 'week' ? '업무 내용' : '행사 내용'}</th><th>장소</th><th>담당</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="c">등록된 일정이 없습니다.</td></tr>'}</tbody></table>`;
}
function printCalendarHtml(from, to, list, opt) {
  const first = parseYmd(from); const start = addDays(first, -first.getDay());
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const wk = []; for (let i = 0; i < 7; i++) wk.push(addDays(start, w * 7 + i));
    if (w > 0 && wk[0].getMonth() !== first.getMonth()) break;
    weeks.push(wk);
  }
  const h = Math.floor(225 / weeks.length);
  return `${printHeader(planInfo('month', from, to), opt)}
    <table class="pr-table pr-cal"><thead><tr>${DOW.map((d, i) => `<th class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</th>`).join('')}</tr></thead>
    <tbody>${weeks.map((wk) => `<tr>${wk.map((d) => {
      const ds = ymd(d); const other = d.getMonth() !== first.getMonth();
      const evs = other ? [] : list.filter((e) => e.date === ds);
      return `<td style="height:${h}mm" class="${other ? 'other' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}"><div class="pr-day">${d.getDate()}</div>${evs.map((e) => `<div class="pr-ev">${e.important ? '★' : '·'} ${e.start ? `<b>${esc(e.start)}</b> ` : ''}${esc(e.title)}</div>`).join('')}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
}
function doPrint(html) {
  let el = $('#printArea');
  if (!el) { el = document.createElement('div'); el.id = 'printArea'; document.body.appendChild(el); }
  el.innerHTML = html; el.style.zoom = '';
  // A4 한 장(인쇄 영역 약 188×272mm)을 조금 넘으면 자동으로 줄여서 한 장에 맞춤 (70%까지, 더 많으면 여러 쪽)
  el.style.cssText = 'display:block;position:absolute;left:-10000px;top:0;width:188mm';
  const mm = el.getBoundingClientRect().height * 25.4 / 96;
  window.__printMM = mm;
  el.style.cssText = '';
  if (mm > 268 && mm < 268 / 0.7) el.style.zoom = String(Math.floor((268 / mm) * 100) / 100);
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => { const el = $('#printArea'); if (el) el.innerHTML = ''; });

async function planExcel(type, from, to, list, opt) {
  await loadLib('XLSX');
  const info = planInfo(type, from, to);
  const head = ['날짜', '요일', '시간', type === 'week' ? '업무 내용' : '행사 내용', '장소', '담당부서', '담당자', '구분'];
  const aoa = [[info.title], [`기간: ${info.period}`, '', '', '', '', `작성: ${dept(ME.dept).name} ${ME.name} (${todayStr()})`], [], head];
  planDays(type, from, to, list, opt.allDays).forEach((ds) => {
    const d = parseYmd(ds); const evs = list.filter((e) => e.date === ds); const md = `${d.getMonth() + 1}.${d.getDate()}`;
    if (!evs.length) aoa.push([md, DOW[d.getDay()], '', '', '', '', '', '']);
    evs.forEach((e) => aoa.push([md, DOW[d.getDay()], evTime(e), (e.important ? '★ ' : '') + e.title, e.place || '', dept(e.dept).name, e.manager || user(e.owner).name, e.kind]));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } }];
  ws['!cols'] = [{ wch: 7 }, { wch: 5 }, { wch: 13 }, { wch: 38 }, { wch: 16 }, { wch: 13 }, { wch: 10 }, { wch: 9 }];
  ws['!rows'] = [{ hpt: 28 }];
  ws['!autofilter'] = { ref: `A4:H${aoa.length}` };
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, type === 'week' ? '주중업무계획' : '월중행사계획');
  if (type === 'month') {
    const first = parseYmd(from); const start = addDays(first, -first.getDay());
    const cal = [[info.title], [], DOW.slice()];
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, w * 7 + i);
        if (d.getMonth() !== first.getMonth()) { row.push(''); continue; }
        const evs = list.filter((e) => e.date === ymd(d));
        row.push([String(d.getDate()), ...evs.map((e) => `${e.start ? e.start + ' ' : ''}${e.title}`)].join('\n'));
      }
      if (w > 0 && row.every((x) => !x)) break;
      cal.push(row);
    }
    const cs = XLSX.utils.aoa_to_sheet(cal);
    cs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    cs['!cols'] = DOW.map(() => ({ wch: 20 }));
    cs['!rows'] = [{ hpt: 28 }, {}, {}, ...Array(6).fill({ hpt: 90 })];
    XLSX.utils.book_append_sheet(wb, cs, '달력');
  }
  XLSX.writeFile(wb, `${SCHOOL}_${info.title.replace(/\s+/g, '_')}.xlsx`);
  log('download', 'plan', info.title);
}

ACT.planOutput = (d) => {
  const type = d.type; const isMonth = type === 'month';
  const m = openModal({
    title: `${isMonth ? '월중행사계획' : '주중업무계획'} 인쇄 · 엑셀 저장`,
    body: `<form id="poForm">
      ${isMonth ? `<div class="row"><div class="field"><label>양식</label><select class="input" name="layout"><option value="list">목록형 (날짜별 표)</option><option value="cal">달력형 (한 달 달력)</option></select></div>
        <div class="field"><label>포함할 일정</label><select class="input" name="scope"><option value="screen">월중행사·중요 일정 (화면과 같음)</option><option value="all">모든 일정 (주중업무·회의 포함)</option></select></div></div>
        <label class="check" style="margin-bottom:8px"><input type="checkbox" name="allDays" checked> 일정이 없는 날짜도 표시 (목록형)</label>` : ''}
      <label class="check"><input type="checkbox" name="sign"> 결재란 표시 (담당 · 부장 · 교감 · 교장)</label>
      <p style="font-size:12.5px;color:var(--text-3);margin-top:14px;line-height:1.6">🖨 A4 세로로 맞춰 인쇄됩니다. 인쇄 창의 「대상」에서 <b>PDF로 저장</b>을 고르면 PDF 파일로도 저장할 수 있습니다.<br>📊 엑셀 파일에는 ${isMonth ? '목록 시트와 달력 시트가 함께' : '목록 시트가'} 들어갑니다.</p></form>`,
    foot: `<button class="btn secondary" id="poXls">${icon('download', 'width="16" height="16"')}엑셀로 저장</button><button class="btn" id="poPrint">🖨 A4 인쇄</button>`,
  });
  const opts = () => { const f = formData($('#poForm', m)); return { layout: f.layout || 'list', scope: f.scope || 'screen', allDays: isMonth ? !!f.allDays : false, sign: !!f.sign }; };
  $('#poPrint', m).addEventListener('click', () => {
    const o = opts(); const list = planOutputEvents(type, d.from, d.to, o.scope);
    const html = isMonth && o.layout === 'cal' ? printCalendarHtml(d.from, d.to, list, o) : printListHtml(type, d.from, d.to, list, o);
    closeModal(); log('print', 'plan', planInfo(type, d.from, d.to).title); saveDB(); doPrint(html);
  });
  $('#poXls', m).addEventListener('click', async () => {
    const o = opts();
    try { await planExcel(type, d.from, d.to, planOutputEvents(type, d.from, d.to, o.scope), o); closeModal(); toast('엑셀 파일을 저장했습니다.'); saveDB(); }
    catch (e) { toast(e.message); }
  });
};
ACT.planTemplate = async () => {
  try { await loadLib('XLSX'); } catch (e) { return toast(e.message); }
  const aoa = [['날짜', '시간', '업무', '장소', '담당', '담당자'], ['9.22', '09:00', '부장회의', '회의실', '교무', ''], ['9.23', '14:00', '교직원 연수', '강당', '연구', ''], ['9.24', '15:00', '교육과정협의회', '회의실', '교육운영', '']];
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '업무계획');
  XLSX.writeFile(wb, '업무계획_양식.xlsx');
};

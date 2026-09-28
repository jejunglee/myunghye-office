/* =========================================================
   급식 · 공지사항 · 통합검색 · 관리자 센터
   ========================================================= */

/* ---------------- 급식 ---------------- */
function allergyLegend(meals) {
  const nums = new Set();
  meals.forEach((ml) => ml && ml.items.forEach((s) => { const a = mealItem(s).a; if (a) a.split('.').forEach((x) => x && nums.add(+x)); }));
  return [...nums].sort((a, b) => a - b).map((n) => `<span class="tag" style="margin:0 4px 4px 0">${n}. ${ALLERGY[n - 1] || '?'}</span>`).join('');
}
VIEWS.meals = (v, args) => {
  const mode = ['today', 'week', 'month'].includes(args[0]) ? args[0] : 'today';
  const base = args[1] && /^\d{4}-\d{2}-\d{2}$/.test(args[1]) ? parseYmd(args[1]) : today();
  const ts = todayStr(); const mg = canManageMeals();
  let body = ''; let title = ''; let prev; let next;
  if (mode === 'today') {
    const ds = ymd(base); const meal = DB.meals[ds];
    prev = addDays(base, -1); next = addDays(base, 1);
    title = fmtKo(base) + (ds === ts ? ' · 오늘' : '');
    body = `<div class="grid c2"><div class="card" ${mg ? `data-act="editMeal" data-date="${ds}" style="cursor:pointer"` : ''}>
        <div class="card-head"><h3>🍚 중식</h3>${mg ? '<span class="more">수정</span>' : ''}</div>
        ${meal ? `<div style="font-size:19px">${mealMenuHTML(meal)}</div>` : `<div class="empty">${base.getDay() === 0 || base.getDay() === 6 ? '주말에는 급식이 없습니다.' : '등록된 식단이 없습니다.'}</div>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card"><div class="card-head"><h3>⚠️ 알레르기 정보</h3></div>${meal ? allergyLegend([meal]) || '<div class="li-sub">해당 없음</div>' : '<div class="li-sub">-</div>'}${meal && meal.allergyText ? `<p style="font-size:13px;margin-top:8px">${esc(meal.allergyText)}</p>` : ''}</div>
        <div class="card"><div class="card-head"><h3>🌾 원산지 정보</h3></div><p style="font-size:13.5px;line-height:1.7;color:var(--text-2)">${meal && meal.origin ? esc(meal.origin).replace(/ \/ /g, '<br>') : '-'}</p></div>
        ${meal && meal.note ? `<div class="card"><div class="card-head"><h3>📢 급식 공지</h3></div><p>${esc(meal.note)}</p></div>` : ''}
      </div></div>`;
  } else if (mode === 'week') {
    const ws = mondayOf(base); prev = addDays(ws, -7); next = addDays(ws, 7);
    title = `${ws.getMonth() + 1}월 ${weekOfMonth(ws)}주차`;
    const days = [0, 1, 2, 3, 4].map((i) => addDays(ws, i));
    body = `<div class="meal-grid">${days.map((d) => { const ds = ymd(d); return `<div class="meal-day ${ds === ts ? 'today' : ''}" data-act="${mg ? 'editMeal' : 'go'}" data-date="${ds}" data-to="#meals/today/${ds}"><h4><b>${d.getDate()}</b>${DOW[d.getDay()]}요일${ds === ts ? ' · 오늘' : ''}</h4>${mealMenuHTML(DB.meals[ds])}</div>`; }).join('')}</div>
      <div class="card" style="margin-top:20px"><div class="card-head"><h3>⚠️ 이번 주 알레르기 유발 식품</h3></div>${allergyLegend(days.map((d) => DB.meals[ymd(d)])) || '<div class="li-sub">없음</div>'}</div>`;
  } else {
    const first = new Date(base.getFullYear(), base.getMonth(), 1); prev = addMonths(first, -1); next = addMonths(first, 1);
    title = `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
    const start = addDays(first, -first.getDay()); const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i); const ds = ymd(d);
      if (i >= 35 && d.getMonth() !== first.getMonth()) break;
      const ml = DB.meals[ds];
      cells.push(`<div class="cell ${d.getMonth() !== first.getMonth() ? 'other' : ''} ${ds === ts ? 'today' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''}" data-act="go" data-to="#meals/today/${ds}"><div class="num">${d.getDate()}</div>
        ${ml ? ml.items.slice(0, 4).map((s) => `<div style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="meal-cell-item">${esc(mealItem(s).n)}</div>`).join('') : ''}</div>`);
    }
    body = `<div class="card" style="padding:12px"><div class="month-grid">${DOW.map((d, i) => `<div class="dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('')}${cells.join('')}</div></div>`;
  }
  const seg = [['today', '오늘'], ['week', '이번 주'], ['month', '이번 달']];
  v.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">급식 식단표</div><h1>급식</h1></div>
      <div class="actions">${mg ? `<button class="btn secondary" data-act="mealTemplate">${icon('table', 'width="16" height="16"')}양식</button><button class="btn secondary" data-act="mealImport">${icon('upload', 'width="16" height="16"')}식단표 불러오기 (한글·엑셀)</button><button class="btn" data-act="editMeal" data-date="${ymd(base)}">${icon('edit', 'width="16" height="16"')}식단 입력</button>` : ''}</div></div>
    <div class="cal-toolbar">
      <div class="segmented">${seg.map(([m, l]) => `<button class="${m === mode ? 'active' : ''}" data-act="go" data-to="#meals/${m}/${ts}">${l}</button>`).join('')}</div>
      <div class="cal-nav"><button class="icon-btn" data-act="go" data-to="#meals/${mode}/${ymd(prev)}">${icon('chevL')}</button><button class="icon-btn" data-act="go" data-to="#meals/${mode}/${ymd(next)}">${icon('chevR')}</button></div>
      <h2>${title}</h2></div>
    ${body}
    <p style="font-size:12px;color:var(--text-3);margin-top:14px">알레르기 번호: ${ALLERGY.map((a, i) => `${i + 1}.${a}`).join(' ')}</p>`;
};
ACT.editMeal = (d, el, e) => {
  if (e) e.stopPropagation();
  if (!canManageMeals()) return;
  const ml = DB.meals[d.date] || { items: [], kcal: '', origin: DB.meals[Object.keys(DB.meals).sort().pop()]?.origin || '', note: '' };
  const m = openModal({
    title: `식단 입력 · ${fmtMD(d.date)}`,
    body: `<form id="mlForm"><div class="field"><label>날짜</label><input class="input" type="date" name="date" value="${d.date}"></div>
      <div class="field"><label>식단 (한 줄에 한 메뉴, 알레르기 번호는 괄호 안에: 된장국(5.6))</label><textarea class="input" name="items" style="min-height:160px">${esc(ml.items.join('\n'))}</textarea></div>
      <div class="row"><div class="field"><label>열량 (kcal)</label><input class="input" name="kcal" value="${esc(ml.kcal)}"></div><div class="field"><label>급식 공지</label><input class="input" name="note" value="${esc(ml.note || '')}" placeholder="예: 현장체험학습 도시락"></div></div>
      <div class="field"><label>원산지 정보</label><textarea class="input" name="origin" style="min-height:60px">${esc(ml.origin || '')}</textarea></div></form>`,
    foot: `${DB.meals[d.date] ? `<div class="left"><button class="btn danger" id="mlDel">삭제</button></div>` : ''}<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="mlGo">저장</button>`,
  });
  $('#mlGo', m).addEventListener('click', () => {
    const f = formData($('#mlForm', m));
    const items = f.items.split(/\n/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return toast('메뉴를 입력하세요.');
    DB.meals[f.date] = { items, kcal: f.kcal, origin: f.origin, note: f.note, updatedBy: ME.id, updatedAt: nowISO() };
    log('update', 'meal', f.date); if (f.note) notify(`급식 공지 (${fmtMD(f.date)}): ${f.note}`, 'meal', '#meals/today/' + f.date);
    saveDB(); closeModal(); toast('식단이 저장되었습니다.'); rerender();
  });
  const del = $('#mlDel', m);
  if (del) del.addEventListener('click', () => { trashItem('meal', { title: '식단 ' + d.date, date: d.date, meal: DB.meals[d.date] }); delete DB.meals[d.date]; saveDB(); closeModal(); rerender(); });
};
ACT.mealTemplate = async () => {
  try { await loadLib('XLSX'); } catch (e) { return toast(e.message); }
  const ws = XLSX.utils.aoa_to_sheet([['날짜', '식단', '칼로리', '원산지', '비고'], ['10.1', '쌀밥\n된장국(5.6)\n제육볶음(5.6.10)\n시금치나물(5.6)\n배추김치(9)', '680', '쌀: 국내산 / 돼지고기: 국내산', ''], ['10.2', '잡곡밥, 미역국(5.6.16), 고등어구이(7), 계란말이(1), 깍두기(9)', '650', '', '']]);
  ws['!cols'] = [{ wch: 8 }, { wch: 50 }, { wch: 8 }, { wch: 30 }, { wch: 20 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '식단표'); XLSX.writeFile(wb, '급식_식단표_양식.xlsx');
};
/* ---------- 식단표 해석: 엑셀·한글(HWP/HWPX) · 목록형/달력형 자동 인식 ---------- */
const MEAL_SKIP = /^(조식|중식|석식|간식|점심|아침|저녁|메뉴|식단|급식|식단표|날짜|요일)$|원산지|알레르기|알러지|영양|단백질|탄수화물|지방|칼슘|철분|비타민|^[\d.,\s]+$|^[-–·*※~]+$/i;
const DATE_HEAD = /^\s*(?:[(\[]?[월화수목금토일][)\]]?\s+)?(?:(20\d{2})\s*[.\-/년]\s*)?(?:(\d{1,2})\s*[.\-/월]\s*)?(\d{1,2})\s*일?\s*(?:[(\[]\s*[월화수목금토일]\s*(?:요일)?\s*[)\]])?\s*(?:[월화수목금토일]요일)?\s*$/;

function normMealItem(s) {
  s = s.replace(/[★☆◆◇●○■□▶※*#♥♡]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  let m = /^(.*?)\s*\(\s*((?:\d{1,2}\s*[.,]\s*)*\d{1,2})\s*\.?\s*\)\s*$/.exec(s);   // 된장국(5.6.13)
  if (!m) m = /^(.*?[^\d\s.])\s*((?:\d{1,2}\.)+\d{0,2})\.?\s*$/.exec(s);             // 된장국 5.6.13.
  if (m && m[1].trim()) {
    const a = m[2].replace(/[\s,]/g, '.').split('.').filter((n) => n && +n >= 1 && +n <= 19);
    return a.length ? `${m[1].trim()}(${a.join('.')})` : m[1].trim();
  }
  return s;
}
function splitMealLines(text) {
  const out = { items: [], kcal: '' };
  String(text || '').replace(/\r/g, '').replace(/<br\s*\/?>/gi, '\n').split(/\n|,(?![^(]*\))|·/).forEach((ln) => {
    const t = ln.trim(); if (!t) return;
    const k = /([\d.]+)\s*k?cal/i.exec(t); if (k) { out.kcal = String(Math.round(parseFloat(k[1]))); return; }
    if (MEAL_SKIP.test(t)) return;
    const it = normMealItem(t); if (it && it.length <= 25) out.items.push(it);
  });
  return out;
}
function detectYM(strs) {
  for (const s of strs) { const m = /(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*월?/.exec(s || ''); if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], m: +m[2] }; }
  for (const s of strs) { const m = /(\d{1,2})\s*월/.exec(s || ''); if (m && +m[1] >= 1 && +m[1] <= 12) return { y: null, m: +m[1] }; }
  return null;
}
function mkYmd(y, mo, d) { const dt = new Date(y, mo - 1, d); return dt.getMonth() === ((mo - 1 + 12) % 12) && dt.getDate() === d ? ymd(dt) : null; }

/* 목록형: 머리글에 날짜 + 식단(메뉴) 열 */
function parseMealList(grid, raw, ym) {
  const h = grid.slice(0, 15).findIndex((r) => r.some((c) => /날짜|일자/.test(String(c))) && r.some((c) => /식단|메뉴|중식|음식/.test(String(c))));
  if (h < 0) return null;
  const head = grid[h].map((c) => String(c).replace(/\s/g, ''));
  const col = (re) => head.findIndex((c) => re.test(c));
  const C = { date: col(/날짜|일자/), menu: col(/식단|메뉴|중식|음식/), kcal: col(/칼로리|열량|kcal/i), origin: col(/원산지/), allergy: col(/알레르기|알러지/), note: col(/비고|공지/) };
  const rows = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i]; const rr = (raw && raw[i]) || [];
    let date = cellToDate(rr[C.date], r[C.date], ym.y);
    if (!date) { const m = DATE_HEAD.exec(String(r[C.date] || '').split('\n')[0]); if (m) date = mkYmd(+m[1] || ym.y, +m[2] || ym.m, +m[3]); }
    const parsed = splitMealLines(r[C.menu]);
    if (!date || !parsed.items.length) continue;
    rows.push({ date, items: parsed.items, kcal: (C.kcal >= 0 ? String(r[C.kcal]).replace(/[^\d.]/g, '') : '') || parsed.kcal, origin: C.origin >= 0 ? String(r[C.origin] || '') : '', allergyText: C.allergy >= 0 ? String(r[C.allergy] || '') : '', note: C.note >= 0 ? String(r[C.note] || '') : '' });
  }
  return rows.length ? rows : null;
}
/* 달력형: 칸의 첫 줄이 날짜, 아래 줄(또는 아래 칸)이 메뉴 */
function parseMealCalendar(grid, ym) {
  const found = [];
  const head = (t) => DATE_HEAD.exec(String(t || '').replace(/\r/g, '').split('\n')[0]);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const m = head(grid[r][c]); if (!m) continue;
      let menu = String(grid[r][c]).replace(/\r/g, '').split('\n').slice(1).join('\n');
      if (!splitMealLines(menu).items.length) {
        const parts = [];
        for (let rr = r + 1; rr < Math.min(grid.length, r + 12); rr++) { const t = grid[rr][c]; if (head(t)) break; if (t) parts.push(t); }
        menu = parts.join('\n');
      }
      const p = splitMealLines(menu);
      if (p.items.length) found.push({ r, y: m[1] ? +m[1] : null, mo: m[2] ? +m[2] : null, d: +m[3], ...p });
    }
  }
  if (!found.length) return null;
  // 식단 달력인지 확인: 한 줄에 날짜 칸이 2개 이상이거나 요일 머리글(월~금)이 있는 표만 인정
  const dateRows = {}; found.forEach((e) => { dateRows[e.r] = (dateRows[e.r] || 0) + 1; });
  const weekdayHead = grid.some((row) => row.filter((c) => /^\s*[(\[]?[월화수목금][)\]]?(요일)?\s*$/.test(String(c))).length >= 3);
  if (!weekdayHead && !Object.values(dateRows).some((n) => n >= 2)) return null;
  // 달력 앞뒤의 지난달·다음달 날짜 보정 (월이 적히지 않은 날짜만)
  const noMo = found.filter((e) => !e.mo);
  let off = (noMo.length && noMo[0].d > 20 && noMo.some((e) => e.d <= 7)) ? -1 : 0; let prev = null;
  return found.map((e) => {
    if (!e.mo) { if (prev && e.d < prev.d - 15) off++; prev = e; }
    const base = new Date(e.y || ym.y, (e.mo || ym.m) - 1 + (e.mo ? 0 : off), 1);
    const date = mkYmd(base.getFullYear(), base.getMonth() + 1, e.d);
    return date ? { date, items: e.items, kcal: e.kcal, origin: '', allergyText: '', note: '' } : null;
  }).filter(Boolean);
}
async function readMealSource(file) {
  const ext = extOf(file.name);
  if (ext === 'hwp' || ext === 'hwpx') {
    const d = ext === 'hwp' ? await parseHwpDoc(file) : await parseHwpxDoc(file);
    return { grids: d.tables.map((g) => ({ grid: g, raw: null })), texts: [file.name, ...d.paras, ...d.tables.flat(2)] };
  }
  await loadLib('XLSX');
  const wb = ext === 'csv' ? XLSX.read(await file.text(), { type: 'string', raw: true }) : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const grids = wb.SheetNames.map((n) => ({
    grid: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }).map((r) => r.map((x) => String(x).replace(/\r/g, ''))),
    raw: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }),
  }));
  return { grids, texts: [file.name, ...grids.flatMap((g) => g.grid.slice(0, 6).flat())] };
}
function parseMealSource(src, ym) {
  for (const g of src.grids) { const r = parseMealList(g.grid, g.raw, ym); if (r) return { kind: '목록형', rows: r }; }
  const all = new Map();
  for (const g of src.grids) (parseMealCalendar(g.grid, ym) || []).forEach((x) => { const e = all.get(x.date); if (!e || x.items.length > e.items.length) all.set(x.date, x); });
  if (all.size) return { kind: '달력형', rows: [...all.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  return null;
}

ACT.mealImport = () => {
  const m = openModal({
    title: '식단표 불러오기', wide: true,
    body: `<label class="dropzone" id="mlDrop">${icon('upload')}<div><b>식단표 파일 (한글 HWP·HWPX / 엑셀 XLSX·XLS·CSV)</b>을 끌어오거나 클릭하여 선택</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:4px">달력형(칸마다 날짜+메뉴)·목록형(날짜 | 식단 열) 모두 자동 인식 · 알레르기 번호·kcal 자동 정리</div><input type="file" accept=".xlsx,.xls,.csv,.hwp,.hwpx" hidden></label>
      <div id="mlPrev"></div>`,
    foot: `<div class="left"><label class="check"><input type="checkbox" id="mlKeep" checked> 원본 파일을 자료실(급식)에 보존</label></div>
      <button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="mlGo" disabled>날짜별 식단으로 반영</button>`,
  });
  let src = null; let file = null; let res = null; let ym = null;
  const T = today();
  const render = () => {
    res = parseMealSource(src, ym);
    const box = $('#mlPrev', m);
    if (!res) { box.innerHTML = `<div class="empty" style="color:var(--red);text-align:left;padding:16px 4px">식단을 찾지 못했습니다.<br><span style="font-size:13px;color:var(--text-2)">· 달력형: 칸의 첫 줄에 날짜(예: 1, 1(월), 10.1), 그 아래에 메뉴<br>· 목록형: 첫 줄에 「날짜」「식단」 제목이 있는 표<br>양식이 다르면 「양식」 버튼의 엑셀 양식을 사용해 주세요.</span></div>`; $('#mlGo', m).disabled = true; return; }
    const years = [T.getFullYear() - 1, T.getFullYear(), T.getFullYear() + 1];
    box.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0 10px">
        <span class="tag blue">${res.kind}</span><b>${res.rows.length}일치 식단 인식</b>
        ${res.kind === '달력형' ? `<span style="margin-left:auto;font-size:13px;color:var(--text-2)">식단 연·월</span>
          <select class="input" id="mlY" style="width:auto;padding:6px 10px">${years.map((y) => `<option ${y === ym.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select class="input" id="mlM" style="width:auto;padding:6px 10px">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === ym.m ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select>` : ''}
      </div>
      <div class="table-wrap" style="max-height:46vh;overflow:auto"><table class="tbl"><thead><tr><th></th><th>날짜</th><th>식단</th><th>kcal</th><th>상태</th></tr></thead><tbody>
      ${res.rows.map((r, i) => `<tr><td><input type="checkbox" data-i="${i}" checked></td><td class="num">${fmtMD(r.date)}</td><td>${r.items.map((x) => { const it = mealItem(x); return esc(it.n) + (it.a ? `<sup style="color:var(--text-3)">${esc(it.a)}</sup>` : ''); }).join(', ')}</td><td>${esc(r.kcal)}</td>
        <td>${DB.meals[r.date] ? '<span class="tag orange">덮어씀</span>' : '<span class="tag green">새로</span>'}</td></tr>`).join('')}</tbody></table></div>`;
    $$('input[data-i]', box).forEach((c) => c.addEventListener('change', () => { res.rows[c.dataset.i].off = !c.checked; }));
    const yS = $('#mlY', box); const mS = $('#mlM', box);
    if (yS) [yS, mS].forEach((s) => s.addEventListener('change', () => { ym = { y: +yS.value, m: +mS.value }; render(); }));
    $('#mlGo', m).disabled = !res.rows.length;
  };
  const handle = async (f) => {
    if (!f) return;
    file = f; $('#mlPrev', m).innerHTML = '<div class="empty">파일을 읽는 중…</div>';
    try {
      src = await readMealSource(f);
      const d = detectYM(src.texts);
      const def = T.getDate() > 20 ? addMonths(T, 1) : T;
      ym = { y: (d && d.y) || (d && d.m < def.getMonth() + 1 - 6 ? def.getFullYear() + 1 : def.getFullYear()), m: (d && d.m) || def.getMonth() + 1 };
      render();
    } catch (err) { $('#mlPrev', m).innerHTML = `<div class="empty" style="color:var(--red)">${esc(err.message)}</div>`; }
  };
  const drop = $('#mlDrop', m); const input = $('input', drop);
  input.addEventListener('change', () => handle(input.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); handle(e.dataTransfer.files[0]); });
  $('#mlGo', m).addEventListener('click', async () => {
    const rows = res.rows.filter((r) => !r.off);
    if (!rows.length) return toast('반영할 날짜를 선택하세요.');
    $('#mlGo', m).disabled = true;
    const lastOrigin = DB.meals[Object.keys(DB.meals).sort().pop()]?.origin || '';
    rows.forEach((r) => { DB.meals[r.date] = { items: r.items, kcal: r.kcal, origin: r.origin || (DB.meals[r.date] && DB.meals[r.date].origin) || lastOrigin, allergyText: r.allergyText, note: r.note, updatedBy: ME.id, updatedAt: nowISO() }; });
    if ($('#mlKeep', m).checked) { try { await createDoc(file, { title: file.name.replace(/\.[^.]+$/, ''), category: '급식', dept: ME.dept, note: `식단 ${rows.length}일 반영` }, true); } catch (e) { toast('원본 보존 실패: ' + e.message); } }
    log('import', 'meal', `식단 ${rows.length}일`, file.name);
    notify(`새 급식 식단표가 등록되었습니다. (${fmtMD(rows[0].date)}~${fmtMD(rows[rows.length - 1].date)}, ${rows.length}일)`, 'meal', '#meals/month/' + rows[0].date);
    saveDB(); closeModal(); toast(`${rows.length}일치 식단이 반영되었습니다.`); location.hash = '#meals/month/' + rows[0].date;
  });
};

/* ---------------- 공지사항 ---------------- */
VIEWS.notices = (v, args) => {
  const list = visibleNotices();
  v.innerHTML = `<div class="page-head"><div><div class="eyebrow">학교 소식</div><h1>공지사항</h1></div>
      <div class="actions">${ME.level >= 2 ? `<button class="btn" data-act="newNotice">${icon('plus', 'width="16" height="16"')}공지 작성</button>` : ''}</div></div>
    <div class="card"><div class="list">${list.map((n) => `<div class="li" data-act="openNotice" data-id="${n.id}">
      <div class="li-main"><div class="li-title">${n.pinned ? '📌 ' : ''}${esc(n.title)}</div><div class="li-sub">${esc(user(n.createdBy).name)} · ${esc(dept(n.dept).name)} · ${fmtDT(n.createdAt)} · 확인 ${n.readBy.length}명</div></div>
      ${n.important ? '<span class="tag red">중요</span>' : ''}${n.readBy.includes(ME.id) || n.createdBy === ME.id ? '' : '<span class="new-dot"></span>'}</div>`).join('') || '<div class="empty">공지가 없습니다.</div>'}</div></div>`;
  if (args[0] && !topModal()) ACT.openNotice({ id: args[0] });
};
ACT.openNotice = (d) => {
  const n = DB.notices.find((x) => x.id === d.id);
  if (!n) return toast('공지를 찾을 수 없습니다.');
  if (!n.readBy.includes(ME.id)) { n.readBy.push(ME.id); saveDB(); }
  const ed = canEdit(n);
  openModal({
    title: esc(n.title),
    onClose: () => { if (CUR.view === 'notices' && CUR.args[0]) history.replaceState(null, '', '#notices'); if (['notices', 'home'].includes(CUR.view)) rerender(); },
    body: `<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${n.pinned ? '<span class="tag blue">📌 고정</span>' : ''}${n.important ? '<span class="tag red">중요</span>' : ''}${deptTag(n.dept)}<span style="font-size:12px;color:var(--text-3);margin-left:auto">${esc(user(n.createdBy).name)} · ${fmtFull(n.createdAt)}</span></div>
      <div style="white-space:pre-wrap;font-size:15.5px;line-height:1.8">${esc(n.body)}</div>
      <p style="font-size:12px;color:var(--text-3);margin-top:18px">확인한 교직원 ${n.readBy.length}명</p>`,
    foot: `${ed ? `<div class="left"><button class="btn danger" data-act="deleteNotice" data-id="${n.id}">삭제</button></div>` : ''}${isAdmin() ? `<button class="btn secondary" data-act="pinNotice" data-id="${n.id}">${icon('pin', 'width="16" height="16"')}${n.pinned ? '고정 해제' : '상단 고정'}</button>` : ''}${ed ? `<button class="btn" data-act="editNotice" data-id="${n.id}">수정</button>` : ''}`,
  });
};
ACT.pinNotice = (d) => { const n = DB.notices.find((x) => x.id === d.id); n.pinned = !n.pinned; log('update', 'notice', n.title, n.pinned ? '고정' : '고정 해제'); saveDB(); closeModal(); toast(n.pinned ? '상단에 고정했습니다.' : '고정을 해제했습니다.'); };
ACT.deleteNotice = async (d) => {
  const n = DB.notices.find((x) => x.id === d.id);
  if (!(await confirmBox(`「${esc(n.title)}」 공지를 삭제할까요?`, '삭제', true))) return;
  DB.notices = DB.notices.filter((x) => x.id !== n.id); trashItem('notice', n); saveDB(); closeAllModals(); rerender();
};
ACT.newNotice = () => noticeForm(null);
ACT.editNotice = (d) => { closeModal(); noticeForm(DB.notices.find((x) => x.id === d.id)); };
function noticeForm(n) {
  const isNew = !n; const n0 = n || { title: '', body: '', dept: ME.dept, important: false, pinned: false };
  const m = openModal({
    title: isNew ? '공지 작성' : '공지 수정',
    body: `<form id="noForm"><div class="field"><label>제목</label><input class="input" name="title" value="${esc(n0.title)}"></div>
      <div class="field"><label>부서</label><select class="input" name="dept">${deptOptions(n0.dept)}</select></div>
      <div class="field"><label>내용</label><textarea class="input" name="body" style="min-height:200px">${esc(n0.body)}</textarea></div>
      <label class="check" style="margin-bottom:8px"><input type="checkbox" name="important" ${n0.important ? 'checked' : ''}> 중요 공지 (전 교직원 알림)</label>
      ${isAdmin() ? `<label class="check"><input type="checkbox" name="pinned" ${n0.pinned ? 'checked' : ''}> 📌 상단 고정</label>` : ''}</form>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="noGo">등록</button>`,
  });
  $('#noGo', m).addEventListener('click', () => {
    const f = formData($('#noForm', m));
    if (!f.title) return toast('제목을 입력하세요.');
    if (isNew) {
      const nn = { id: uid('no'), title: f.title, body: f.body, dept: f.dept, important: f.important, pinned: !!f.pinned, createdBy: ME.id, createdAt: nowISO(), readBy: [ME.id] };
      DB.notices.unshift(nn); log('create', 'notice', nn.title);
      notify(`${nn.important ? '중요 공지가 등록되었습니다' : '새 공지'}: ${nn.title}`, 'notice', '#notices/' + nn.id);
    } else { Object.assign(n, { title: f.title, body: f.body, dept: f.dept, important: f.important, pinned: isAdmin() ? !!f.pinned : n.pinned }); log('update', 'notice', n.title); }
    saveDB(); closeModal(); toast('저장되었습니다.'); rerender(); updateBell();
  });
}

/* ---------------- 통합검색 ---------------- */
const searchOpt = { from: '', to: '', dept: '', author: '', ftype: '', types: new Set(['event', 'meeting', 'notice', 'doc']) };
function hl(text, toks) {
  let s = esc(text);
  toks.forEach((t) => { if (t) s = s.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (x) => `<mark>${x}</mark>`); });
  return s;
}
function snippet(text, toks) {
  if (!text) return '';
  const low = text.toLowerCase(); let i = -1;
  for (const t of toks) { i = low.indexOf(t.toLowerCase()); if (i >= 0) break; }
  if (i < 0) return '';
  const s = Math.max(0, i - 40); return (s > 0 ? '…' : '') + text.slice(s, i + 80).replace(/\s+/g, ' ') + '…';
}
VIEWS.search = (v, args) => {
  const q = (args.join('/') || '').trim();
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  const o = searchOpt;
  const match = (hay) => toks.length && toks.every((t) => hay.toLowerCase().includes(t));
  const inRange = (d) => (!o.from || d >= o.from) && (!o.to || d <= o.to);
  const deptOk = (d) => !o.dept || d === o.dept;
  const authorOk = (u) => !o.author || u === o.author;
  const R = { event: [], meeting: [], notice: [], doc: [] };
  if (toks.length) {
    if (o.types.has('event')) R.event = DB.events.filter((e) => match([e.title, e.place, e.memo, e.manager, e.kind, dept(e.dept).name].join(' ')) && inRange(e.date) && deptOk(e.dept) && authorOk(e.owner)).sort((a, b) => b.date.localeCompare(a.date));
    if (o.types.has('meeting')) R.meeting = DB.meetings.filter((m) => canSeeSensitive(m) && match([m.title, m.type, m.agenda, m.result, m.attendees, m.place].join(' ')) && inRange(m.date) && deptOk(m.dept) && authorOk(m.createdBy)).sort((a, b) => b.date.localeCompare(a.date));
    if (o.types.has('notice')) R.notice = DB.notices.filter((n) => match(n.title + ' ' + n.body) && inRange(n.createdAt.slice(0, 10)) && deptOk(n.dept) && authorOk(n.createdBy));
    if (o.types.has('doc')) R.doc = visibleDocs().filter((d) => { const cv = d.versions[d.cur - 1]; return match([d.title, d.tags, d.category, cv.name, cv.text].join(' ')) && inRange(d.updatedAt.slice(0, 10)) && deptOk(d.dept) && authorOk(d.createdBy) && (!o.ftype || TYPE_GROUPS[o.ftype].includes(cv.ext)); });
  }
  const total = R.event.length + R.meeting.length + R.notice.length + R.doc.length;
  const planEvs = R.event.filter((e) => e.kind === '주중업무'); const monthEvs = R.event.filter((e) => e.kind === '월중행사'); const etcEvs = R.event.filter((e) => e.kind !== '주중업무' && e.kind !== '월중행사');
  const evGroup = (label, list) => list.length ? `<div class="search-group"><h3>${label} (${list.length})</h3><div class="card"><div class="list">${list.slice(0, 30).map((e) => `<div class="li" data-act="openEvent" data-id="${e.id}"><div class="li-bar" style="background:${evColor(e)}"></div><div class="li-time">${fmtMD(e.date).replace(/\(.\)/, '')}</div><div class="li-main"><div class="li-title">${hl(e.title, toks)}</div><div class="li-sub">${e.start || '종일'} · ${hl(e.place || '', toks)} · ${esc(dept(e.dept).name)}</div></div></div>`).join('')}</div></div></div>` : '';

  v.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">온라인 교무실 전체</div><h1>통합검색</h1></div></div>
    <form id="sForm" class="search-box" style="max-width:none;height:48px;border-radius:14px;margin-bottom:14px;background:var(--card);box-shadow:var(--shadow)">${icon('search')}<input id="sQ" value="${esc(q)}" placeholder="예: 고교학점제, 부장회의, 연수" style="font-size:17px" autofocus><button class="btn sm">검색</button></form>
    <div class="filters">
      <input class="input" type="date" id="sFrom" value="${o.from}" title="시작일"><span style="align-self:center;color:var(--text-3)">~</span><input class="input" type="date" id="sTo" value="${o.to}" title="종료일">
      <select class="input" id="sDept">${deptOptions(o.dept, true)}</select>
      <select class="input" id="sAuthor"><option value="">전체 작성자</option>${DB.users.filter((u) => u.status === 'active').map((u) => `<option value="${u.id}" ${o.author === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
      <select class="input" id="sFtype"><option value="">전체 파일형식</option>${Object.keys(TYPE_GROUPS).map((k) => `<option ${o.ftype === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
    </div>
    <div class="filters">${[['event', '일정·업무계획'], ['meeting', '회의'], ['notice', '공지'], ['doc', '자료·첨부파일']].map(([k, l]) => `<button class="chip ${o.types.has(k) ? 'active' : ''}" data-act="sType" data-k="${k}">${l}</button>`).join('')}
      ${o.from || o.to || o.dept || o.author || o.ftype ? '<button class="btn ghost sm" data-act="sReset">조건 초기화</button>' : ''}</div>
    ${!toks.length ? `<div class="card"><div class="empty" style="padding:40px">검색어를 입력하세요.<br><span style="font-size:13px">회의자료 · 주중업무계획 · 월중행사 · 공지사항 · 첨부파일 내용까지 한 번에 찾습니다.</span>
      <div style="margin-top:16px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">${['고교학점제', '부장회의', '연수', '개별화교육'].map((k) => `<button class="chip" data-act="go" data-to="#search/${k}">${k}</button>`).join('')}</div></div></div>`
    : `<p style="margin-bottom:16px;color:var(--text-2)">「<b style="color:var(--text)">${esc(q)}</b>」 검색 결과 ${total}건</p>
      ${R.meeting.length ? `<div class="search-group"><h3>회의자료 (${R.meeting.length})</h3><div class="card"><div class="list">${R.meeting.map((m) => `<div class="li" data-act="openMeeting" data-id="${m.id}"><div class="li-bar" style="background:${dept(m.dept).color}"></div><div class="li-time">${fmtMD(m.date).replace(/\(.\)/, '')}</div><div class="li-main"><div class="li-title">${hl(m.title, toks)}</div><div class="li-sub">${hl(snippet(m.agenda + ' ' + m.result, toks) || m.place, toks)}</div></div><span class="tag purple">${esc(m.type)}</span></div>`).join('')}</div></div></div>` : ''}
      ${evGroup('주중업무계획', planEvs)}${evGroup('월중행사', monthEvs)}${evGroup('기타 일정', etcEvs)}
      ${R.notice.length ? `<div class="search-group"><h3>공지사항 (${R.notice.length})</h3><div class="card"><div class="list">${R.notice.map((n) => `<div class="li" data-act="openNotice" data-id="${n.id}"><div class="li-main"><div class="li-title">${hl(n.title, toks)}</div><div class="li-sub">${hl(snippet(n.body, toks), toks)}</div></div></div>`).join('')}</div></div></div>` : ''}
      ${R.doc.length ? `<div class="search-group"><h3>자료·첨부파일 (${R.doc.length})</h3><div class="card"><div class="list">${R.doc.map((d) => { const cv = d.versions[d.cur - 1]; return `<div class="li" data-act="openDoc" data-id="${d.id}">${fileIcon(cv.ext)}<div class="li-main"><div class="li-title">${hl(d.title, toks)}</div><div class="li-sub">${hl(snippet(cv.text, toks) || `${d.category} · ${cv.name}`, toks)}</div></div><span class="tag">${esc(d.category)}</span></div>`; }).join('')}</div></div></div>` : ''}
      ${!total ? '<div class="card"><div class="empty">검색 결과가 없습니다. 검색 조건을 바꿔 보세요.</div></div>' : ''}`}`;
  const go = () => { const nq = $('#sQ').value.trim(); location.hash = '#search/' + encodeURIComponent(nq); if (nq === q) rerender(); };
  $('#sForm').addEventListener('submit', (e) => { e.preventDefault(); go(); });
  [['sFrom', 'from'], ['sTo', 'to'], ['sDept', 'dept'], ['sAuthor', 'author'], ['sFtype', 'ftype']].forEach(([id, k]) => $('#' + id).addEventListener('change', (e) => { o[k] = e.target.value; rerender(); }));
  const gs = $('#globalSearch'); if (gs) gs.value = q;
};
ACT.sType = (d) => { const s = searchOpt.types; if (s.has(d.k)) { if (s.size > 1) s.delete(d.k); } else s.add(d.k); rerender(); };
ACT.sReset = () => { Object.assign(searchOpt, { from: '', to: '', dept: '', author: '', ftype: '' }); rerender(); };

/* ---------------- 관리자 센터 ---------------- */
const ADMIN_TABS = [['dash', '대시보드'], ['users', '교직원 관리'], ['depts', '부서 관리'], ['perm', '권한 관리'], ['history', '수정 이력'], ['logs', '접속·활동 로그'], ['trash', '휴지통'], ['backup', '백업 관리'], ['settings', '설정']];
VIEWS.admin = (v, args) => {
  if (!isAdmin()) { v.innerHTML = '<div class="card"><div class="empty">관리자만 접근할 수 있습니다.</div></div>'; return; }
  const tab = ADMIN_TABS.some(([k]) => k === args[0]) ? args[0] : 'dash';
  v.innerHTML = `<div class="page-head"><div><div class="eyebrow">시스템 관리</div><h1>관리자 센터</h1></div></div>
    <div class="tabs">${ADMIN_TABS.map(([k, l]) => `<button class="${k === tab ? 'active' : ''}" data-act="go" data-to="#admin/${k}">${l}${k === 'users' && DB.users.some((u) => u.status === 'pending') ? ` <span class="badge-dot" style="position:static;display:inline-flex">${DB.users.filter((u) => u.status === 'pending').length}</span>` : ''}</button>`).join('')}</div>
    <div id="adminBody"></div>`;
  ADMIN[tab]($('#adminBody'));
};
const ACT_LABEL = { login: '로그인', logout: '로그아웃', view: '열람', download: '다운로드', create: '등록', update: '수정', delete: '삭제', restore: '복구', import: '불러오기', register: '가입 신청', approve: '승인', unlock: '잠금 해제', 'admin-auth': '관리자 인증', 'admin-auth-fail': '관리자 인증 실패', backup: '백업', settings: '설정 변경', print: '인쇄' };
const TYPE_LABEL = { doc: '자료', event: '일정', meeting: '회의', notice: '공지', meal: '급식', plan: '업무계획', user: '교직원', session: '세션', dept: '부서', system: '시스템' };
function logLine(l) { return `<div class="log-line"><time>${fmtFull(l.t).slice(5)}</time><div style="flex:1;min-width:0"><b>${esc(user(l.uid).name)}</b> · ${ACT_LABEL[l.act] || esc(l.act)} <span class="tag">${TYPE_LABEL[l.type] || esc(l.type)}</span> ${esc(l.title)} ${l.extra ? `<span style="color:var(--text-3)">(${esc(l.extra)})</span>` : ''}</div></div>`; }
const ADMIN = {};
ADMIN.dash = async (el) => {
  const pending = DB.users.filter((u) => u.status === 'pending');
  const stats = [['활성 교직원', DB.users.filter((u) => u.status === 'active').length], ['승인 대기', pending.length], ['자료', DB.docs.length], ['일정', DB.events.length], ['회의', DB.meetings.length], ['공지', DB.notices.length], ['급식 등록일', Object.keys(DB.meals).length], ['휴지통', DB.trash.length]];
  el.innerHTML = `<div class="grid c4 keep2" style="margin-bottom:20px">${stats.map(([l, n]) => `<div class="card stat-card"><div class="v">${n}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="grid c2"><div class="card"><div class="card-head"><h3>관리 메뉴</h3></div><div class="more-grid">
      ${[['#admin/users', '교직원 관리', 'users'], ['#admin/depts', '부서 관리', 'grid'], ['#admin/perm', '권한 관리', 'lock'], ['#calendar', '일정 관리', 'calendar'], ['#meetings', '회의 관리', 'users'], ['#docs', '문서 관리', 'folder'], ['#meals', '급식 관리', 'meal'], ['#notices', '공지 관리', 'megaphone'], ['#admin/history', '수정 이력', 'history'], ['#admin/logs', '접속·활동 로그', 'clock'], ['#admin/backup', '백업 관리', 'download'], ['#admin/settings', '설정', 'shield']].map(([to, l, ic]) => `<button data-act="go" data-to="${to}">${icon(ic)}${l}</button>`).join('')}</div></div>
    <div class="card"><div class="card-head"><h3>최근 활동</h3><a class="more" href="#admin/logs">전체</a></div>${DB.logs.slice(0, 10).map(logLine).join('')}</div></div>`;
};
ADMIN.users = (el) => {
  const pending = DB.users.filter((u) => u.status === 'pending');
  const others = DB.users.filter((u) => u.status !== 'pending');
  const site = location.href.split('#')[0];
  el.innerHTML = `<div class="card" style="margin-bottom:20px;${pending.length ? 'box-shadow:0 0 0 2px var(--orange),var(--shadow)' : ''}"><div class="card-head"><h3>🆕 가입 신청 ${pending.length ? `(${pending.length})` : ''}</h3></div>
      <p style="font-size:13.5px;color:var(--text-2);margin-bottom:10px">선생님이 가입을 신청하면 여기에 나타납니다. 본인이 맞는지 확인한 뒤 「승인」하면 바로 로그인할 수 있습니다.</p>
      <div class="list">${pending.map((u) => `<div class="li" style="cursor:default;flex-wrap:wrap">${avatar(u)}<div class="li-main"><div class="li-title">${esc(u.name)} <span style="font-weight:400;color:var(--text-3)">(${esc(u.username)})</span></div><div class="li-sub">${esc(dept(u.dept).name)} · ${relTime(u.requestedAt)} 신청</div></div>
        <button class="btn sm" data-act="approveUser" data-id="${u.id}">승인</button><button class="btn danger sm" data-act="rejectUser" data-id="${u.id}">거절</button></div>`).join('') || '<div class="empty">대기 중인 가입 신청이 없습니다.</div>'}</div></div>
    <div class="card"><div class="card-head"><h3>교직원 (${others.length})</h3><button class="btn sm" data-act="copyJoin">${icon('users', 'width="14" height="14"')}가입 안내 복사</button></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>이름</th><th>아이디</th><th>직위</th><th>부서</th><th>권한</th><th>급식 담당</th><th>상태</th><th>최근 접속</th><th></th></tr></thead><tbody>
    ${others.map((u) => `<tr><td><div style="display:flex;align-items:center;gap:8px">${avatar(u, 28)}<b style="white-space:nowrap">${esc(u.name)}</b>${isOwner(u) ? ' <span class="tag blue">대표 관리자</span>' : ''}</div></td>
      <td class="num" style="font-size:13px">${esc(u.username)}</td>
      <td><input class="input" style="padding:4px 8px;font-size:13px;width:120px" data-uid="${u.id}" data-f="title" value="${esc(u.title || '')}" placeholder="예: 교사"></td>
      <td><select class="input" style="padding:4px 8px;font-size:13px;min-width:150px" data-uid="${u.id}" data-f="dept">${deptOptions(u.dept)}</select></td>
      <td><select class="input" style="padding:4px 8px;font-size:13px;min-width:150px" data-uid="${u.id}" data-f="level" ${u.id === ME.id || isOwner(u) ? 'disabled title="대표 관리자는 항상 최고관리자입니다"' : ''}>${[1, 2, 3].map((l) => `<option value="${l}" ${u.level === l ? 'selected' : ''}>Level ${l} ${LEVEL_NAME[l]}</option>`).join('')}</select></td>
      <td style="text-align:center"><input type="checkbox" data-meal="${u.id}" ${u.mealManager ? 'checked' : ''} ${u.level >= 3 ? 'checked disabled title="관리자는 항상 가능"' : ''} style="width:18px;height:18px;accent-color:var(--accent)"></td>
      <td>${u.status === 'active' ? '<span class="tag green">활성</span>' : '<span class="tag">비활성</span>'}</td><td style="font-size:12px;color:var(--text-3)">${u.lastLogin ? relTime(u.lastLogin) : '-'}</td>
      <td style="white-space:nowrap">${u.id === ME.id || isOwner(u) ? '' : `<button class="btn ${u.status === 'active' ? 'danger' : 'secondary'} sm" data-act="toggleUser" data-id="${u.id}">${u.status === 'active' ? '비활성화' : '활성화'}</button><button class="btn ghost sm" data-act="resetPw" data-id="${u.id}">비밀번호 초기화</button>`}</td></tr>`).join('')}
    </tbody></table></div><p style="font-size:12px;color:var(--text-3);margin-top:10px">전근·퇴직 시 「비활성화」하면 즉시 로그인이 차단됩니다. 비밀번호를 잊은 선생님은 「비밀번호 초기화」로 임시 비밀번호를 정해 알려 주세요.</p></div>
    <div class="card" style="margin-top:20px"><div class="card-head"><h3>📨 선생님들께 보낼 가입 안내</h3></div>
      <pre id="joinText" style="white-space:pre-wrap;font-family:inherit;font-size:14px;background:var(--card-2);padding:14px;border-radius:12px;line-height:1.7">${esc(joinText(site))}</pre></div>`;
  $$('input[data-meal]', el).forEach((c) => c.addEventListener('change', () => {
    const u = user(c.dataset.meal); u.mealManager = c.checked; log('update', 'user', u.name, c.checked ? '급식 담당 지정' : '급식 담당 해제'); saveDB(); toast('변경되었습니다.');
  }));
  $$('select[data-uid], input[data-uid]', el).forEach((s) => s.addEventListener('change', () => {
    const u = user(s.dataset.uid); u[s.dataset.f] = s.dataset.f === 'level' ? +s.value : s.value.trim();
    log('update', 'user', u.name, s.dataset.f === 'level' ? `권한 Level ${u.level}` : s.dataset.f === 'title' ? `직위 ${u.title}` : `부서 ${dept(u.dept).name}`); saveDB(); toast('변경되었습니다.');
    if (u.id === ME.id) { renderShell(); route(); }
  }));
};
function joinText(site) {
  return `[${SCHOOL} 온라인 교무실 가입 안내]\n\n1. 접속 주소: ${site}\n   (PC·휴대폰 모두 가능, 휴대폰은 홈 화면에 추가해 두면 편리합니다)\n2. 「처음 오셨나요? 가입 신청하기」를 누르고 이름·부서·아이디·비밀번호를 입력합니다.\n3. 관리자 승인 후 아이디와 비밀번호로 로그인합니다.\n\n※ 학생 개인정보(개별화교육계획, 상담기록 등)가 담긴 자료는 올리지 마세요.`;
}
ACT.copyJoin = async () => { const t = joinText(location.href.split('#')[0]); try { await navigator.clipboard.writeText(t); toast('가입 안내를 복사했습니다. 메신저에 붙여넣어 보내세요.'); } catch (e) { toast('아래 안내문을 직접 복사해 주세요.'); } };
ACT.approveUser = (d) => { const u = user(d.id); u.status = 'active'; u.approvedAt = nowISO(); log('approve', 'user', u.name); saveDB(); toast(`${u.name} 선생님을 승인했습니다. 이제 로그인할 수 있습니다.`); rerender(); updateBell(); };
ACT.rejectUser = async (d) => {
  const u = user(d.id);
  if (!(await confirmBox(`${esc(u.name)} 선생님(${esc(u.username)})의 가입 신청을 거절할까요? 계정이 삭제됩니다.`, '거절', true))) return;
  try { await Remote.rpc('admin_delete_user', { target: u.id }); } catch (e) { return toast(korErr(e)); }
  DB.users = DB.users.filter((x) => x.id !== u.id); PSNAP.delete(u.id); log('delete', 'user', u.name, '가입 거절'); saveDB(); rerender(); updateBell();
};
ACT.toggleUser = async (d) => {
  const u = user(d.id);
  if (isOwner(u)) return toast('대표 관리자 계정은 비활성화할 수 없습니다.');
  const off = u.status === 'active';
  if (off && !(await confirmBox(`${esc(u.name)} 선생님 계정을 비활성화할까요? 즉시 로그인이 차단됩니다.`, '비활성화', true))) return;
  u.status = off ? 'inactive' : 'active'; log('update', 'user', u.name, off ? '비활성화' : '활성화'); saveDB(); rerender();
};
ACT.resetPw = (d) => {
  const u = user(d.id);
  const tmp = 'mh' + Math.floor(100000 + Math.random() * 900000);
  const m = openModal({
    title: `비밀번호 초기화 · ${esc(u.name)}`,
    body: `<p style="font-size:14px;color:var(--text-2);margin-bottom:12px">임시 비밀번호를 정해 선생님께 알려 주세요. 로그인 후 왼쪽 아래 이름을 눌러 직접 바꿀 수 있습니다.</p>
      <div class="field"><label>임시 비밀번호 (6자 이상)</label><input class="input" id="rpPw" value="${tmp}"></div>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="rpGo">초기화</button>`,
  });
  $('#rpGo', m).addEventListener('click', async () => {
    const pw = $('#rpPw', m).value.trim();
    if (pw.length < 6) return toast('6자 이상 입력하세요.');
    try { await Remote.rpc('admin_set_password', { target: u.id, new_password: pw }); } catch (e) { return toast(korErr(e)); }
    log('update', 'user', u.name, '비밀번호 초기화'); saveDB(); closeModal(); toast(`${u.name} 선생님 비밀번호를 「${pw}」(으)로 초기화했습니다.`);
  });
};
ADMIN.depts = (el) => {
  el.innerHTML = `<div class="card"><div class="card-head"><h3>부서 (${DB.depts.length})</h3><button class="btn sm" data-act="addDept">${icon('plus', 'width="14" height="14"')}부서 추가</button></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th style="width:60px">색상</th><th>부서명</th><th>교직원</th><th>일정</th><th>자료</th><th></th></tr></thead><tbody>
    ${DB.depts.map((d) => `<tr><td><input type="color" value="${d.color}" data-did="${d.id}" data-f="color" style="width:36px;height:28px;border:none;background:none;cursor:pointer"></td>
      <td><input class="input" style="padding:6px 10px" value="${esc(d.name)}" data-did="${d.id}" data-f="name"></td>
      <td>${DB.users.filter((u) => u.dept === d.id).length}</td><td>${DB.events.filter((e) => e.dept === d.id).length}</td><td>${DB.docs.filter((x) => x.dept === d.id).length}</td>
      <td><button class="btn danger sm" data-act="delDept" data-id="${d.id}">삭제</button></td></tr>`).join('')}</tbody></table></div>
    <p style="font-size:12px;color:var(--text-3);margin-top:10px">업무담당자(Level 2)는 자기 부서의 일정·자료·회의를 등록·수정·삭제할 수 있습니다. 식단 관리는 교직원 관리에서 「급식 담당」으로 지정한 교직원이 할 수 있습니다.</p></div>`;
  $$('[data-did]', el).forEach((i) => i.addEventListener('change', () => { const d = dept(i.dataset.did); d[i.dataset.f] = i.value; log('update', 'dept', d.name); saveDB(); toast('저장되었습니다.'); }));
};
ACT.addDept = () => { const colors = ['#ff9f0a', '#64d2ff', '#bf5af2', '#ff375f', '#30d158', '#5e5ce6']; DB.depts.push({ id: uid('d'), name: '새 부서', color: colors[DB.depts.length % colors.length] }); log('create', 'dept', '새 부서'); saveDB(); rerender(); };
ACT.delDept = async (d) => {
  const dp = dept(d.id);
  if (DB.users.some((u) => u.dept === d.id) || DB.events.some((e) => e.dept === d.id) || DB.docs.some((x) => x.dept === d.id)) return toast('소속 교직원·일정·자료가 있는 부서는 삭제할 수 없습니다.');
  if (!(await confirmBox(`「${esc(dp.name)}」 부서를 삭제할까요?`, '삭제', true))) return;
  DB.depts = DB.depts.filter((x) => x.id !== d.id); log('delete', 'dept', dp.name); saveDB(); rerender();
};
ADMIN.perm = (el) => {
  const rows = [['학교 일정·회의자료·공지 열람', '✓', '✓', '✓'], ['문서 열람 및 다운로드', '✓', '✓', '✓'], ['본인 일정·자료 작성·수정', '✓', '✓', '✓'], ['담당 부서 일정·자료·회의 등록·수정·삭제', '', '✓', '✓'], ['공지 작성', '', '✓', '✓'], ['급식 관리', '급식 담당 지정 시', '급식 담당 지정 시', '✓'], ['다운로드 제한 자료 내려받기', '', '해당 부서', '✓'], ['공지 상단 고정', '', '', '✓'], ['이전 문서 버전 복구', '', '', '✓'], ['교직원 승인·권한·부서·백업 관리', '', '', '✓']];
  el.innerHTML = `<div class="card"><div class="card-head"><h3>권한 단계</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>기능</th><th>Level 1<br>일반 교직원</th><th>Level 2<br>업무담당자</th><th>Level 3<br>최고관리자</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${r[0]}</td>${r.slice(1).map((c) => `<td style="text-align:center;color:${c === '✓' ? 'var(--green)' : 'var(--text-2)'};font-weight:600">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p style="font-size:13px;color:var(--text-2);margin-top:12px">문서별 세부 권한: 자료마다 다운로드 제한을 설정할 수 있습니다. (학생 개인정보가 담긴 민감자료는 올리지 않습니다) 교직원별 권한 단계는 「교직원 관리」에서 변경합니다.</p></div>`;
};
ADMIN.history = (el) => {
  const vers = []; DB.docs.forEach((d) => d.versions.forEach((x) => vers.push({ d, x })));
  vers.sort((a, b) => b.x.at.localeCompare(a.x.at));
  const edits = DB.logs.filter((l) => ['create', 'update', 'delete', 'restore', 'import'].includes(l.act)).slice(0, 150);
  el.innerHTML = `<div class="grid c2"><div class="card"><div class="card-head"><h3>문서 버전 이력</h3></div><div class="list">${vers.slice(0, 60).map(({ d, x }) => `<div class="li" data-act="openDoc" data-id="${d.id}">${fileIcon(x.ext)}<div class="li-main"><div class="li-title">${esc(d.title)} <span class="tag blue">v${x.v}</span></div><div class="li-sub">${esc(x.note)} · ${esc(user(x.by).name)} · ${fmtFull(x.at)}</div></div></div>`).join('')}</div></div>
    <div class="card"><div class="card-head"><h3>등록·수정·삭제 기록</h3></div>${edits.map(logLine).join('') || '<div class="empty">기록 없음</div>'}</div></div>`;
};
let logFilter = '';
ADMIN.logs = (el) => {
  const acts = [...new Set(DB.logs.map((l) => l.act))];
  const list = DB.logs.filter((l) => !logFilter || l.act === logFilter).slice(0, 300);
  el.innerHTML = `<div class="card"><div class="card-head"><h3>접속·활동 로그</h3><select class="input" id="logF" style="width:auto;padding:6px 10px;font-size:13px"><option value="">전체</option>${acts.map((a) => `<option value="${a}" ${a === logFilter ? 'selected' : ''}>${ACT_LABEL[a] || a}</option>`).join('')}</select></div>
    ${list.map(logLine).join('') || '<div class="empty">기록 없음</div>'}<p style="font-size:12px;color:var(--text-3);margin-top:10px">로그인 기록 · 파일 열람/다운로드 기록 · 문서 수정 기록을 최대 1,500건 보관합니다.</p></div>`;
  $('#logF', el).addEventListener('change', (e) => { logFilter = e.target.value; rerender(); });
};
ADMIN.trash = (el) => {
  el.innerHTML = `<div class="card"><div class="card-head"><h3>휴지통 — 삭제 자료 복구</h3></div><div class="list">${DB.trash.map((t) => `<div class="li" style="cursor:default"><span class="tag">${TYPE_LABEL[t.type] || t.type}</span><div class="li-main"><div class="li-title">${esc(t.item.title || t.item.name || '')}</div><div class="li-sub">${esc(user(t.by).name)} 삭제 · ${fmtFull(t.at)}</div></div>
    <button class="btn secondary sm" data-act="restoreTrash" data-id="${t.id}">${icon('history', 'width="14" height="14"')}복구</button><button class="btn danger sm" data-act="purgeTrash" data-id="${t.id}">영구 삭제</button></div>`).join('') || '<div class="empty">휴지통이 비어 있습니다.</div>'}</div></div>`;
};
ACT.restoreTrash = (d) => {
  const t = DB.trash.find((x) => x.id === d.id); if (!t) return;
  if (t.type === 'event') DB.events.push(t.item);
  else if (t.type === 'doc') DB.docs.unshift(t.item);
  else if (t.type === 'meeting') DB.meetings.push(t.item);
  else if (t.type === 'notice') DB.notices.unshift(t.item);
  else if (t.type === 'meal') DB.meals[t.item.date] = t.item.meal;
  DB.trash = DB.trash.filter((x) => x.id !== t.id); log('restore', t.type, t.item.title || ''); saveDB(); toast('복구되었습니다.'); rerender();
};
ACT.purgeTrash = async (d) => {
  const t = DB.trash.find((x) => x.id === d.id);
  if (!(await confirmBox('영구 삭제하면 되돌릴 수 없습니다. 계속할까요?', '영구 삭제', true))) return;
  if (t.type === 'doc') for (const v of t.item.versions) await FileStore.del(v.fileId);
  DB.trash = DB.trash.filter((x) => x.id !== t.id); saveDB(); rerender();
};
ADMIN.backup = (el) => {
  el.innerHTML = `<div class="grid c2"><div class="card"><div class="card-head"><h3>💾 전체 자료 백업</h3></div><p style="font-size:14px;color:var(--text-2);margin-bottom:14px">일정·회의·공지·급식·자료 데이터와 모든 첨부 원본 파일(전 버전)을 하나의 백업 파일(.json)로 내려받습니다. 정기적으로 백업해 학교 공유폴더 등 안전한 곳에 보관하세요.</p>
      <button class="btn" data-act="backupExport">${icon('download', 'width="16" height="16"')}백업 파일 내려받기</button>
      <p style="font-size:12px;color:var(--text-3);margin-top:10px">최근 백업: ${DB.settings.lastBackup ? fmtFull(DB.settings.lastBackup) : '없음'}</p></div>
    <div class="card"><div class="card-head"><h3>♻️ 백업에서 복원</h3></div><p style="font-size:14px;color:var(--text-2);margin-bottom:14px">백업 파일로 일정·회의·공지·자료·급식 데이터를 복원합니다. 현재 데이터는 백업 내용으로 대체됩니다. (교직원 계정은 그대로 유지)</p>
      <label class="btn secondary">${icon('upload', 'width="16" height="16"')}백업 파일 선택<input type="file" accept=".json" id="restoreFile" hidden></label>
</div></div>`;
  $('#restoreFile', el).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!(await confirmBox('현재 데이터를 백업 내용으로 대체할까요?', '복원', true))) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.db || !data.db.docs) throw new Error('올바른 백업 파일이 아닙니다.');
      toast('복원 중… 파일이 많으면 시간이 걸립니다.');
      for (const [id, fobj] of Object.entries(data.files || {})) {
        const bin = atob(fobj.b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        await FileStore.put(id, new Blob([arr], { type: fobj.type || '' }));
      }
      ['events', 'meetings', 'docs', 'notices', 'notis', 'logs', 'trash', 'meals', 'depts', 'meetingTypes', 'categories'].forEach((k) => { if (data.db[k]) DB[k] = data.db[k]; });
      await flushNow();
      log('restore', 'system', '백업 복원', f.name); saveDB(); toast('복원되었습니다.'); renderShell(); route();
    } catch (err) { toast('복원 실패: ' + err.message); }
  });
};
ACT.backupExport = async () => {
  toast('백업 파일을 만드는 중…');
  const files = {};
  const ids = new Set(); DB.docs.forEach((d) => d.versions.forEach((v) => ids.add(v.fileId))); DB.trash.forEach((t) => t.type === 'doc' && t.item.versions.forEach((v) => ids.add(v.fileId)));
  for (const id of ids) {
    const b = await FileStore.get(id); if (!b) continue;
    const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    files[id] = { type: b.type, b64: btoa(s) };
  }
  DB.settings.lastBackup = nowISO(); log('backup', 'system', '전체 백업'); saveDB();
  const { users, ...rest } = DB;
  download(new Blob([JSON.stringify({ app: 'mh_office', version: 2, at: nowISO(), db: rest, files })], { type: 'application/json' }), `${SCHOOL}_온라인교무실_백업_${todayStr()}.json`);
  rerender();
};
ADMIN.settings = (el) => {
  const s = DB.settings;
  el.innerHTML = `<div class="grid c2"><div class="card"><div class="card-head"><h3>🔐 보안</h3></div><form id="setSec">
      <div class="field"><label>일정 시간 미사용 시 재인증 (분)</label><input class="input" type="number" min="5" max="480" name="lockMinutes" value="${s.lockMinutes}"></div>
      <button class="btn">저장</button>
      <hr style="border:none;border-top:1px solid var(--line-soft);margin:18px 0">
      <p style="font-size:13px;color:var(--text-2);margin-bottom:10px">관리자 비밀번호(관리자 탭 로그인용) 변경</p><button type="button" class="btn secondary" data-act="changeMyPw">${icon('lock', 'width="16" height="16"')}내 비밀번호 변경</button></form></div>
    <div class="card"><div class="card-head"><h3>🗂 게시판 및 메뉴 관리</h3></div><form id="setMenu">
      <div class="field"><label>자료 분류 (쉼표로 구분)</label><input class="input" name="categories" value="${esc(DB.categories.join(', '))}"></div>
      <div class="field"><label>회의 유형 (쉼표로 구분)</label><textarea class="input" name="meetingTypes">${esc(DB.meetingTypes.join(', '))}</textarea></div>
      <button class="btn">저장</button></form></div></div>`;
  $('#setSec', el).addEventListener('submit', (e) => {
    e.preventDefault(); const f = formData(e.target);
    s.lockMinutes = clamp(+f.lockMinutes || 30, 5, 480);
    log('settings', 'system', '보안 설정 변경'); saveDB(); toast('저장되었습니다.');
  });
  $('#setMenu', el).addEventListener('submit', (e) => {
    e.preventDefault(); const f = formData(e.target);
    const split = (x) => x.split(',').map((y) => y.trim()).filter(Boolean);
    if (split(f.categories).length) DB.categories = split(f.categories);
    if (split(f.meetingTypes).length) DB.meetingTypes = split(f.meetingTypes);
    log('settings', 'system', '메뉴 설정 변경'); saveDB(); toast('저장되었습니다.');
  });
};

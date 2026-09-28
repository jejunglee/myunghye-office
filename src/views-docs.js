/* =========================================================
   회의실 · 자료실 · 문서 뷰어 · 버전 관리
   ========================================================= */

/* ---------- 텍스트 추출 (검색·미리보기용) ---------- */
const TEXT_EXT = ['txt', 'md', 'csv'];
const SHEET_EXT = ['xlsx', 'xls', 'csv'];
const IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const TYPE_GROUPS = { 한글: ['hwp', 'hwpx'], 엑셀: ['xlsx', 'xls', 'csv'], PDF: ['pdf'], 워드: ['doc', 'docx'], 파워포인트: ['ppt', 'pptx'], 이미지: IMG_EXT, 텍스트: ['txt', 'md'] };

async function extractText(blob, name) {
  const ext = extOf(name);
  try {
    if (TEXT_EXT.includes(ext)) return (await blob.text()).slice(0, 30000);
    if (SHEET_EXT.includes(ext)) {
      await loadLib('XLSX');
      const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
      return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n').slice(0, 30000);
    }
    if (ext === 'docx') { await loadLib('mammoth'); const r = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() }); return r.value.slice(0, 30000); }
    if (ext === 'hwpx') { const r = await parseHwpx(blob); return r.text.slice(0, 30000); }
    if (ext === 'pptx') { const s = await parsePptx(blob); return s.map((x) => x.join('\n')).join('\n').slice(0, 30000); }
    if (ext === 'hwp') { const r = await parseHwp(blob); return (r.text || '').slice(0, 30000); }
  } catch (e) { console.warn('텍스트 추출 실패', name, e); }
  return '';
}

/* HWPX: ZIP + XML (OWPML) → 문단·표 구조 추출 */
async function parseHwpx(blob) {
  await loadLib('JSZip');
  const zip = await JSZip.loadAsync(blob);
  const secs = Object.keys(zip.files).filter((f) => /Contents\/section\d+\.xml$/i.test(f)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1], 10) - parseInt(b.match(/(\d+)\.xml/)[1], 10));
  const html = []; const text = [];
  for (const f of secs) {
    const xml = new DOMParser().parseFromString(await zip.file(f).async('string'), 'application/xml');
    walk(xml.documentElement);
  }
  return { html: html.join(''), text: text.join('\n') };

  function pText(p) { let s = ''; (function r(n) { for (const c of n.children) { if (c.localName === 'tbl') continue; if (c.localName === 't') s += c.textContent; else if (c.localName === 'tab') s += '\t'; else r(c); } })(p); return s; }
  function walk(node) {
    for (const ch of node.children) {
      if (ch.localName === 'tbl') html.push(tbl(ch));
      else if (ch.localName === 'p') {
        const t = pText(ch); if (t.trim()) { html.push(`<p>${esc(t)}</p>`); text.push(t); } else html.push('<p>&nbsp;</p>');
        (function r(n) { for (const c of n.children) { if (c.localName === 'tbl') html.push(tbl(c)); else if (c.localName !== 't') r(c); } })(ch);
      } else walk(ch);
    }
  }
  function tbl(t) {
    const rows = [...t.children].filter((c) => c.localName === 'tr');
    return `<table>${rows.map((tr) => `<tr>${[...tr.children].filter((c) => c.localName === 'tc').map((tc) => {
      const span = [...tc.children].find((c) => c.localName === 'cellSpan');
      const cs = span ? span.getAttribute('colSpan') : 1; const rs = span ? span.getAttribute('rowSpan') : 1;
      const ps = [...tc.getElementsByTagNameNS('*', 'p')].map(pText).filter((x) => x.trim());
      text.push(ps.join(' '));
      return `<td colspan="${cs}" rowspan="${rs}">${ps.map(esc).join('<br>')}</td>`;
    }).join('')}</tr>`).join('')}</table>`;
  }
}
async function parsePptx(blob) {
  await loadLib('JSZip');
  const zip = await JSZip.loadAsync(blob);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1], 10) - parseInt(b.match(/(\d+)\.xml/)[1], 10));
  const out = [];
  for (const f of slides) {
    const xml = new DOMParser().parseFromString(await zip.file(f).async('string'), 'application/xml');
    out.push([...xml.getElementsByTagNameNS('*', 'p')].map((p) => [...p.getElementsByTagNameNS('*', 't')].map((t) => t.textContent).join('')).filter((s) => s.trim()));
  }
  return out;
}
/* HWP(5.0): OLE 복합문서의 PrvText(미리보기 텍스트)·PrvImage(첫 페이지 이미지) 추출 */
async function parseHwp(blob) {
  await loadLib('XLSX');
  const cfb = XLSX.CFB.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
  const t = XLSX.CFB.find(cfb, 'PrvText'); const im = XLSX.CFB.find(cfb, 'PrvImage');
  const text = t && t.content ? new TextDecoder('utf-16le').decode(new Uint8Array(t.content)).replace(/\u0000/g, '') : '';
  let img = null;
  if (im && im.content && im.content.length) {
    const b = new Uint8Array(im.content);
    const type = b[0] === 0x89 ? 'image/png' : b[0] === 0x47 ? 'image/gif' : b[0] === 0x42 ? 'image/bmp' : 'image/png';
    img = URL.createObjectURL(new Blob([b], { type }));
  }
  return { text, img };
}

/* ---------- 문서 생성·버전 ---------- */
async function createDoc(file, meta, silent) {
  const fileId = uid('f');
  await FileStore.put(fileId, file);
  const text = await extractText(file, file.name);
  const at = nowISO();
  const doc = {
    id: uid('doc'), title: meta.title || file.name.replace(/\.[^.]+$/, ''), category: meta.category || '기타', dept: meta.dept || ME.dept,
    createdBy: ME.id, createdAt: at, updatedAt: at, updatedBy: ME.id, cur: 1, sensitive: !!meta.sensitive, allowDownload: meta.allowDownload !== false,
    meetingId: meta.meetingId || '', tags: meta.tags || '', readBy: [ME.id],
    versions: [{ v: 1, fileId, name: file.name, ext: extOf(file.name), size: file.size, type: file.type, at, by: ME.id, note: meta.note || '최초 등록', text }],
  };
  DB.docs.unshift(doc);
  if (doc.meetingId) { const m = DB.meetings.find((x) => x.id === doc.meetingId); if (m && !m.docIds.includes(doc.id)) m.docIds.push(doc.id); }
  log('create', 'doc', doc.title, 'v1');
  if (!silent) notify(`새 자료가 등록되었습니다: ${doc.title}`, 'doc', '#docs/' + doc.id);
  saveDB();
  return doc;
}
async function addVersion(doc, file, note, fileIdReuse) {
  let fileId = fileIdReuse; let text = '';
  if (!fileId) { fileId = uid('f'); await FileStore.put(fileId, file); text = await extractText(file, file.name); }
  else { const src = doc.versions.find((x) => x.fileId === fileId); text = src ? src.text : ''; }
  const v = doc.versions.length + 1; const at = nowISO();
  const src = fileIdReuse ? doc.versions.find((x) => x.fileId === fileIdReuse) : null;
  doc.versions.push({ v, fileId, name: src ? src.name : file.name, ext: src ? src.ext : extOf(file.name), size: src ? src.size : file.size, type: src ? src.type : file.type, at, by: ME.id, note, text });
  doc.cur = v; doc.updatedAt = at; doc.updatedBy = ME.id; doc.readBy = [ME.id];
  log(fileIdReuse ? 'restore' : 'update', 'doc', doc.title, `v${v} ${note}`);
  notify(`「${doc.title}」 자료가 수정되었습니다. (v${v})`, 'doc', '#docs/' + doc.id);
  saveDB();
}

/* ---------------- 자료실 ---------------- */
const docFilter = { cat: '', dept: '', type: '', q: '', unread: false, sort: 'updated' };
VIEWS.docs = (v, args) => {
  const f = docFilter;
  let list = visibleDocs();
  if (f.cat) list = list.filter((d) => d.category === f.cat);
  if (f.dept) list = list.filter((d) => d.dept === f.dept);
  if (f.type) list = list.filter((d) => TYPE_GROUPS[f.type].includes(d.versions[d.cur - 1].ext));
  if (f.unread) list = list.filter((d) => !d.readBy.includes(ME.id));
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter((d) => (d.title + ' ' + d.tags + ' ' + d.versions[d.cur - 1].name).toLowerCase().includes(q)); }
  list.sort((a, b) => f.sort === 'name' ? a.title.localeCompare(b.title, 'ko') : f.sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));

  v.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">문서 통합 관리</div><h1>자료실</h1></div>
      <div class="actions"><button class="btn" data-act="uploadDoc">${icon('upload', 'width="16" height="16"')}자료 올리기</button></div></div>
    <div class="mt-types"><button class="chip ${!f.cat ? 'active' : ''}" data-act="docCat" data-v="">전체</button>${DB.categories.map((c) => `<button class="chip ${f.cat === c ? 'active' : ''}" data-act="docCat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="filters">
      <input class="input" id="docQ" placeholder="자료실 내 검색" value="${esc(f.q)}" style="min-width:200px">
      <select class="input" id="docDept">${deptOptions(f.dept, true)}</select>
      <select class="input" id="docType"><option value="">전체 형식</option>${Object.keys(TYPE_GROUPS).map((k) => `<option ${f.type === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <select class="input" id="docSort"><option value="updated" ${f.sort === 'updated' ? 'selected' : ''}>최근 수정순</option><option value="created" ${f.sort === 'created' ? 'selected' : ''}>최근 등록순</option><option value="name" ${f.sort === 'name' ? 'selected' : ''}>이름순</option></select>
      <label class="check"><input type="checkbox" id="docUnread" ${f.unread ? 'checked' : ''}> 미확인만</label>
    </div>
    <div class="card"><div class="list">${list.length ? list.map((d) => {
      const cv = d.versions[d.cur - 1];
      return `<div class="li" data-act="openDoc" data-id="${d.id}">${fileIcon(cv.ext)}<div class="li-main"><div class="li-title">${esc(d.title)}</div>
        <div class="li-sub">${esc(d.category)} · ${esc(dept(d.dept).name)} · v${d.cur} · ${esc(user(d.updatedBy).name)} · ${relTime(d.updatedAt)} · ${fmtSize(cv.size)}</div></div>
        ${d.sensitive ? '<span class="tag red">🔒 민감</span>' : ''}${d.allowDownload === false ? '<span class="tag orange">다운로드 제한</span>' : ''}${d.meetingId ? '<span class="tag purple">회의</span>' : ''}
        ${d.readBy.includes(ME.id) ? '' : '<span class="new-dot" title="미확인"></span>'}</div>`;
    }).join('') : '<div class="empty">조건에 맞는 자료가 없습니다.</div>'}</div></div>
    <p style="font-size:12.5px;color:var(--text-3);margin-top:10px">지원 형식: HWP · HWPX · XLS · XLSX · CSV · DOC · DOCX · PPT · PPTX · PDF · JPG · PNG · TXT — 원본은 그대로 보존되며, 가능한 형식은 바로 미리보기합니다.</p>`;

  const upd = () => { rerender(); };
  $('#docQ').addEventListener('input', debounce((e) => { f.q = e.target.value; upd(); const el = $('#docQ'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250));
  $('#docDept').addEventListener('change', (e) => { f.dept = e.target.value; upd(); });
  $('#docType').addEventListener('change', (e) => { f.type = e.target.value; upd(); });
  $('#docSort').addEventListener('change', (e) => { f.sort = e.target.value; upd(); });
  $('#docUnread').addEventListener('change', (e) => { f.unread = e.target.checked; upd(); });
  if (args[0] && !topModal()) openDocModal(args[0]);
};
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
ACT.docCat = (d) => { docFilter.cat = d.v; rerender(); };

ACT.uploadDoc = (d) => {
  const meetOpts = DB.meetings.filter(canSeeSensitive).sort((a, b) => b.date.localeCompare(a.date)).map((m) => `<option value="${m.id}" ${m.id === d.meeting ? 'selected' : ''}>${fmtMD(m.date)} ${esc(m.title)}</option>`).join('');
  const m = openModal({
    title: '자료 올리기',
    body: `<label class="dropzone" id="upDrop">${icon('upload')}<div><b>파일을 끌어오거나 클릭하여 선택</b> (여러 개 가능)</div><div style="font-size:12px;color:var(--text-3);margin-top:4px">HWP · HWPX · XLSX · DOCX · PPTX · PDF · 이미지 · TXT</div><input type="file" multiple hidden></label>
      <div id="upList" style="margin:10px 0 14px;font-size:13px;color:var(--text-2)"></div>
      <form id="upForm">
        <div class="field"><label>제목 (파일 1개일 때)</label><input class="input" name="title" placeholder="비워두면 파일명 사용"></div>
        <div class="row"><div class="field"><label>분류</label><select class="input" name="category">${DB.categories.map((c) => `<option ${c === (d.cat || '') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>담당 부서</label><select class="input" name="dept">${deptOptions(ME.dept)}</select></div></div>
        <div class="field"><label>관련 회의 (선택)</label><select class="input" name="meetingId"><option value="">없음</option>${meetOpts}</select></div>
        <div class="field"><label>태그 (검색용, 선택)</label><input class="input" name="tags" placeholder="예: 고교학점제, 2학기"></div>
        <p class="tag orange" style="display:block;white-space:normal;padding:8px 10px;margin-bottom:10px;line-height:1.5">⚠️ 학생 개인정보(개별화교육계획·상담기록·성적 등)가 담긴 자료는 올리지 마세요.</p>
        <label class="check"><input type="checkbox" name="noDownload"> 다운로드 제한 (담당 부서·관리자만 다운로드)</label>
      </form>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="upGo" disabled>올리기</button>`,
  });
  if (d.cat) $('[name=category]', m).value = d.cat;
  let files = [];
  const drop = $('#upDrop', m); const input = $('input', drop);
  const set = (fl) => { files = [...fl]; $('#upList', m).innerHTML = files.map((f) => `<div style="display:flex;gap:8px;align-items:center;padding:4px 0">${fileIcon(extOf(f.name))}<span>${esc(f.name)} · ${fmtSize(f.size)}</span></div>`).join(''); $('#upGo', m).disabled = !files.length; };
  input.addEventListener('change', () => set(input.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); set(e.dataTransfer.files); });
  $('#upGo', m).addEventListener('click', async () => {
    const f = formData($('#upForm', m));
    $('#upGo', m).disabled = true; $('#upGo', m).textContent = '처리 중…';
    for (const file of files) {
      if (file.size > FILE_LIMIT_MB * 1048576) { toast(`${file.name}: ${FILE_LIMIT_MB}MB 이하 파일만 올릴 수 있습니다.`); continue; }
      await createDoc(file, { title: files.length === 1 ? f.title : '', category: f.category, dept: f.dept, meetingId: f.meetingId, tags: f.tags, sensitive: f.sensitive, allowDownload: !f.noDownload });
    }
    closeModal(); toast(`${files.length}개 자료가 등록되었습니다.`); rerender(); updateBell();
    if (topModal() && d.meeting) { closeModal(); ACT.openMeeting({ id: d.meeting }); }
  });
};

/* ---------------- 문서 상세 · 뷰어 ---------------- */
ACT.openDoc = (d, el, e) => { if (e) e.stopPropagation(); openDocModal(d.id); };
let viewerCleanup = [];
async function openDocModal(id, verNo, tab) {
  const doc = DB.docs.find((x) => x.id === id);
  if (!doc) return toast('자료를 찾을 수 없습니다.');
  if (!canSeeSensitive(doc)) return toast('🔒 민감자료입니다. 담당 부서와 관리자만 열람할 수 있습니다.');
  if (!doc.readBy.includes(ME.id)) { doc.readBy.push(ME.id); }
  log('view', 'doc', doc.title); saveDB();
  const ver = doc.versions[(verNo || doc.cur) - 1];
  const editable = canEdit(doc);
  const meeting = doc.meetingId ? DB.meetings.find((x) => x.id === doc.meetingId) : null;
  const m = openModal({
    title: esc(doc.title), wide: true,
    onClose: () => { viewerCleanup.forEach((u) => URL.revokeObjectURL(u)); viewerCleanup = []; if (CUR.view === 'docs' && CUR.args[0]) history.replaceState(null, '', '#docs'); if (['docs', 'home'].includes(CUR.view)) rerender(); },
    body: `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        <span class="tag">${esc(doc.category)}</span>${deptTag(doc.dept)}<span class="tag blue">v${ver.v}${ver.v !== doc.cur ? ' (이전 버전)' : ' 최신'}</span>
        ${doc.sensitive ? '<span class="tag red">🔒 민감자료</span>' : ''}${doc.allowDownload === false ? '<span class="tag orange">다운로드 제한</span>' : ''}
        ${meeting ? `<button class="tag purple" data-act="openMeeting" data-id="${meeting.id}">회의: ${esc(meeting.title)}</button>` : ''}
        </div>
      <div class="tabs"><button class="${tab !== 'ver' ? 'active' : ''}" data-tab="pv">미리보기</button><button class="${tab === 'ver' ? 'active' : ''}" data-tab="ver">버전 이력 (${doc.versions.length})</button><button data-tab="info">정보</button></div>
      <div data-pane="pv" class="${tab === 'ver' ? 'hidden' : ''}">
        <div class="viewer-bar">${fileIcon(ver.ext)}<div class="vb-name"><b>${esc(ver.name)}</b><span>${fmtSize(ver.size)} · v${ver.v} · ${esc(user(ver.by).name)} · ${fmtDT(ver.at)}</span></div>
          <button class="btn secondary sm" data-act="viewerFull" title="크게 보기">${icon('grid', 'width="14" height="14"')}<span class="vb-full-label">크게 보기</span></button>
          ${canDownload(doc) ? `<button class="btn sm" data-act="docDownload" data-id="${doc.id}" data-v="${ver.v}">${icon('download', 'width="14" height="14"')}내려받기</button>` : '<span class="tag orange">🔒 다운로드 제한 자료</span>'}</div>
        <div class="viewer" id="viewer"><div class="empty" style="padding:60px">미리보기를 준비하는 중…</div></div></div>
      <div data-pane="ver" class="${tab === 'ver' ? '' : 'hidden'}"><div class="versions">${doc.versions.slice().reverse().map((x) => `
        <div class="ver ${x.v === doc.cur ? 'cur' : ''}"><div class="vn">v${x.v}</div><div class="vi"><b>${esc(x.note || '')}</b>${x.v === doc.cur ? ' <span class="tag blue">현재</span>' : ''}<br><span>${fmtFull(x.at)} · ${esc(user(x.by).name)} · ${esc(x.name)} · ${fmtSize(x.size)}</span></div>
          <button class="btn ghost sm" data-act="docVerView" data-id="${doc.id}" data-v="${x.v}">열람</button>
          ${x.v > 1 && x.text ? `<button class="btn ghost sm" data-act="docDiff" data-id="${doc.id}" data-v="${x.v}">변경 내용</button>` : ''}
          ${isAdmin() && x.v !== doc.cur ? `<button class="btn secondary sm" data-act="docRestore" data-id="${doc.id}" data-v="${x.v}">${icon('history', 'width="14" height="14"')}복구</button>` : ''}</div>`).join('')}</div>
        <p style="font-size:12px;color:var(--text-3);margin-top:10px">새 버전이 올라가도 이전 파일은 덮어쓰지 않고 모두 보존됩니다. 이전 버전 복구는 최고관리자만 가능합니다.</p></div>
      <div data-pane="info" class="hidden"><div class="list">
        ${[['등록', `${esc(user(doc.createdBy).name)} · ${fmtFull(doc.createdAt)}`], ['최종 수정', `${esc(user(doc.updatedBy).name)} · ${fmtFull(doc.updatedAt)}`], ['태그', esc(doc.tags || '-')],
          ['확인한 교직원', `${doc.readBy.length}명 — ${doc.readBy.map((u) => esc(user(u).name)).join(', ')}`], ['권한', `${doc.sensitive ? '민감자료(담당 부서·관리자만 열람)' : '전체 교직원 열람'} · ${doc.allowDownload === false ? '다운로드 제한' : '다운로드 허용'}`]]
          .map(([k, val]) => `<div class="li" style="cursor:default"><div style="width:110px;color:var(--text-2);font-size:13px">${k}</div><div class="li-main" style="font-size:14px;white-space:normal">${val}</div></div>`).join('')}</div>
        ${editable ? `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn secondary sm" data-act="docEditMeta" data-id="${doc.id}">${icon('edit', 'width="14" height="14"')}정보 수정</button></div>` : ''}</div>`,
    foot: `<div class="left">${editable ? `<button class="btn danger" data-act="deleteDoc" data-id="${doc.id}">${icon('trash', 'width="16" height="16"')}삭제</button>` : ''}</div>
      <button class="btn secondary hidden" id="sheetSave">${icon('check', 'width="16" height="16"')}수정 내용 저장 (새 버전)</button>
      ${editable ? `<button class="btn secondary" data-act="docNewVer" data-id="${doc.id}">${icon('upload', 'width="16" height="16"')}새 버전 올리기</button>` : ''}
      ${canDownload(doc) ? `<button class="btn" data-act="docDownload" data-id="${doc.id}" data-v="${ver.v}">${icon('download', 'width="16" height="16"')}내려받기</button>` : '<span style="font-size:12px;color:var(--text-3)">다운로드 제한 자료입니다</span>'}`,
  });
  $$('.tabs button', m).forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button', m).forEach((x) => x.classList.toggle('active', x === b));
    $$('[data-pane]', m).forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab));
  }));
  renderViewer($('#viewer', m), doc, ver, m, editable && ver.v === doc.cur);
}

async function renderViewer(box, doc, ver, modal, editable) {
  const blob = await FileStore.get(ver.fileId);
  const ext = ver.ext;
  if (!blob) { box.innerHTML = `<div class="notice-box">${fileIcon(ext)}<p>원본 파일을 이 기기에서 찾을 수 없습니다.<br>(백업 복원 후 다시 시도하세요)</p></div>`; return; }
  const url = URL.createObjectURL(blob); viewerCleanup.push(url);
  try {
    if (ext === 'pdf') { box.innerHTML = `<iframe src="${url}" title="PDF 미리보기"></iframe>`; return; }
    if (IMG_EXT.includes(ext)) { box.innerHTML = `<img src="${url}" alt="${esc(doc.title)}" style="padding:16px">`; return; }
    if (SHEET_EXT.includes(ext)) return await renderSheet(box, blob, doc, ver, modal, editable);
    if (TEXT_EXT.includes(ext)) { box.innerHTML = `<pre>${esc(await blob.text())}</pre>`; return; }
    if (ext === 'docx') {
      await loadLib('mammoth');
      const r = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
      box.innerHTML = `<div class="docx">${r.value || '<p>(내용 없음)</p>'}</div>`; return;
    }
    if (ext === 'hwpx') {
      const r = await parseHwpx(blob);
      box.innerHTML = `<div style="padding:10px 14px 0"><span class="tag blue">HWPX 구조화 미리보기 — 원본 서식은 한글 프로그램에서 확인하세요</span></div><div class="docx">${r.html || '<p>(텍스트 없음)</p>'}</div>`; return;
    }
    if (ext === 'pptx') {
      const slides = await parsePptx(blob);
      box.innerHTML = slides.map((s, i) => `<div class="slide"><h5>슬라이드 ${i + 1}</h5>${s.map((p, j) => j === 0 ? `<b style="font-size:17px;display:block;margin-bottom:6px">${esc(p)}</b>` : `<div>${esc(p)}</div>`).join('')}</div>`).join('') || '<div class="empty">텍스트가 없는 프레젠테이션입니다.</div>'; return;
    }
    if (ext === 'hwp') {
      const r = await parseHwp(blob);
      if (r.img) viewerCleanup.push(r.img);
      box.innerHTML = `<div style="padding:10px 14px 0"><span class="tag blue">HWP 원본 보존 + 웹 미리보기 (문서에 저장된 미리보기 정보)</span></div>
        ${r.img ? `<img src="${r.img}" alt="첫 페이지 미리보기" style="padding:16px;max-width:560px;background:#fff">` : ''}
        ${r.text ? `<pre>${esc(r.text)}</pre>` : ''}${!r.img && !r.text ? `<div class="notice-box">${fileIcon('hwp')}<p>이 HWP 파일에는 미리보기 정보가 없습니다.<br>내려받아 한글 프로그램에서 열어 주세요.</p>${dlBtn(doc, ver)}</div>` : ''}`; return;
    }
    box.innerHTML = `<div class="notice-box">${fileIcon(ext)}<p><b>${esc(ver.name)}</b><br>이 형식(${esc(ext.toUpperCase())})은 브라우저 미리보기를 지원하지 않습니다.<br>원본은 안전하게 보존되어 있으니 내려받아 확인하세요.<br><span style="font-size:12px">💡 PDF 또는 ${ext === 'doc' ? 'DOCX' : ext === 'ppt' ? 'PPTX' : 'HWPX'} 형식으로 함께 올리면 바로 미리보기할 수 있습니다.</span></p>${dlBtn(doc, ver)}</div>`;
  } catch (e) {
    box.innerHTML = `<div class="notice-box">${fileIcon(ext)}<p>미리보기를 만들지 못했습니다.<br><span style="font-size:12px">${esc(e.message)}</span></p>${dlBtn(doc, ver)}</div>`;
  }
}

async function renderSheet(box, blob, doc, ver, modal, editable) {
  await loadLib('XLSX');
  const isCsv = ver.ext === 'csv';
  const wb = isCsv ? XLSX.read(await blob.text(), { type: 'string', raw: true }) : XLSX.read(await blob.arrayBuffer(), { type: 'array' });
  let cur = 0; const edits = {};
  const draw = () => {
    const name = wb.SheetNames[cur]; const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }).slice(0, 400);
    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 } };
    const ncol = Math.min(40, Math.max(1, ...rows.map((r) => r.length)));
    box.innerHTML = `${wb.SheetNames.length > 1 ? `<div class="sheet-tabs">${wb.SheetNames.map((n, i) => `<button class="chip ${i === cur ? 'active' : ''}" data-si="${i}">${esc(n)}</button>`).join('')}</div>` : ''}
      ${editable ? '<div style="padding:10px 14px 0;font-size:12.5px;color:var(--text-2)">✏️ 셀을 클릭해 바로 수정할 수 있습니다. 수정 후 「수정 내용 저장」을 누르면 새 버전으로 보존됩니다.</div>' : ''}
      <div style="padding:10px"><div class="table-wrap" style="background:var(--card)"><table class="tbl sheet"><thead><tr><th></th>${Array.from({ length: ncol }, (_, c) => `<th>${XLSX.utils.encode_col(range.s.c + c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr><th>${range.s.r + ri + 1}</th>${Array.from({ length: ncol }, (_, c) => {
        const addr = XLSX.utils.encode_cell({ r: range.s.r + ri, c: range.s.c + c });
        const key = name + '!' + addr;
        return `<td ${editable ? 'contenteditable="true"' : ''} data-addr="${addr}">${esc(key in edits ? edits[key] : (r[c] ?? ''))}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    $$('[data-si]', box).forEach((b) => b.addEventListener('click', () => { cur = +b.dataset.si; draw(); }));
    if (editable) $$('td[data-addr]', box).forEach((td) => td.addEventListener('blur', () => {
      const key = name + '!' + td.dataset.addr; const orig = ws[td.dataset.addr] ? (ws[td.dataset.addr].w ?? String(ws[td.dataset.addr].v)) : '';
      if (td.textContent !== orig) edits[key] = td.textContent; else delete edits[key];
      $('#sheetSave', modal).classList.toggle('hidden', !Object.keys(edits).length);
    }));
  };
  draw();
  $('#sheetSave', modal).onclick = async () => {
    Object.entries(edits).forEach(([key, val]) => {
      const [sn, addr] = [key.slice(0, key.lastIndexOf('!')), key.slice(key.lastIndexOf('!') + 1)];
      const num = /^-?\d+(\.\d+)?$/.test(val.trim()) ? Number(val) : val;
      XLSX.utils.sheet_add_aoa(wb.Sheets[sn], [[num]], { origin: addr });
    });
    let file;
    if (isCsv) file = new File(['﻿' + XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])], ver.name, { type: 'text/csv' });
    else {
      const name = ver.name.replace(/\.xls$/i, '.xlsx');
      file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    await addVersion(doc, file, `웹에서 셀 ${Object.keys(edits).length}개 수정`);
    closeModal(); toast('새 버전으로 저장되었습니다.'); openDocModal(doc.id);
  };
}

function dlBtn(doc, ver) {
  return canDownload(doc) ? `<div style="margin-top:16px"><button class="btn" data-act="docDownload" data-id="${doc.id}" data-v="${ver.v}">${icon('download', 'width="16" height="16"')}원본 내려받기</button></div>` : '<p style="margin-top:12px"><span class="tag orange">🔒 다운로드 제한 자료</span></p>';
}
ACT.viewerFull = (d, el) => {
  const modal = el.closest('.modal'); const on = modal.classList.toggle('full');
  const lb = $('.vb-full-label', modal); if (lb) lb.textContent = on ? '원래 크기' : '크게 보기';
};
ACT.docVerView = (d) => { closeModal(); openDocModal(d.id, +d.v); };
ACT.docDownload = async (d) => {
  const doc = DB.docs.find((x) => x.id === d.id); const ver = doc.versions[(+d.v || doc.cur) - 1];
  if (!canDownload(doc)) return toast('다운로드가 제한된 자료입니다.');
  const blob = await FileStore.get(ver.fileId);
  if (!blob) return toast('파일을 찾을 수 없습니다.');
  download(blob, ver.name); log('download', 'doc', doc.title, 'v' + ver.v); saveDB();
  toast(`「${ver.name}」을(를) 내려받았습니다.`);
};
ACT.docRestore = async (d) => {
  const doc = DB.docs.find((x) => x.id === d.id); const ver = doc.versions[+d.v - 1];
  if (!(await confirmBox(`v${ver.v} (${esc(ver.note)})을(를) 최신 버전으로 복구할까요?<br><span style="font-size:13px;color:var(--text-3)">현재 버전도 이력에 그대로 남습니다.</span>`, '복구'))) return;
  await addVersion(doc, null, `v${ver.v} 버전으로 복구`, ver.fileId);
  closeModal(); toast(`v${ver.v} 내용으로 복구되었습니다.`); openDocModal(doc.id, null, 'ver');
};
ACT.docDiff = (d) => {
  const doc = DB.docs.find((x) => x.id === d.id); const v = +d.v;
  const a = (doc.versions[v - 2].text || '').split('\n'); const b = (doc.versions[v - 1].text || '').split('\n');
  const sa = new Set(a.map((x) => x.trim())); const sb = new Set(b.map((x) => x.trim()));
  const rows = [...a.filter((x) => x.trim() && !sb.has(x.trim())).map((x) => `<div style="background:rgba(255,59,48,.1);color:var(--red);padding:3px 10px;border-radius:6px;margin-bottom:3px">− ${esc(x)}</div>`),
    ...b.filter((x) => x.trim() && !sa.has(x.trim())).map((x) => `<div style="background:rgba(52,199,89,.12);color:#248a3d;padding:3px 10px;border-radius:6px;margin-bottom:3px">+ ${esc(x)}</div>`)];
  openModal({ title: `변경 내용 · v${v - 1} → v${v}`, body: `<p style="font-size:13px;color:var(--text-2);margin-bottom:10px">${esc(doc.versions[v - 1].note)} — ${esc(user(doc.versions[v - 1].by).name)}, ${fmtFull(doc.versions[v - 1].at)}</p><div style="font-size:13.5px;line-height:1.6">${rows.join('') || '<div class="empty">텍스트 변경 사항이 없습니다.</div>'}</div>` });
};
ACT.docNewVer = (d) => {
  const doc = DB.docs.find((x) => x.id === d.id);
  const m = openModal({
    title: '새 버전 올리기',
    body: `<p style="font-size:14px;color:var(--text-2);margin-bottom:12px">현재 v${doc.cur}. 새 파일을 올리면 v${doc.versions.length + 1}이(가) 되며 이전 버전은 모두 보존됩니다.</p>
      <label class="dropzone" id="nvDrop">${icon('upload')}<div id="nvName"><b>파일 선택</b></div><input type="file" hidden></label>
      <div class="field" style="margin-top:14px"><label>수정 내용</label><input class="input" id="nvNote" placeholder="예: 일정 수정, 최종 수정"></div>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="nvGo" disabled>올리기</button>`,
  });
  let file = null; const input = $('input', m);
  input.addEventListener('change', () => { file = input.files[0]; $('#nvName', m).innerHTML = `<b>${esc(file.name)}</b> · ${fmtSize(file.size)}`; $('#nvGo', m).disabled = false; });
  $('#nvGo', m).addEventListener('click', async () => {
    $('#nvGo', m).disabled = true;
    await addVersion(doc, file, $('#nvNote', m).value.trim() || '수정');
    closeModal(); closeModal(); toast(`v${doc.cur}이(가) 등록되었습니다.`); openDocModal(doc.id); updateBell();
  });
};
ACT.docEditMeta = (d) => {
  const doc = DB.docs.find((x) => x.id === d.id);
  const m = openModal({
    title: '자료 정보 수정',
    body: `<form id="dmForm"><div class="field"><label>제목</label><input class="input" name="title" value="${esc(doc.title)}"></div>
      <div class="row"><div class="field"><label>분류</label><select class="input" name="category">${DB.categories.map((c) => `<option ${c === doc.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>부서</label><select class="input" name="dept">${deptOptions(doc.dept)}</select></div></div>
      <div class="field"><label>태그</label><input class="input" name="tags" value="${esc(doc.tags)}"></div>
      <label class="check"><input type="checkbox" name="noDownload" ${doc.allowDownload === false ? 'checked' : ''}> 다운로드 제한</label></form>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="dmGo">저장</button>`,
  });
  $('#dmGo', m).addEventListener('click', () => {
    const f = formData($('#dmForm', m));
    Object.assign(doc, { title: f.title || doc.title, category: f.category, dept: f.dept, tags: f.tags, sensitive: f.sensitive, allowDownload: !f.noDownload, updatedAt: nowISO(), updatedBy: ME.id });
    log('update', 'doc', doc.title, '정보 수정'); saveDB(); closeModal(); closeModal(); openDocModal(doc.id); toast('저장되었습니다.');
  });
};
ACT.deleteDoc = async (d) => {
  const doc = DB.docs.find((x) => x.id === d.id);
  if (!(await confirmBox(`「${esc(doc.title)}」 자료를 삭제할까요?<br><span style="font-size:13px;color:var(--text-3)">파일은 보존되며 관리자가 휴지통에서 복구할 수 있습니다.</span>`, '삭제', true))) return;
  DB.docs = DB.docs.filter((x) => x.id !== doc.id);
  DB.meetings.forEach((mt) => { mt.docIds = mt.docIds.filter((x) => x !== doc.id); });
  trashItem('doc', doc); saveDB(); closeAllModals(); toast('삭제되었습니다.'); rerender();
};

/* ---------------- 회의실 ---------------- */
let meetingType = '';
VIEWS.meetings = (v, args) => {
  const ts = todayStr();
  let list = DB.meetings.filter(canSeeSensitive);
  if (meetingType) list = list.filter((m) => m.type === meetingType);
  const up = list.filter((m) => m.date >= ts).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = list.filter((m) => m.date < ts).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const card = (m) => {
    const docs = meetingDocs(m);
    const steps = [['회의일', true], ['회의 정보', !!m.place], ['회의자료', !!m.agenda], ['첨부파일', docs.length > 0], ['회의결과', !!m.result]];
    return `<div class="tl-item"><div class="card" data-act="openMeeting" data-id="${m.id}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div><div style="font-size:13px;color:var(--text-2);font-weight:600">${fmtKo(parseYmd(m.date))} · ${m.time}${m.endTime ? '–' + m.endTime : ''}</div>
          <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin:2px 0">${m.important ? '⭐️ ' : ''}${esc(m.title)}</div>
          <div class="li-sub">${esc(m.place)} · ${esc(m.attendees)}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag purple">${esc(m.type)}</span>${deptTag(m.dept)}${m.sensitive ? '<span class="tag red">🔒</span>' : ''}</div></div>
      <div class="flow" style="margin-top:10px">${steps.map(([s, on]) => `<span class="${on ? 'on' : ''}">${on ? '●' : '○'} ${s}</span>`).join('<span>›</span>')}</div>
      <div class="att-chips">${docs.slice(0, 3).map((x) => `<button class="att-chip" data-act="openDoc" data-id="${x.id}" title="바로 보기">${fileIcon(x.versions[x.cur - 1].ext)}<span>${esc(x.title)}</span></button>`).join('')}
        ${docs.length > 3 ? `<span class="att-more">+${docs.length - 3}</span>` : ''}
        <button class="att-chip add" data-act="openMeeting" data-id="${m.id}" title="첨부파일 올리기">${icon('upload')}<span>${docs.length ? '첨부' : '첨부파일 올리기'}</span></button></div></div></div>`;
  };
  v.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">회의별 자료 축적</div><h1>회의실</h1></div>
      <div class="actions">${ME.level >= 2 ? `<button class="btn" data-act="newMeeting">${icon('plus', 'width="16" height="16"')}회의 등록</button>` : ''}</div></div>
    <div class="mt-types"><button class="chip ${!meetingType ? 'active' : ''}" data-act="mtType" data-v="">전체</button>${DB.meetingTypes.map((t) => `<button class="chip ${meetingType === t ? 'active' : ''}" data-act="mtType" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="grid c2">
      <div><h3 style="font-size:17px;margin-bottom:12px">예정된 회의 <span class="tag blue">${up.length}</span></h3><div class="timeline">${up.map(card).join('') || '<div class="empty">예정된 회의가 없습니다.</div>'}</div></div>
      <div><h3 style="font-size:17px;margin-bottom:12px">지난 회의 <span class="tag">${past.length}</span></h3><div class="timeline">${past.map(card).join('') || '<div class="empty">지난 회의가 없습니다.</div>'}</div></div>
    </div>`;
  if (args[0] && !topModal()) ACT.openMeeting({ id: args[0] });
};
ACT.mtType = (d) => { meetingType = d.v; rerender(); };

/* 회의 첨부파일: 올리면 원본은 자료실(회의자료)에 보존되고 회의에 연결된다 */
async function attachToMeeting(m, files) {
  const list = [...files].filter((f) => { if (f.size > FILE_LIMIT_MB * 1048576) { toast(`${f.name}: ${FILE_LIMIT_MB}MB 이하 파일만 올릴 수 있습니다.`); return false; } return true; });
  if (!list.length) return 0;
  toast(`${list.length}개 파일을 올리는 중…`);
  for (const f of list) await createDoc(f, { category: '회의자료', dept: m.dept, meetingId: m.id, sensitive: m.sensitive, tags: m.type }, true);
  m.updatedAt = nowISO(); m.updatedBy = ME.id;
  log('update', 'meeting', m.title, `첨부파일 ${list.length}개`);
  notify(`「${m.title}」 회의에 첨부파일 ${list.length}개가 등록되었습니다.`, 'meeting', '#meetings/' + m.id);
  saveDB(); updateBell();
  return list.length;
}
function meetingDocs(m) { return m.docIds.map((id) => DB.docs.find((x) => x.id === id)).filter((x) => x && canSeeSensitive(x)); }

ACT.openMeeting = (d, el, e) => {
  if (e) e.stopPropagation();
  const m = DB.meetings.find((x) => x.id === d.id);
  if (!m) return toast('회의를 찾을 수 없습니다.');
  if (!canSeeSensitive(m)) return toast('🔒 담당 부서와 관리자만 열람할 수 있는 회의입니다.');
  const ed = canEdit(m);
  const docs = meetingDocs(m);
  const tab = d.tab || 'info';
  const linkable = ed ? visibleDocs().filter((x) => !m.docIds.includes(x.id)) : [];
  const md = openModal({
    title: esc(m.title), wide: true,
    onClose: () => { if (CUR.view === 'meetings' && CUR.args[0]) history.replaceState(null, '', '#meetings'); if (['meetings', 'home'].includes(CUR.view)) rerender(); },
    body: `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center"><span class="tag purple">${esc(m.type)}</span>${deptTag(m.dept)}${m.important ? '<span class="tag red">중요</span>' : ''}${m.sensitive ? '<span class="tag red">🔒 민감</span>' : ''}
        <span style="font-size:13px;color:var(--text-2);margin-left:auto">${fmtKo(parseYmd(m.date))} ${m.time}${m.endTime ? '–' + m.endTime : ''} · ${esc(m.place)}</span></div>
      <section class="att-panel" id="attPanel">
        <div class="att-head"><h3>📎 첨부파일 <span class="tag blue">${docs.length}</span></h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${linkable.length ? `<select class="input" id="mtLink" style="width:auto;padding:6px 10px;font-size:13px"><option value="">자료실에서 연결…</option>${linkable.map((x) => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select>` : ''}
            <label class="btn sm">${icon('upload', 'width="14" height="14"')}파일 올리기<input type="file" multiple hidden id="attInput"></label></div></div>
        ${docs.length ? `<div class="att-grid">${docs.map((x) => { const cv = x.versions[x.cur - 1]; return `<div class="att" data-act="openDoc" data-id="${x.id}" title="클릭하여 바로 보기">${fileIcon(cv.ext)}
            <div class="att-main"><b>${esc(x.title)}</b><span>${esc(cv.ext.toUpperCase())} · ${fmtSize(cv.size)} · v${x.cur} · ${esc(user(x.updatedBy).name)}</span></div>
            ${x.readBy.includes(ME.id) ? '' : '<span class="new-dot" title="미확인"></span>'}
            ${canDownload(x) ? `<button class="att-x dl" data-act="docDownload" data-id="${x.id}" data-v="${x.cur}" title="내려받기">${icon('download')}</button>` : ''}
            ${ed || canEdit(x) ? `<button class="att-x" data-act="mtUnlink" data-mid="${m.id}" data-id="${x.id}" title="회의에서 빼기">${icon('x')}</button>` : ''}</div>`; }).join('')}</div>` : ''}
        <div class="att-drop">${icon('upload')}<span>${docs.length ? '파일을 여기로 끌어다 놓으면 바로 첨부됩니다' : '아직 첨부파일이 없습니다. 회의 자료(HWP·한글, 엑셀, PDF, PPT, 이미지 등)를 끌어다 놓거나 「파일 올리기」를 누르세요.'}</span></div>
      </section>
      <div class="tabs"><button class="${tab === 'info' ? 'active' : ''}" data-tab="info">회의 정보</button><button class="${tab === 'agenda' ? 'active' : ''}" data-tab="agenda">회의자료 (안건)</button><button class="${tab === 'result' ? 'active' : ''}" data-tab="result">회의결과</button></div>
      <div data-pane="info" class="${tab === 'info' ? '' : 'hidden'}"><div class="list">
        ${[['회의일', `${fmtKo(parseYmd(m.date))} ${m.time}${m.endTime ? '–' + m.endTime : ''}`], ['장소', esc(m.place)], ['주관', esc(dept(m.dept).name)], ['참석 대상', esc(m.attendees)], ['등록', `${esc(user(m.createdBy).name)} · 최종 수정 ${esc(user(m.updatedBy).name)} ${fmtDT(m.updatedAt)}`]]
          .map(([k, val]) => `<div class="li" style="cursor:default"><div style="width:90px;color:var(--text-2);font-size:13px">${k}</div><div class="li-main" style="white-space:normal">${val}</div></div>`).join('')}</div></div>
      <div data-pane="agenda" class="${tab === 'agenda' ? '' : 'hidden'}">${ed ? `<textarea class="input" id="mtAgenda" style="min-height:200px">${esc(m.agenda)}</textarea><div style="text-align:right;margin-top:8px"><button class="btn sm" data-act="mtSaveText" data-id="${m.id}" data-f="agenda">저장</button></div>` : `<div style="white-space:pre-wrap;font-size:15px;line-height:1.8">${esc(m.agenda) || '<span class="empty">등록된 안건이 없습니다.</span>'}</div>`}</div>
      <div data-pane="result" class="${tab === 'result' ? '' : 'hidden'}">${ed ? `<textarea class="input" id="mtResult" style="min-height:200px" placeholder="결정 사항, 후속 조치, 담당자 등">${esc(m.result)}</textarea><div style="text-align:right;margin-top:8px"><button class="btn sm" data-act="mtSaveText" data-id="${m.id}" data-f="result">저장</button></div>` : `<div style="white-space:pre-wrap;font-size:15px;line-height:1.8">${esc(m.result) || '<span class="empty">아직 회의결과가 등록되지 않았습니다.</span>'}</div>`}</div>`,
    foot: `${ed ? `<div class="left"><button class="btn danger" data-act="deleteMeeting" data-id="${m.id}">${icon('trash', 'width="16" height="16"')}삭제</button></div><button class="btn secondary" data-act="editMeeting" data-id="${m.id}">${icon('edit', 'width="16" height="16"')}회의 정보 수정</button>` : ''}
      <button class="btn secondary" data-act="go" data-to="#calendar/day/${m.date}">${icon('calendar', 'width="16" height="16"')}일정에서 보기</button>`,
  });
  const curTab = () => ($('.tabs button.active', md) || {}).dataset?.tab;
  $$('.tabs button', md).forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button', md).forEach((x) => x.classList.toggle('active', x === b));
    $$('[data-pane]', md).forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab));
  }));
  const reopen = () => { closeModal(); ACT.openMeeting({ id: m.id, tab: curTab() }); };
  const upload = async (files) => { if (files && files.length && await attachToMeeting(m, files)) { reopen(); toast('첨부되었습니다. 파일을 누르면 바로 볼 수 있습니다.'); } };
  $('#attInput', md).addEventListener('change', (ev) => upload(ev.target.files));
  // 회의 창 어디에든 파일을 끌어다 놓으면 첨부
  const panel = $('#attPanel', md); const box = $('.modal', md); let depth = 0;
  box.addEventListener('dragenter', (ev) => { if ([...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); depth++; panel.classList.add('drag'); } });
  box.addEventListener('dragover', (ev) => { if ([...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); });
  box.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; panel.classList.remove('drag'); } });
  box.addEventListener('drop', (ev) => { ev.preventDefault(); depth = 0; panel.classList.remove('drag'); upload(ev.dataTransfer.files); });
  const link = $('#mtLink', md);
  if (link) link.addEventListener('change', () => {
    if (!link.value) return;
    m.docIds.push(link.value); const doc = DB.docs.find((x) => x.id === link.value); if (doc && !doc.meetingId) doc.meetingId = m.id;
    m.updatedAt = nowISO(); m.updatedBy = ME.id; log('update', 'meeting', m.title, '자료 연결'); saveDB();
    reopen(); toast('자료가 연결되었습니다.');
  });
};
ACT.mtUnlink = async (d, el, e) => {
  if (e) e.stopPropagation();
  const m = DB.meetings.find((x) => x.id === d.mid); const doc = DB.docs.find((x) => x.id === d.id);
  if (!m || !doc) return;
  if (!(await confirmBox(`「${esc(doc.title)}」을(를) 이 회의 첨부에서 뺄까요?<br><span style="font-size:13px;color:var(--text-3)">파일은 자료실에 그대로 남습니다.</span>`, '빼기'))) return;
  m.docIds = m.docIds.filter((x) => x !== doc.id); if (doc.meetingId === m.id) doc.meetingId = '';
  m.updatedAt = nowISO(); m.updatedBy = ME.id; log('update', 'meeting', m.title, '첨부 해제: ' + doc.title); saveDB();
  closeModal(); ACT.openMeeting({ id: m.id }); toast('첨부에서 뺐습니다.');
};
ACT.mtSaveText = (d) => {
  const m = DB.meetings.find((x) => x.id === d.id);
  const val = $(d.f === 'agenda' ? '#mtAgenda' : '#mtResult').value;
  const first = d.f === 'result' && !m.result && val.trim();
  m[d.f] = val; m.updatedAt = nowISO(); m.updatedBy = ME.id;
  log('update', 'meeting', m.title, d.f === 'agenda' ? '회의자료' : '회의결과');
  if (first) notify(`「${m.title}」 회의결과가 등록되었습니다.`, 'meeting', '#meetings/' + m.id);
  saveDB(); toast('저장되었습니다.'); updateBell();
};
ACT.newMeeting = () => meetingForm(null);
ACT.editMeeting = (d) => { closeModal(); meetingForm(DB.meetings.find((x) => x.id === d.id)); };
ACT.deleteMeeting = async (d) => {
  const m = DB.meetings.find((x) => x.id === d.id);
  if (!(await confirmBox(`「${esc(m.title)}」 회의를 삭제할까요? (첨부 자료는 자료실에 남습니다)`, '삭제', true))) return;
  DB.meetings = DB.meetings.filter((x) => x.id !== m.id); trashItem('meeting', m); saveDB(); closeAllModals(); toast('삭제되었습니다.'); rerender();
};
function meetingForm(mt) {
  const isNew = !mt;
  const m0 = mt || { type: meetingType || DB.meetingTypes[0], title: '', date: todayStr(), time: '15:00', endTime: '16:00', place: '회의실', dept: ME.dept, attendees: '', agenda: '', important: false, sensitive: false };
  const md = openModal({
    title: isNew ? '회의 등록' : '회의 정보 수정',
    body: `<form id="mtForm">
      <div class="row"><div class="field"><label>회의 유형</label><select class="input" name="type">${DB.meetingTypes.map((t) => `<option ${t === m0.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label>주관 부서</label><select class="input" name="dept">${deptOptions(m0.dept)}</select></div></div>
      <div class="field"><label>회의명</label><input class="input" name="title" value="${esc(m0.title)}" placeholder="예: 고교학점제 협의회 (3차)"></div>
      <div class="row"><div class="field"><label>날짜</label><input class="input" type="date" name="date" value="${m0.date}"></div>
        <div class="field"><label>시작</label><input class="input" type="time" name="time" value="${m0.time}"></div><div class="field"><label>종료</label><input class="input" type="time" name="endTime" value="${m0.endTime || ''}"></div></div>
      <div class="row"><div class="field"><label>장소</label><input class="input" name="place" value="${esc(m0.place)}"></div><div class="field"><label>참석 대상</label><input class="input" name="attendees" value="${esc(m0.attendees)}"></div></div>
      ${isNew ? `<div class="field"><label>회의자료 (안건)</label><textarea class="input" name="agenda" placeholder="1. 안건">${esc(m0.agenda)}</textarea></div>` : ''}
      <label class="check" style="margin-bottom:8px"><input type="checkbox" name="important" ${m0.important ? 'checked' : ''}> 중요 회의 (알림·연간 일정 표시)</label>
      <p style="font-size:12.5px;color:var(--text-3);margin-bottom:12px">⚠️ 학생 개인정보가 담긴 회의자료는 올리지 마세요.</p></form>
      <div class="field"><label>📎 첨부파일 ${isNew ? '(선택)' : '추가'}</label>
        <label class="dropzone" id="mtFiles" style="padding:18px">${icon('upload')}<div><b>회의 자료 파일을 끌어오거나 클릭하여 선택</b> (여러 개 가능)</div><div style="font-size:12px;color:var(--text-3);margin-top:4px">HWP · HWPX · XLSX · DOCX · PPTX · PDF · 이미지 · TXT</div><input type="file" multiple hidden></label>
        <div id="mtFileList" style="font-size:13px;color:var(--text-2)"></div></div>`,
    foot: `<button class="btn secondary" data-act="closeModal">취소</button><button class="btn" id="mtGo">저장</button>`,
  });
  let files = [];
  const drop = $('#mtFiles', md); const input = $('input', drop);
  const setFiles = (fl) => {
    files = files.concat([...fl]);
    $('#mtFileList', md).innerHTML = files.map((f, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0">${fileIcon(extOf(f.name))}<span style="flex:1">${esc(f.name)} · ${fmtSize(f.size)}</span><button class="icon-btn" data-rm="${i}" title="빼기">${icon('x')}</button></div>`).join('');
    $$('[data-rm]', md).forEach((b) => b.addEventListener('click', () => { files.splice(+b.dataset.rm, 1); setFiles([]); }));
  };
  input.addEventListener('change', () => { setFiles(input.files); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); setFiles(e.dataTransfer.files); });
  $('#mtGo', md).addEventListener('click', async () => {
    const f = formData($('#mtForm', md));
    if (!f.title) f.title = f.type;
    if (!f.date) return toast('날짜를 입력하세요.');
    $('#mtGo', md).disabled = true;
    let target;
    if (isNew) {
      target = { id: uid('m'), ...f, result: '', docIds: [], createdBy: ME.id, createdAt: nowISO(), updatedAt: nowISO(), updatedBy: ME.id };
      DB.meetings.push(target); log('create', 'meeting', target.title);
      notify(`새 회의가 등록되었습니다: ${fmtMD(target.date)} ${target.time} ${target.title}`, 'meeting', '#meetings/' + target.id);
    } else {
      delete f.agenda; Object.assign(mt, f, { updatedAt: nowISO(), updatedBy: ME.id }); log('update', 'meeting', mt.title);
      target = mt;
    }
    saveDB();
    const n = files.length ? await attachToMeeting(target, files) : 0;
    closeModal(); rerender(); updateBell();
    toast(isNew ? `회의가 등록되었고 일정에도 반영되었습니다.${n ? ` (첨부 ${n}개)` : ''}` : `저장되었습니다.${n ? ` (첨부 ${n}개 추가)` : ''}`);
    ACT.openMeeting({ id: target.id });
  });
}

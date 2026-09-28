/* =========================================================
   한글 문서 해석 — HWP(5.0 바이너리) · HWPX(XML)
   문단과 표(셀 위치·병합 포함)를 꺼내 미리보기·검색·식단 반영에 쓴다.
   ========================================================= */

/* 표 셀 목록 → 2차원 격자(병합 셀은 왼쪽 위 칸에만 글자) */
function cellsToGrid(cells) {
  let R = 0; let C = 0;
  cells.forEach((c) => { R = Math.max(R, c.row + (c.rs || 1)); C = Math.max(C, c.col + (c.cs || 1)); });
  const g = Array.from({ length: R }, () => Array(C).fill(''));
  cells.forEach((c) => { if (g[c.row]) g[c.row][c.col] = c.text; });
  return g;
}
function cellsToHtml(cells) {
  const rows = {};
  cells.forEach((c) => { (rows[c.row] = rows[c.row] || []).push(c); });
  return `<table>${Object.keys(rows).map(Number).sort((a, b) => a - b).map((r) => `<tr>${rows[r].sort((a, b) => a.col - b.col).map((c) =>
    `<td${c.cs > 1 ? ` colspan="${c.cs}"` : ''}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}>${esc(c.text).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</table>`;
}

/* ---------- HWP 5.0 ---------- */
async function inflateRaw(u8) {
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 한글 파일 해석을 지원하지 않습니다. 최신 크롬·엣지·사파리를 사용하세요.');
  // 한글 파일은 압축 데이터 뒤에 여분 바이트가 붙는 경우가 있어, 풀린 데까지 모아서 사용
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(u8).catch(() => {}); w.close().catch(() => {});
  const reader = ds.readable.getReader(); const chunks = []; let total = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); total += value.length; } }
  catch (e) { if (!total) throw new Error('한글 파일 본문의 압축을 풀 수 없습니다.'); }
  const out = new Uint8Array(total); let o = 0; chunks.forEach((c) => { out.set(c, o); o += c.length; });
  return out;
}
const HWP_CTRL_SKIP = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
function hwpText(u8, off, len) {
  let s = '';
  for (let i = off; i + 1 < off + len; i += 2) {
    const c = u8[i] | (u8[i + 1] << 8);
    if (c >= 32) { s += String.fromCharCode(c); continue; }
    if (HWP_CTRL_SKIP.has(c)) { if (c === 9) s += '\t'; i += 14; continue; }   // 확장·인라인 컨트롤은 8글자(16바이트)
    if (c === 10) s += '\n'; else if (c === 30 || c === 31) s += ' ';
  }
  return s;
}
const TAG_PARA_HEADER = 66; const TAG_PARA_TEXT = 67; const TAG_CTRL_HEADER = 71; const TAG_LIST_HEADER = 72;
const CTRL_TABLE = 0x74626c20; // 'tbl '

async function parseHwpDoc(blob) {
  await loadLib('XLSX');
  const cfb = XLSX.CFB.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
  const fh = XLSX.CFB.find(cfb, 'FileHeader');
  if (!fh || !fh.content) throw new Error('한글(HWP) 파일 형식이 아닙니다.');
  const h = new Uint8Array(fh.content);
  const flags = (h[36] | (h[37] << 8) | (h[38] << 16) | (h[39] << 24)) >>> 0;
  if (flags & 2) throw new Error('암호가 설정된 한글 파일은 읽을 수 없습니다.');
  if (flags & 4) throw new Error('배포용 한글 문서는 읽을 수 없습니다. 한글에서 「다른 이름으로 저장」 후 다시 올려 주세요.');
  const compressed = !!(flags & 1);
  const secs = cfb.FullPaths.map((p, i) => [p, i]).filter(([p]) => /BodyText\/Section\d+$/i.test(p))
    .sort((a, b) => +a[0].match(/(\d+)$/)[1] - +b[0].match(/(\d+)$/)[1]);
  if (!secs.length) throw new Error('본문을 찾을 수 없습니다.');
  const blocks = [];
  for (const [, idx] of secs) {
    let data = new Uint8Array(cfb.FileIndex[idx].content);
    if (compressed) data = await inflateRaw(data);
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let pos = 0; let tbl = null; let cell = null;
    const endTable = () => { if (tbl) { if (tbl.cells.length) blocks.push({ type: 'table', cells: tbl.cells }); tbl = null; cell = null; } };
    while (pos + 4 <= data.length) {
      const hdr = dv.getUint32(pos, true); pos += 4;
      const tag = hdr & 0x3ff; const level = (hdr >>> 10) & 0x3ff; let size = (hdr >>> 20) & 0xfff;
      if (size === 0xfff) { if (pos + 4 > data.length) break; size = dv.getUint32(pos, true); pos += 4; }
      const off = pos; pos += size;
      if (pos > data.length) break;
      if (tag === TAG_PARA_HEADER) { if (tbl && level < tbl.cellLevel) endTable(); }
      else if (tag === TAG_CTRL_HEADER && size >= 4) {
        if (!tbl && dv.getUint32(off, true) === CTRL_TABLE) tbl = { cellLevel: level + 1, cells: [] };
      } else if (tag === TAG_LIST_HEADER && tbl && level === tbl.cellLevel && size >= 16) {
        // 문단 수(2) · 알수없음(2) · 속성(4) · 열(2) · 행(2) · 열병합(2) · 행병합(2)
        let col = dv.getUint16(off + 8, true); let row = dv.getUint16(off + 10, true);
        let cs = dv.getUint16(off + 12, true); let rs = dv.getUint16(off + 14, true);
        if (col > 200 || row > 2000 || cs > 200 || rs > 2000) { col = dv.getUint16(off + 6, true); row = dv.getUint16(off + 8, true); cs = dv.getUint16(off + 10, true); rs = dv.getUint16(off + 12, true); }
        cell = { row, col, cs: cs || 1, rs: rs || 1, text: '' };
        tbl.cells.push(cell);
      } else if (tag === TAG_PARA_TEXT) {
        const t = hwpText(data, off, size).replace(/\s+$/, '');
        if (tbl && cell && level > tbl.cellLevel) cell.text += (cell.text ? '\n' : '') + t;
        else if (!tbl) blocks.push({ type: 'p', text: t });
      }
    }
    endTable();
  }
  return docFromBlocks(blocks);
}

/* ---------- HWPX (OWPML) ---------- */
async function parseHwpxDoc(blob) {
  await loadLib('JSZip');
  const zip = await JSZip.loadAsync(blob);
  const secs = Object.keys(zip.files).filter((f) => /Contents\/section\d+\.xml$/i.test(f)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1], 10) - parseInt(b.match(/(\d+)\.xml/)[1], 10));
  const blocks = [];
  const pText = (p) => { let s = ''; (function r(n) { for (const c of n.children) { if (c.localName === 'tbl') continue; if (c.localName === 't') s += c.textContent; else if (c.localName === 'tab') s += '\t'; else if (c.localName === 'lineBreak') s += '\n'; else r(c); } })(p); return s; };
  const tblCells = (t) => {
    const cells = []; let ri = 0;
    [...t.children].filter((c) => c.localName === 'tr').forEach((tr) => {
      let ci = 0;
      [...tr.children].filter((c) => c.localName === 'tc').forEach((tc) => {
        const addr = [...tc.children].find((c) => c.localName === 'cellAddr');
        const span = [...tc.children].find((c) => c.localName === 'cellSpan');
        const col = addr ? +addr.getAttribute('colAddr') : ci; const row = addr ? +addr.getAttribute('rowAddr') : ri;
        const texts = [...tc.getElementsByTagNameNS('*', 'p')].map(pText).filter((x) => x.trim());
        cells.push({ row, col, cs: span ? +span.getAttribute('colSpan') || 1 : 1, rs: span ? +span.getAttribute('rowSpan') || 1 : 1, text: texts.join('\n') });
        ci++;
      });
      ri++;
    });
    return cells;
  };
  const walk = (node) => {
    for (const ch of node.children) {
      if (ch.localName === 'tbl') blocks.push({ type: 'table', cells: tblCells(ch) });
      else if (ch.localName === 'p') {
        blocks.push({ type: 'p', text: pText(ch) });
        (function r(n) { for (const c of n.children) { if (c.localName === 'tbl') blocks.push({ type: 'table', cells: tblCells(c) }); else if (c.localName !== 't') r(c); } })(ch);
      } else walk(ch);
    }
  };
  for (const f of secs) walk(new DOMParser().parseFromString(await zip.file(f).async('string'), 'application/xml').documentElement);
  return docFromBlocks(blocks);
}

function docFromBlocks(blocks) {
  const html = blocks.map((b) => b.type === 'p' ? (b.text.trim() ? `<p>${esc(b.text).replace(/\n/g, '<br>')}</p>` : '<p>&nbsp;</p>') : cellsToHtml(b.cells)).join('');
  const text = blocks.map((b) => b.type === 'p' ? b.text : b.cells.map((c) => c.text).join(' ')).join('\n');
  const tables = blocks.filter((b) => b.type === 'table').map((b) => cellsToGrid(b.cells));
  const paras = blocks.filter((b) => b.type === 'p').map((b) => b.text);
  return { html, text, tables, paras };
}

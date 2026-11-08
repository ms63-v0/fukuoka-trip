/* 후쿠오카 여행 노트 — 공통 유틸리티, 아이콘, 시트(레이어) 시스템 */
window.App = window.App || {};
(function (App) {
  'use strict';

  /* ---------- DOM / 문자열 ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : null; };
  const toHalf = (s) => String(s || '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[－−ー‐―]/g, '-').replace(/　/g, ' ');

  /* ---------- 카테고리 ---------- */
  const CATS = [
    { id: 'food', label: '맛집', short: '맛집', icon: 'bowl', color: 'var(--c-food)', listLabel: '메뉴', subs: ['라멘', '모츠나베', '야키토리', '스시', '우동', '멘타이코', '교자', '이자카야', '야타이', '텐푸라'] },
    { id: 'cafe', label: '카페·디저트', short: '카페', icon: 'cup', color: 'var(--c-cafe)', listLabel: '메뉴', subs: ['커피', '디저트', '베이커리', '말차', '파르페', '빙수'] },
    { id: 'shop', label: '쇼핑', short: '쇼핑', icon: 'bag', color: 'var(--c-shop)', listLabel: '살 것', subs: ['드럭스토어', '쇼핑몰', '백화점', '기념품', '잡화', '편집숍', '슈퍼'] },
    { id: 'visit', label: '방문·관광', short: '방문', icon: 'torii', color: 'var(--c-visit)', listLabel: '입장료·체험', subs: ['신사·절', '공원', '전망대', '박물관', '거리', '해변', '온천'] },
    { id: 'base', label: '교통·기타', short: '기타', icon: 'train', color: 'var(--c-base)', listLabel: '메모', subs: ['공항', '역', '버스터미널', '환전', '기타'] },
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const AREAS = ['하카타역', '나카스', '캐널시티', '텐진', '다이묘', '야쿠인', '오호리공원', '모모치', '다자이후', '이토시마', '공항', '기타'];
  const PRIORITY = { 3: '꼭 가기', 2: '가고 싶음', 1: '여유되면' };
  const WAIT = ['없음', '짧음', '보통', '김'];
  const WAIT_HINT = ['바로 입장', '~15분', '~30분', '1시간+'];
  const MOVES = { walk: '도보', subway: '지하철', bus: '버스', taxi: '택시', train: 'JR·기차', car: '렌터카' };

  /* ---------- 날짜 / 시간 (일본 표준시 UTC+9 기준) ---------- */
  const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function toMin(t) {
    if (!t) return null;
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim());
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function fmtMin(m) {
    if (m == null) return '';
    if (m === 1440) return '24:00';
    m = ((m % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function jstNow() {
    const d = new Date(Date.now() + 9 * 3600e3);
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    return { date: d.toISOString().slice(0, 10), dow: d.getUTCDay(), min, hm: fmtMin(min) };
  }
  const ymd = (ds) => ds.split('-').map(Number);
  const dowOf = (ds) => { const [y, m, d] = ymd(ds); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const addDays = (ds, n) => { const [y, m, d] = ymd(ds); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const diffDays = (a, b) => { const [y1, m1, d1] = ymd(a); const [y2, m2, d2] = ymd(b); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5); };
  function dateRange(s, e) {
    const out = [];
    if (!s || !e || s > e) return out;
    let d = s;
    while (d <= e && out.length < 21) { out.push(d); d = addDays(d, 1); }
    return out;
  }
  const md = (ds) => { const [, m, d] = ymd(ds); return `${m}/${d}`; };
  const mdDot = (ds) => { const [, m, d] = ymd(ds); return `${m}.${String(d).padStart(2, '0')}`; };

  /* ---------- 영업시간 ---------- */
  function dayWin(p, dow) {
    const h = p.hours && p.hours[DOW_KEYS[dow]];
    if (!h) return null;
    if (h.closed) return { closed: true };
    const o = toMin(h.open), c0 = toMin(h.close);
    if (o == null || c0 == null) return null;
    let c = c0; if (c <= o) c += 1440;
    const bs = toMin(h.bStart); let be = toMin(h.bEnd);
    const hasBreak = bs != null && be != null;
    if (hasBreak && be <= bs) be += 1440;
    let lo = toMin(h.lo); if (lo != null && lo < o) lo += 1440;
    return { o, c, bs: hasBreak ? bs : null, be: hasBreak ? be : null, lo };
  }
  function hasHours(p) {
    return !!p.hours && DOW_KEYS.some((k) => { const h = p.hours[k]; return h && (h.closed || (h.open && h.close)); });
  }
  const ST = (code, label, tone, short) => ({ code, label, tone, short: short || label });
  function openStatus(w, min) {
    if (w.o === 0 && w.c >= 1440 && w.bs == null) return ST('open', '24시간 영업', 'ok', '24시간');
    if (w.bs != null && min >= w.bs && min < w.be) return ST('break', `브레이크 타임 · ${fmtMin(w.be)} 재개`, 'warn', '브레이크');
    const toBreak = w.bs != null && min < w.bs;
    const end = toBreak ? w.bs : w.c;
    const left = end - min;
    if (!toBreak && w.lo != null && min >= w.lo) return ST('lo', `라스트오더 지남 · ${fmtMin(w.c)} 마감`, 'warn', 'L.O. 지남');
    if (left <= 60) return ST('soon', toBreak ? `${left}분 후 브레이크` : `${left}분 후 마감`, 'warn', toBreak ? '곧 브레이크' : '곧 마감');
    return ST('open', `영업 중 · ${fmtMin(w.c)} 마감`, 'ok', '영업 중');
  }
  function statusAt(p, dow, min) {
    if (!hasHours(p)) return ST('unknown', '영업시간 미입력', 'mute', '시간 미입력');
    const prev = dayWin(p, (dow + 6) % 7);
    if (prev && !prev.closed && prev.c > 1440 && min < prev.c - 1440) return openStatus(prev, min + 1440);
    const w = dayWin(p, dow);
    if (!w) return ST('unknown', '이 요일 영업시간 미입력', 'mute', '시간 미입력');
    if (w.closed) return ST('closed', '휴무일', 'bad', '휴무');
    if (min < w.o) return ST('before', `영업 전 · ${fmtMin(w.o)} 오픈`, 'mute', '영업 전');
    if (min >= w.c) return ST('after', '영업 종료', 'mute');
    return openStatus(w, min);
  }
  function statusNow(p) { const n = jstNow(); return statusAt(p, n.dow, n.min); }
  function hoursText(p, dow) {
    const w = dayWin(p, dow);
    if (!w) return '—';
    if (w.closed) return '휴무';
    if (w.o === 0 && w.c >= 1440) return '24시간';
    return `${fmtMin(w.o)}–${fmtMin(w.c)}`;
  }
  function hoursExtra(p, dow) {
    const w = dayWin(p, dow);
    if (!w || w.closed) return '';
    const out = [];
    if (w.bs != null) out.push(`브레이크 ${fmtMin(w.bs)}–${fmtMin(w.be)}`);
    if (w.lo != null) out.push(`L.O. ${fmtMin(w.lo)}`);
    return out.join(' · ');
  }
  function closuresOn(p, dates) {
    return dates.map((d) => ({ date: d, dow: dowOf(d) })).filter((x) => { const w = dayWin(p, x.dow); return w && w.closed; });
  }

  /* ---------- 거리 / 링크 ---------- */
  const hasLoc = (o) => o && Number.isFinite(o.lat) && Number.isFinite(o.lng);
  function distKm(a, b) {
    const R = 6371, r = (x) => (x * Math.PI) / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const walkMin = (km) => Math.max(1, Math.round(((km * 1.3) / 4.5) * 60));
  function segText(km) {
    if (km < 0.06) return '바로 옆';
    const k = km < 10 ? km.toFixed(1) : Math.round(km);
    if (km <= 2.2) return `도보 약 ${walkMin(km)}분 · ${k}km`;
    return `직선 ${k}km · 대중교통/택시`;
  }
  const ll = (o) => `${o.lat.toFixed(6)},${o.lng.toFixed(6)}`;
  function gmapPlace(p) {
    if (p.gmap) return p.gmap;
    const q = p.local ? `${p.local} ${p.address || ''}`.trim() : hasLoc(p) ? ll(p) : `${p.name} ${p.address || ''}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  function gmapDir(dest, origin, mode = 'transit') {
    let u = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hasLoc(dest) ? ll(dest) : dest.local || dest.name)}`;
    if (origin && hasLoc(origin)) u += `&origin=${ll(origin)}`;
    return u + `&travelmode=${mode}`;
  }
  function gmapRoute(points) {
    const pts = points.filter(hasLoc);
    if (pts.length < 2) return pts[0] ? gmapDir(pts[0]) : '';
    const mid = pts.slice(1, -1).slice(0, 9).map(ll).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${ll(pts[0])}&destination=${ll(pts[pts.length - 1])}${mid ? '&waypoints=' + encodeURIComponent(mid) : ''}&travelmode=walking`;
  }
  const naverPlace = (p) => p.nmap || `https://map.naver.com/p/search/${encodeURIComponent(p.local || p.name)}`;

  /* ---------- 돈 ---------- */
  const yen = (n) => (n == null || n === '' ? '' : '¥' + Number(n).toLocaleString('ja-JP'));
  function krw(n, rate100) {
    if (n == null || n === '' || !rate100) return '';
    const v = Math.round((Number(n) * rate100) / 100 / 100) * 100;
    return '약 ' + v.toLocaleString('ko-KR') + '원';
  }

  /* ---------- 아이콘 (24px 스트로크) ---------- */
  const P = {
    bowl: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z"/><path d="M14.5 3 10 10.5M19 3.5 13.5 10.5"/><path d="M9 20.5h6"/>',
    cup: '<path d="M4.5 8.5h12v4.5a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6Z"/><path d="M16.5 10h1.5a2.5 2.5 0 0 1 0 5h-1.8"/><path d="M8.5 2.8c-.8 1 .8 1.8 0 3M12.5 2.8c-.8 1 .8 1.8 0 3"/>',
    bag: '<path d="M5 8h14l-1.1 12.2a1 1 0 0 1-1 .8H7.1a1 1 0 0 1-1-.8Z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
    torii: '<path d="M2.5 4.5c4.5 1.4 14.5 1.4 19 0"/><path d="M4.5 9h15"/><path d="M7 6v14.5M17 6v14.5M12 6.2V9"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10.5h14M9 20.5l-1.5-3.5M15 20.5l1.5-3.5"/><circle cx="9" cy="13.8" r=".6"/><circle cx="15" cy="13.8" r=".6"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    map: '<path d="m9 4.5-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2Z"/><path d="M9 4.5v13M15 6.5v13"/>',
    list: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13.5h3M7.5 16.5h6"/>',
    note: '<path d="M6 3.5h9l4 4v13H6Z"/><path d="M14.5 3.5v4.5H19"/><path d="M9 12h7M9 15.5h7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    nav: '<path d="M4 11.5 20 4l-7.5 16-1.8-6.7Z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    phone: '<path d="M5 4.5h3.5l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    right: '<path d="m9.5 6 6 6-6 6"/>',
    star: '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8Z"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
    layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    yen: '<path d="M6 4.5 12 12l6-7.5M12 12v8M7.5 13h9M7.5 16.5h9"/>',
    plane: '<path d="M10.5 20.5 12 15l5 .5 2.5 3h1.5L20 14l1-1.5-1-1.5.5-4.5h-1.5l-2.5 3-5-.5L10 3.5H8L9.5 10l-4.5-.5L3 7H1.5l1 5-1 5H3l2-2.5 4.5-.5-1 6.5Z" transform="rotate(90 12 12) scale(.9) translate(1.3 1.3)"/>',
    bed: '<path d="M3 18.5v-11M3 14h18v4.5M21 14v-2.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="11" r="1.8"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17.3v.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18.5Z"/>',
    rain: '<path d="M7 15a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 15Z"/><path d="m8.5 18-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
    snow: '<path d="M7 14a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 14Z"/><path d="M8.5 18.5h.01M12 20h.01M15.5 18.5h.01"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 2.5-2.5L20 19"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
    dots: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
    grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;

  /* ---------- 토스트 / 클립보드 ---------- */
  let toastT;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2400);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('복사했어요'); return; } catch (e) { /* fallback */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('복사했어요'); } catch (e) { toast('복사하지 못했어요. 길게 눌러 직접 복사해 주세요.'); }
    ta.remove();
  }

  /* ---------- 시트 / 다이얼로그 (뒤로가기로 닫힘) ---------- */
  const layers = [];
  function openSheet(opts) {
    const { title, head, body = '', foot = '', cls = '', onMount, onClose } = opts;
    const root = $('#layers');
    const wrap = document.createElement('div');
    wrap.className = 'layer ' + (cls.includes('dialog') ? 'layer-dialog' : '');
    wrap.innerHTML = `
      <div class="scrim" data-close></div>
      <section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title || '')}">
        <div class="sheet-grip" aria-hidden="true"></div>
        <header class="sheet-head">${head || `<h2 class="sheet-title">${esc(title || '')}</h2>`}
          <button type="button" class="icon-btn sheet-x" data-close aria-label="닫기">${icon('x')}</button>
        </header>
        <div class="sheet-body">${body}</div>
        ${foot ? `<footer class="sheet-foot">${foot}</footer>` : ''}
      </section>`;
    root.appendChild(wrap);
    const entry = { wrap, sheet: $('.sheet', wrap), onClose, refresh: null };
    layers.push(entry);
    history.pushState({ layer: layers.length }, '');
    document.documentElement.classList.add('has-layer');
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { e.preventDefault(); closeTop(); } });
    if (onMount) onMount(entry.sheet, entry);
    setTimeout(() => { const f = $('[autofocus]', entry.sheet) || $('.sheet-x', entry.sheet); f && f.focus({ preventScroll: true }); }, 60);
    return entry;
  }
  function destroyLayer(entry) {
    entry.wrap.classList.remove('open');
    entry.wrap.classList.add('closing');
    setTimeout(() => entry.wrap.remove(), 260);
    if (entry.onClose) entry.onClose();
    if (!layers.length) document.documentElement.classList.remove('has-layer');
  }
  function closeTop() { if (layers.length) history.back(); }
  function closeLayers(n) { n = Math.min(n || layers.length, layers.length); if (n > 0) history.go(-n); }
  window.addEventListener('popstate', (e) => {
    const target = (e.state && e.state.layer) || 0;
    while (layers.length > target) destroyLayer(layers.pop());
    if (App.router) App.router.sync();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && layers.length) closeTop(); });
  function refreshLayers() { layers.forEach((l) => l.refresh && l.refresh()); }
  function topLayer() { return layers[layers.length - 1]; }

  function confirmDialog({ title, body = '', ok = '확인', cancel = '취소', danger = false }) {
    // 다이얼로그가 실제로 닫힌 뒤(popstate 처리 후)에 결과를 돌려줘서, 이어지는 closeTop()이 꼬이지 않게 한다.
    return new Promise((resolve) => {
      let result = false;
      const entry = openSheet({
        title, cls: 'dialog',
        body: `<p class="dialog-text">${body}</p>`,
        foot: `<button type="button" class="btn ghost" data-close>${esc(cancel)}</button>
               <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
        onClose: () => setTimeout(() => resolve(result), 0),
      });
      $('[data-ok]', entry.wrap).addEventListener('click', () => { result = true; closeTop(); });
    });
  }

  /* ---------- 액션 위임 ---------- */
  const actions = {};
  const on = (name, fn) => { actions[name] = fn; };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'A') e.preventDefault();
    fn(el, e);
  });

  Object.assign(App, {
    $, $$, esc, uid, debounce, clone, num, toHalf,
    CATS, CAT, AREAS, PRIORITY, WAIT, WAIT_HINT, MOVES,
    DOW_KEYS, DOW_KO, DOW_JA, WEEK_ORDER,
    toMin, fmtMin, jstNow, dowOf, addDays, diffDays, dateRange, md, mdDot,
    dayWin, hasHours, statusAt, statusNow, hoursText, hoursExtra, closuresOn,
    hasLoc, distKm, walkMin, segText, gmapPlace, gmapDir, gmapRoute, naverPlace,
    yen, krw, icon, toast, copyText,
    UI: { openSheet, closeTop, closeLayers, refreshLayers, topLayer, confirm: confirmDialog, layers },
    actions, on,
  });
})(window.App);

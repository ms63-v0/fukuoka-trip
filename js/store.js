/* 후쿠오카 여행 노트 — 데이터 저장소 (localStorage) + 예시 데이터 */
(function (App) {
  'use strict';
  const { uid, clone, DOW_KEYS, dateRange, dowOf, hasLoc, closuresOn } = App;

  const KEY = 'fukuoka-trip:v1';
  const SCHEMA = 1;
  let state = null;
  const listeners = new Set();

  /* ---------- 기본 형태 ---------- */
  function blankPlace(cat = 'food') {
    return {
      id: uid('p'), cat, name: '', local: '', sub: '', area: '', priority: 2,
      address: '', lat: null, lng: null,
      phone: '', website: '', gmap: '', nmap: '', image: '',
      hours: {}, hoursNote: '',
      wait: { level: null, method: '', reserve: '', note: '' },
      menu: [], items: [],
      pay: { cash: false, card: false, ic: false, taxfree: false, kmenu: false },
      memo: '', visited: false, createdAt: Date.now(),
    };
  }
  function blankItem() {
    return { id: uid('i'), time: '', end: '', placeId: null, title: '', note: '', move: { mode: '', min: '', note: '' }, done: false };
  }
  function blankFlight(dep, arr) {
    return { airline: '', no: '', depAt: '', depAirport: dep, arrAt: '', arrAirport: arr, booking: '', note: '' };
  }
  function defaultChecklist() {
    const rows = [
      ['서류', '여권 (유효기간 확인)'], ['서류', 'Visit Japan Web 등록 · 입국 QR 캡처'], ['서류', '항공권 e티켓 저장'],
      ['서류', '숙소 예약 확인서 저장'], ['서류', '여행자 보험'],
      ['돈', '엔화 환전'], ['돈', '해외결제 카드 / 트래블카드 확인'],
      ['기기', 'eSIM 또는 포켓와이파이'], ['기기', '돼지코 (일본은 11자 A타입, 100V)'], ['기기', '보조배터리 · 충전 케이블'],
      ['짐', '상비약'], ['짐', '접이식 우산'], ['짐', '쇼핑용 에코백'],
    ];
    return rows.map(([group, text]) => ({ id: uid('c'), group, text, done: false }));
  }
  function defaultContacts() {
    return [
      { id: uid('k'), name: '경찰', phone: '110', note: '일본 국내' },
      { id: uid('k'), name: '구급차 · 화재', phone: '119', note: '일본 국내' },
      { id: uid('k'), name: '주후쿠오카 대한민국 총영사관', phone: '+81-92-771-0461', note: '출발 전 번호 재확인' },
      { id: uid('k'), name: '외교부 영사콜센터', phone: '+82-2-3210-0404', note: '24시간' },
    ];
  }
  function emptyState() {
    // 공개 저장소에 실제 여행 날짜를 남기지 않도록 기본값은 "일주일 뒤 2박 3일". 실제 날짜는 준비 탭에서 설정 → 동기화로 공유.
    const start = App.addDays(App.jstNow().date, 7), end = App.addDays(start, 2);
    const days = {};
    dateRange(start, end).forEach((d) => (days[d] = { memo: '', items: [] }));
    return {
      schema: SCHEMA,
      trip: { title: '후쿠오카', start, end, rate100: 920, center: { lat: 33.5902, lng: 130.4017 } },
      places: [],
      days,
      info: {
        flights: { out: blankFlight('인천 ICN', '후쿠오카 FUK'), back: blankFlight('후쿠오카 FUK', '인천 ICN') },
        stay: { name: '', local: '', address: '', lat: null, lng: null, checkIn: '15:00', checkOut: '11:00', booking: '', phone: '', note: '' },
        checklist: defaultChecklist(),
        notes: [],
        contacts: defaultContacts(),
      },
      meta: { sample: false, updatedAt: Date.now(), theme: 'system' },
    };
  }

  /* ---------- 예시 데이터 (모두 sample:true, 실제 정보와 다를 수 있음) ---------- */
  function week(open, close, x = {}) {
    const h = {};
    DOW_KEYS.forEach((k) => (h[k] = { closed: false, open, close, bStart: x.bStart || '', bEnd: x.bEnd || '', lo: x.lo || '' }));
    (x.closed || []).forEach((k) => (h[k] = { closed: true }));
    return h;
  }
  function P(o) {
    const p = Object.assign(blankPlace(o.cat), o, { sample: true });
    p.wait = Object.assign(blankPlace().wait, o.wait || {});
    p.pay = Object.assign(blankPlace().pay, o.pay || {});
    p.menu = (o.menu || []).map((m) => Object.assign({ id: uid('m'), note: '', pick: false }, m));
    p.items = (o.items || []).map((m) => Object.assign({ id: uid('s'), qty: 1, bought: false }, m));
    return p;
  }
  function sampleState() {
    const s = emptyState();
    const pl = {
      ichiran: P({ cat: 'food', name: '이치란 본점', local: '一蘭 本社総本店', sub: '라멘', area: '나카스', priority: 3,
        address: '福岡県福岡市博多区中洲5-3-2', lat: 33.5926, lng: 130.4057, hours: week('00:00', '24:00'),
        hoursNote: '연중무휴 (예시)', wait: { level: 2, method: '현장 줄서기 · 식권 자판기', reserve: '불가', note: '저녁 피크엔 줄이 길어요. 오전 일찍 추천.' },
        menu: [{ name: '천연 돈코츠 라멘', price: 980, pick: true }, { name: '카에다마 (면 추가)', price: 210 }, { name: '반숙 소금 달걀', price: 140 }],
        pay: { cash: true, card: true, kmenu: true } }),
      issou: P({ cat: 'food', name: '하카타 잇소우', local: '博多一双 博多駅東本店', sub: '라멘', area: '하카타역', priority: 3,
        address: '福岡県福岡市博多区博多駅東3-1-6', lat: 33.5893, lng: 130.4248, hours: week('11:00', '24:00'),
        wait: { level: 3, method: '현장 줄서기', reserve: '불가', note: '거품 돈코츠로 유명. 오픈 전 도착 추천.' },
        menu: [{ name: '라멘', price: 850, pick: true }, { name: '아지타마 라멘', price: 1000 }], pay: { cash: true } }),
      shinshin: P({ cat: 'food', name: '신신 라멘 텐진본점', local: 'ShinShin 天神本店', sub: '라멘', area: '텐진', priority: 2,
        address: '福岡県福岡市中央区天神3-2-19', lat: 33.5928, lng: 130.3958,
        hours: week('11:00', '23:00', { bStart: '15:00', bEnd: '17:00', lo: '22:30', closed: ['sun'] }),
        hoursNote: '일요일 휴무 (예시)', wait: { level: 2, method: '현장 줄서기', reserve: '불가' },
        menu: [{ name: '하카타 라멘', price: 780, pick: true }, { name: '야키메시', price: 600 }], pay: { cash: true, card: true } }),
      yatai: P({ cat: 'food', name: '나카스 야타이 거리', local: '中洲屋台', sub: '야타이', area: '나카스', priority: 3,
        address: '福岡県福岡市博多区中洲1丁目', lat: 33.5915, lng: 130.4047, hours: week('18:00', '01:00'),
        hoursNote: '비 오는 날·가게별 휴무 있음 (예시)', wait: { level: 1, method: '빈자리 착석', reserve: '불가', note: '현금 준비, 1인 1음료가 기본인 곳이 많아요.' },
        menu: [{ name: '야키라멘', price: 900 }, { name: '교자', price: 600, pick: true }], pay: { cash: true } }),
      manu: P({ cat: 'cafe', name: '마누 커피 다이묘점', local: 'manu coffee 大名店', sub: '커피', area: '다이묘', priority: 2,
        address: '福岡県福岡市中央区大名1-1-37', lat: 33.5873, lng: 130.3930, hours: week('10:00', '22:00', { closed: ['wed'] }),
        hoursNote: '수요일 휴무 (예시 — 일정 충돌 경고 확인용)', menu: [{ name: '카페라테', price: 600, pick: true }] }),
      starbucks: P({ cat: 'cafe', name: '스타벅스 다자이후 오모테산도점', local: 'スターバックス 太宰府天満宮表参道店', sub: '커피', area: '다자이후', priority: 2,
        address: '福岡県太宰府市宰府3-2-43', lat: 33.5203, lng: 130.5327, hours: week('08:00', '20:00'),
        memo: '나무 막대를 엮은 건물 외관이 유명.', menu: [{ name: '드립 커피', price: 450 }], pay: { card: true, ic: true } }),
      donki: P({ cat: 'shop', name: '돈키호테 나카스점', local: 'ドン・キホーテ 中洲店', sub: '드럭스토어', area: '나카스', priority: 3,
        address: '福岡県福岡市博多区中洲3-7-24', lat: 33.5938, lng: 130.4049, hours: week('00:00', '24:00'),
        items: [{ name: '휴족시간', price: 698, qty: 2 }, { name: '곤약젤리', price: 198, qty: 4 }, { name: '동전 파스', price: 980 }],
        pay: { cash: true, card: true, taxfree: true } }),
      canal: P({ cat: 'shop', name: '캐널시티 하카타', local: 'キャナルシティ博多', sub: '쇼핑몰', area: '캐널시티', priority: 2,
        address: '福岡県福岡市博多区住吉1-2', lat: 33.5897, lng: 130.4110, hours: week('10:00', '21:00'),
        memo: '분수 쇼 시간 확인하기.', items: [{ name: '무인양품 여행용품', price: 1500 }] , pay: { card: true, taxfree: true } }),
      chikagai: P({ cat: 'shop', name: '텐진 지하상가', local: '天神地下街', sub: '쇼핑몰', area: '텐진', priority: 2,
        address: '福岡県福岡市中央区天神2丁目地下', lat: 33.5900, lng: 130.3995, hours: week('10:00', '20:00'),
        items: [{ name: '양말 · 잡화', price: 1000 }] }),
      amu: P({ cat: 'shop', name: '아뮤플라자 하카타 (기념품)', local: 'アミュプラザ博多', sub: '기념품', area: '하카타역', priority: 3,
        address: '福岡県福岡市博多区博多駅中央街1-1', lat: 33.5899, lng: 130.4203, hours: week('10:00', '20:00'),
        items: [{ name: '하카타 토리몬 (博多通りもん)', price: 1200, qty: 2 }, { name: '멘타이코 튜브', price: 900 }] }),
      ohori: P({ cat: 'visit', name: '오호리 공원', local: '大濠公園', sub: '공원', area: '오호리공원', priority: 2,
        address: '福岡県福岡市中央区大濠公園1-2', lat: 33.5858, lng: 130.3766, hours: week('00:00', '24:00'),
        memo: '호수 한 바퀴 약 2km. 공원 안 스타벅스도 있음.' }),
      dazaifu: P({ cat: 'visit', name: '다자이후 텐만구', local: '太宰府天満宮', sub: '신사·절', area: '다자이후', priority: 3,
        address: '福岡県太宰府市宰府4-7-1', lat: 33.5215, lng: 130.5349, hours: week('06:30', '19:00'),
        menu: [{ name: '참배', price: 0 }, { name: '우메가에모치', price: 150, pick: true, note: '참배길 명물' }],
        memo: '니시테츠 텐진역 → 다자이후역. 오전에 가면 덜 붐벼요.' }),
      kushida: P({ cat: 'visit', name: '구시다 신사', local: '櫛田神社', sub: '신사·절', area: '나카스', priority: 1,
        address: '福岡県福岡市博多区上川端町1-41', lat: 33.5930, lng: 130.4106, hours: week('04:00', '22:00') }),
      tower: P({ cat: 'visit', name: '후쿠오카 타워', local: '福岡タワー', sub: '전망대', area: '모모치', priority: 2,
        address: '福岡県福岡市早良区百道浜2-3-26', lat: 33.5933, lng: 130.3515, hours: week('09:30', '22:00', { lo: '21:30' }),
        menu: [{ name: '전망대 입장 (성인)', price: 800 }] }),
      airport: P({ cat: 'base', name: '후쿠오카 공항 국제선', local: '福岡空港 国際線ターミナル', sub: '공항', area: '공항', priority: 1,
        address: '福岡県福岡市博多区大字下臼井767-1', lat: 33.5869, lng: 130.4509, memo: '국제선 → 하카타역은 버스가 편해요.' }),
    };
    s.places = Object.values(pl);
    s.info.stay = { name: '예시 숙소 (하카타역 근처)', local: '', address: '福岡県福岡市博多区博多駅前', lat: 33.5911, lng: 130.4180,
      checkIn: '15:00', checkOut: '11:00', booking: '', phone: '', note: '예시입니다. 실제 숙소로 바꿔 주세요.', sample: true };
    s.info.notes = [
      { id: uid('n'), title: '공항 → 하카타 이동 (예시)', body: '국제선 터미널 앞 버스 → 하카타역 약 20분.\n지하철은 국내선 터미널로 셔틀 이동 후 탑승.', link: '', sample: true },
      { id: uid('n'), title: '야타이 이용 팁 (예시)', body: '현금 준비 · 자리 회전이 빠름 · 비 오는 날 쉬는 가게 많음', link: '', sample: true },
    ];
    const [d1, d2, d3] = dateRange(s.trip.start, s.trip.end);
    const it = (time, placeId, extra = {}) => Object.assign(blankItem(), { time, placeId, sample: true }, extra);
    s.days[d1] = { memo: '도착일 · 하카타/나카스', items: [
      it('10:30', pl.airport.id, { note: '입국 심사 후 버스', move: { mode: 'bus', min: '20', note: '' } }),
      it('11:30', '__stay', { note: '짐 맡기기' }),
      it('12:30', pl.issou.id),
      it('14:00', pl.canal.id, { end: '16:00' }),
      it('16:30', pl.kushida.id),
      it('18:30', pl.yatai.id),
      it('20:30', pl.donki.id),
    ] };
    s.days[d2] = { memo: '다자이후 반나절 + 텐진', items: [
      it('09:30', pl.dazaifu.id, { move: { mode: 'walk', min: '5', note: '' } }),
      it('11:30', pl.starbucks.id, { move: { mode: 'train', min: '40', note: '니시테츠' } }),
      it('14:30', pl.ohori.id),
      it('16:00', pl.manu.id),
      it('17:30', pl.chikagai.id),
      it('19:30', pl.shinshin.id),
    ] };
    s.days[d3] = { memo: '출국일 · 기념품', items: [
      it('10:00', pl.tower.id, { move: { mode: 'bus', min: '30', note: '' } }),
      it('12:30', pl.ichiran.id),
      it('14:00', pl.amu.id),
      it('16:00', pl.airport.id, { title: '', note: '출발 2시간 전 도착' }),
    ] };
    s.meta.sample = true;
    return s;
  }

  /* ---------- 저장 / 불러오기 ---------- */
  function normalize(s) {
    const base = emptyState();
    const out = Object.assign(base, s);
    out.trip = Object.assign(base.trip, s.trip || {});
    out.info = Object.assign(emptyState().info, s.info || {});
    out.info.flights = Object.assign(emptyState().info.flights, (s.info || {}).flights || {});
    out.meta = Object.assign(emptyState().meta, s.meta || {});
    out.places = (s.places || []).map((p) => {
      const b = blankPlace(p.cat);
      const q = Object.assign(b, p);
      q.wait = Object.assign(b.wait, p.wait || {});
      q.pay = Object.assign(blankPlace().pay, p.pay || {});
      q.menu = p.menu || []; q.items = p.items || []; q.hours = p.hours || {};
      return q;
    });
    out.days = s.days || {};
    ensureDays(out);
    return out;
  }
  function ensureDays(s) {
    dateRange(s.trip.start, s.trip.end).forEach((d) => { if (!s.days[d]) s.days[d] = { memo: '', items: [] }; });
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = normalize(JSON.parse(raw)); return 'stored'; }
    } catch (e) { console.warn('저장 데이터를 읽지 못했어요', e); }
    state = sampleState();
    save(true, 'init');
    return 'sample';
  }
  let saveState = '저장됨';
  const saveHooks = new Set();
  // origin: 'local'(이 기기에서 수정) | 'remote'(동기화로 받은 내용) | 'init'(첫 실행 예시)
  function save(quiet, origin = 'local') {
    state.meta.updatedAt = Date.now();
    let ok = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      saveState = '저장됨';
    } catch (e) {
      ok = false;
      saveState = '저장 실패';
      if (!quiet) App.toast('저장 공간이 부족해요. 사진을 줄이거나 데이터를 내보내 주세요.');
    }
    document.querySelectorAll('[data-save-state]').forEach((el) => (el.textContent = saveState));
    if (ok) saveHooks.forEach((fn) => fn(origin));
  }
  const saveSoon = App.debounce(() => save(), 250);
  function commit(opts = {}) {
    saveSoon();
    if (!opts.silent) listeners.forEach((fn) => fn(opts));
  }
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const onSave = (fn) => { saveHooks.add(fn); return () => saveHooks.delete(fn); };
  // 동기화용: 기기별 설정(테마)을 뺀 데이터
  function snapshot() { const s = clone(state); delete s.meta.theme; return s; }
  // 동기화로 받은 데이터로 통째로 교체 (이 기기의 테마는 유지)
  function replaceAll(obj) {
    const theme = state.meta.theme;
    state = normalize(obj);
    state.meta.theme = theme;
    save(true, 'remote');
    listeners.forEach((fn) => fn({ remote: true }));
  }

  /* ---------- 조회 ---------- */
  const get = () => state;
  const tripDates = () => dateRange(state.trip.start, state.trip.end);
  function days() {
    ensureDays(state);
    return tripDates().map((date, idx) => Object.assign(state.days[date], { date, idx, dow: dowOf(date) }));
  }
  const day = (date) => state.days[date];
  const places = (cat) => state.places.filter((p) => !cat || p.cat === cat);
  const place = (id) => state.places.find((p) => p.id === id);
  function scheduleOf(placeId) {
    const out = [];
    tripDates().forEach((date, idx) => (state.days[date].items || []).forEach((item) => { if (item.placeId === placeId) out.push({ date, idx, item }); }));
    return out;
  }
  function stayLoc() {
    const s = state.info.stay;
    return { id: '__stay', cat: 'stay', name: s.name || '숙소', local: s.local, address: s.address, lat: s.lat, lng: s.lng, isStay: true };
  }
  function resolve(item) {
    if (!item) return null;
    if (item.placeId === '__stay') return stayLoc();
    if (item.placeId) return place(item.placeId) || null;
    return null;
  }
  function itemTitle(item) {
    const r = resolve(item);
    return (r && r.name) || item.title || '제목 없음';
  }
  const tripClosures = (p) => closuresOn(p, tripDates());

  /* ---------- 장소 변경 ---------- */
  function upsertPlace(p) {
    const i = state.places.findIndex((x) => x.id === p.id);
    if (i >= 0) state.places[i] = p; else state.places.push(p);
    commit();
  }
  function removePlace(id) {
    state.places = state.places.filter((p) => p.id !== id);
    Object.values(state.days).forEach((d) => (d.items = (d.items || []).filter((it) => it.placeId !== id)));
    commit();
  }
  function patchPlace(id, patch) { const p = place(id); if (!p) return; Object.assign(p, patch); commit(); }

  /* ---------- 일정 변경 ---------- */
  function addItem(date, item) { state.days[date].items.push(item); commit(); }
  function saveItem(date, item, fromDate) {
    if (fromDate && fromDate !== date) state.days[fromDate].items = state.days[fromDate].items.filter((x) => x.id !== item.id);
    const list = state.days[date].items;
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item; else list.push(item);
    commit();
  }
  function removeItem(date, id) { state.days[date].items = state.days[date].items.filter((x) => x.id !== id); commit(); }
  function moveItem(date, id, dir) {
    const list = state.days[date].items;
    const i = list.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit();
  }
  function sortDay(date) {
    state.days[date].items.sort((a, b) => (App.toMin(a.time) ?? 9999) - (App.toMin(b.time) ?? 9999));
    commit();
  }
  function setTripDates(start, end) {
    const old = days();
    const range = dateRange(start, end);
    if (!range.length) return false;
    const next = {};
    range.forEach((d, i) => (next[d] = old[i] ? { memo: old[i].memo, items: old[i].items } : { memo: '', items: [] }));
    old.slice(range.length).forEach((d) => { next[range[range.length - 1]].items.push(...d.items); });
    state.days = next;
    state.trip.start = start; state.trip.end = end;
    commit();
    return true;
  }

  /* ---------- 데이터 관리 ---------- */
  function clearSample() {
    state.places = state.places.filter((p) => !p.sample);
    Object.values(state.days).forEach((d) => {
      d.items = (d.items || []).filter((it) => !it.sample);
      if (!d.items.length) d.memo = '';
    });
    if (state.info.stay.sample) state.info.stay = emptyState().info.stay;
    state.info.notes = state.info.notes.filter((n) => !n.sample);
    state.meta.sample = false;
    commit();
  }
  function loadSample() { const theme = state.meta.theme; state = sampleState(); state.meta.theme = theme; save(); commit(); }
  function resetAll() { const theme = state.meta.theme; state = emptyState(); state.meta.theme = theme; save(); commit(); }
  function exportData() { return JSON.stringify(Object.assign({ app: 'fukuoka-trip', exportedAt: new Date().toISOString() }, state), null, 2); }
  function importData(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.places) || !obj.trip) throw new Error('이 앱에서 내보낸 파일이 아니에요.');
    delete obj.app; delete obj.exportedAt;
    state = normalize(obj);
    save();
    commit();
  }

  App.S = {
    load, save, commit, subscribe, onSave, snapshot, replaceAll, get, tripDates, days, day, places, place, scheduleOf, resolve, itemTitle, stayLoc, tripClosures,
    upsertPlace, removePlace, patchPlace, addItem, saveItem, removeItem, moveItem, sortDay, setTripDates,
    clearSample, loadSample, resetAll, exportData, importData, blankPlace, blankItem, hasLoc,
    saveState: () => saveState,
  };
})(window.App);

/* 후쿠오카 여행 노트 — 기기 간 동기화 (Supabase RPC + 동기화 코드)
   - 로컬(localStorage)이 항상 원본이고, 저장할 때마다 몇 초 뒤 클라우드로 올려요.
   - 앱을 열거나 다시 볼 때, 그리고 1분마다 클라우드 버전을 확인해서 더 새로우면 받아요.
   - 두 기기가 동시에 고쳐서 버전이 어긋나면 어느 쪽을 남길지 물어봐요. */
(function (App) {
  'use strict';
  const { S, UI, esc, icon } = App;
  const CFG = window.TRIP_CONFIG || {};
  const META_KEY = 'fukuoka-trip:sync';
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (I, L, O, U 제외)

  let meta = readMeta();          // { code, version, dirty, lastSync }
  let status = meta.code ? 'idle' : 'off';
  let lastError = '';
  let busy = false;
  let pushTimer = null;
  let editSeq = 0;
  let conflictOpen = false;
  const listeners = new Set();

  const configured = () => !!(CFG.supabaseUrl && CFG.supabaseKey);
  const connected = () => configured() && !!meta.code;

  function readMeta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } }
  function writeMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ } }
  function setStatus(s, err = '') { status = s; lastError = err; paint(); listeners.forEach((fn) => fn()); }

  /* ---------- 코드 ---------- */
  function newCode() {
    const bytes = new Uint8Array(25);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
  }
  function normCode(raw) {
    return String(raw || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  }
  const prettyCode = (c) => (c || '').match(/.{1,5}/g)?.join('-') || '';
  const linkFor = (c) => `${(CFG.siteUrl || location.origin + location.pathname).replace(/#.*$/, '')}#sync=${c}`;

  /* ---------- Supabase RPC ---------- */
  async function rpc(fn, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', apikey: CFG.supabaseKey };
    if (/^eyJ/.test(CFG.supabaseKey)) headers.Authorization = 'Bearer ' + CFG.supabaseKey;
    const r = await fetch(`${CFG.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers, body: JSON.stringify(body), keepalive: !!opts.keepalive,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const e = new Error(`${fn} ${r.status} ${text.slice(0, 160)}`);
      e.status = r.status;
      throw e;
    }
    return r.json();
  }
  const pullRow = (code) => rpc('trip_pull', { p_code: code }).then((rows) => (Array.isArray(rows) ? rows[0] : null) || null);
  const pushRow = (code, data, base, opts) => rpc('trip_push', { p_code: code, p_data: data, p_base_version: base }, opts).then((rows) => rows[0]);

  /* ---------- 올리기 / 받기 ---------- */
  function schedulePush(ms = 1500) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(doPush, ms);
  }
  async function doPush(force = false) {
    if (!connected()) return;
    if (busy) { schedulePush(1200); return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    busy = true;
    const seq = editSeq;
    setStatus('pushing');
    try {
      const res = await pushRow(meta.code, S.snapshot(), force ? null : (meta.version ?? null));
      if (res && res.out_ok) {
        meta.version = Number(res.out_version);
        meta.lastSync = Date.now();
        meta.dirty = editSeq !== seq;
        writeMeta();
        setStatus(meta.dirty ? 'waiting' : 'idle');
        if (meta.dirty) schedulePush(800);
      } else {
        busy = false;
        await resolveConflict();
        return;
      }
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    } finally {
      busy = false;
    }
  }
  async function doPull({ quiet = true } = {}) {
    if (!connected() || busy || conflictOpen) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    busy = true;
    try {
      const row = await pullRow(meta.code);
      busy = false;
      if (!row) { await doPush(true); return; } // 클라우드에 없으면 이 기기 내용으로 다시 만든다
      const v = Number(row.out_version);
      if (v > (meta.version || 0)) {
        if (meta.dirty) { await resolveConflict(row); return; }
        S.replaceAll(row.out_data);
        meta.version = v; meta.lastSync = Date.now(); writeMeta();
        setStatus('idle');
        if (!quiet) App.toast('다른 기기에서 바뀐 내용을 받았어요');
        else App.toast('다른 기기의 최신 내용으로 업데이트했어요');
      } else {
        meta.lastSync = Date.now(); writeMeta();
        setStatus(meta.dirty ? 'waiting' : 'idle');
        if (meta.dirty) schedulePush(300);
        else if (!quiet) App.toast('이미 최신 상태예요');
      }
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    } finally {
      busy = false;
    }
  }
  function resolveConflict(row) {
    if (conflictOpen) return Promise.resolve();
    conflictOpen = true;
    setStatus('conflict');
    return new Promise((resolve) => {
      let choice = null;
      const entry = UI.openSheet({
        title: '동기화 충돌', cls: 'dialog',
        body: `<p class="dialog-text">다른 기기에서 먼저 저장한 내용이 있어요. 어느 쪽을 남길까요?<br><span class="muted small">남기지 않은 쪽의 최근 수정은 사라져요.</span></p>`,
        foot: `<button type="button" class="btn ghost" data-c="mine">이 기기 내용 남기기</button>
               <button type="button" class="btn primary" data-c="theirs">다른 기기 내용 받기</button>`,
        onClose: () => setTimeout(async () => {
          conflictOpen = false;
          if (choice === 'mine') await doPush(true);
          else if (choice === 'theirs') {
            try {
              const r = row || (await pullRow(meta.code));
              if (r) { S.replaceAll(r.out_data); meta.version = Number(r.out_version); }
              meta.dirty = false; meta.lastSync = Date.now(); writeMeta();
              setStatus('idle');
              App.toast('다른 기기 내용으로 바꿨어요');
            } catch (e) { setStatus('error', e.message); }
          } else setStatus('waiting');
          resolve();
        }, 0),
      });
      entry.sheet.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { choice = b.dataset.c; UI.closeTop(); }));
    });
  }

  /* ---------- 연결 / 해제 ---------- */
  async function startNew() {
    if (!configured()) return;
    const code = newCode();
    setStatus('pushing');
    try {
      const res = await pushRow(code, S.snapshot(), null);
      meta = { code, version: Number(res.out_version), dirty: false, lastSync: Date.now() };
      writeMeta();
      setStatus('idle');
      App.toast('동기화를 시작했어요. 다른 기기에서 이 코드로 연결하세요.');
    } catch (e) {
      setStatus('error', e.message);
      App.toast('동기화 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }
  async function connect(raw) {
    const code = normCode(raw);
    if (code.length < 20) { App.toast('동기화 코드를 다시 확인해 주세요 (25자리).'); return false; }
    setStatus('pulling');
    try {
      const row = await pullRow(code);
      if (!row) { setStatus(meta.code ? 'idle' : 'off'); App.toast('이 코드로 저장된 데이터가 없어요. 코드를 다시 확인해 주세요.'); return false; }
      S.replaceAll(row.out_data);
      meta = { code, version: Number(row.out_version), dirty: false, lastSync: Date.now() };
      writeMeta();
      setStatus('idle');
      App.toast('연결했어요. 이제 이 기기도 자동으로 동기화돼요.');
      return true;
    } catch (e) {
      setStatus(meta.code ? 'error' : 'off', e.message);
      App.toast('동기화 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
      return false;
    }
  }
  function disconnect() {
    clearTimeout(pushTimer);
    meta = {};
    writeMeta();
    setStatus('off');
  }

  /* ---------- 상태 표시 ---------- */
  const LABEL = {
    off: null, idle: '동기화됨', waiting: '동기화 대기', pushing: '동기화 중…', pulling: '받는 중…',
    offline: '오프라인 · 연결되면 동기화', conflict: '동기화 충돌', error: '동기화 오류',
  };
  function ago(t) {
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    return new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function paint() {
    const label = connected() ? LABEL[status] : null;
    document.querySelectorAll('[data-save-state]').forEach((el) => {
      if (label) el.textContent = label;
      const wrap = el.closest('.save-state');
      if (wrap) { wrap.dataset.sync = connected() ? status : 'local'; wrap.title = connected() ? `마지막 동기화 ${ago(meta.lastSync)}` : '이 기기에만 저장'; }
    });
  }

  /* ---------- 준비 탭 섹션 ---------- */
  function sectionHTML() {
    if (!configured()) {
      return `<section class="card-sec" id="sec-sync"><h2 class="sec-h">${icon('upload')}기기 동기화</h2>
        <p class="muted small">동기화 서버가 아직 설정되지 않았어요. <span class="mono">js/config.js</span>에 Supabase 주소와 공개 키를 넣으면 켜져요.</p></section>`;
    }
    if (!meta.code) {
      return `<section class="card-sec" id="sec-sync"><h2 class="sec-h">${icon('upload')}기기 동기화</h2>
        <p class="muted small">PC에서 입력한 내용을 폰에서 바로 보려면 한 기기에서 동기화를 시작하고, 다른 기기에서 그 코드로 연결하세요.</p>
        <div class="sync-choice">
          <div class="sync-opt">
            <strong>처음 시작하는 기기</strong>
            <p class="muted small">이 기기의 지금 데이터를 클라우드에 올리고 동기화 코드를 만들어요.</p>
            <button type="button" class="btn primary" data-act="sync-start" ${status === 'pushing' ? 'disabled' : ''}>${icon('upload')}이 기기 데이터로 시작</button>
          </div>
          <form class="sync-opt" id="syncJoin">
            <strong>이미 코드가 있는 경우</strong>
            <p class="muted small">이 기기 데이터는 클라우드 내용으로 바뀌어요.</p>
            <div class="sync-join"><input class="input mono" id="syncCode" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="동기화 코드">
            <button type="submit" class="btn" ${status === 'pulling' ? 'disabled' : ''}>연결</button></div>
          </form>
        </div>
      </section>`;
    }
    return `<section class="card-sec" id="sec-sync"><h2 class="sec-h">${icon('upload')}기기 동기화
        <span class="sync-pill" data-sync="${status}"><i></i>${esc(LABEL[status] || '')}</span></h2>
      ${status === 'error' ? `<p class="callout bad">${icon('alert')}<span>동기화에 실패했어요. 잠시 후 자동으로 다시 시도해요.${lastError ? `<br><span class="mono small">${esc(lastError)}</span>` : ''}</span></p>` : ''}
      <div class="sync-code">
        <span class="eyebrow">동기화 코드 · 비밀번호처럼 다뤄 주세요</span>
        <strong class="mono">${esc(prettyCode(meta.code))}</strong>
      </div>
      <div class="data-btns">
        <button type="button" class="btn sm" data-act="copy" data-copy="${esc(prettyCode(meta.code))}">${icon('copy')}코드 복사</button>
        <button type="button" class="btn sm" data-act="copy" data-copy="${esc(linkFor(meta.code))}">${icon('link')}연결 링크 복사</button>
        <button type="button" class="btn sm" data-act="sync-qr">QR로 폰 연결</button>
      </div>
      <p class="muted small">마지막 동기화 ${esc(ago(meta.lastSync) || '—')} · 다른 기기에서는 준비 → 기기 동기화 → 코드로 연결, 또는 폰 카메라로 QR을 찍으세요.</p>
      <div class="data-btns">
        <button type="button" class="btn sm" data-act="sync-now">${icon('download')}지금 동기화</button>
        <button type="button" class="btn sm ghost danger-text" data-act="sync-off">이 기기 연결 해제</button>
      </div>
    </section>`;
  }
  function wire(root) {
    const form = root.querySelector('#syncJoin');
    if (form && !form._wired) {
      form._wired = true;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ok = await UI.confirm({ title: '이 기기 연결', body: '이 기기의 지금 데이터가 클라우드 내용으로 바뀌어요. 계속할까요?', ok: '연결' });
        if (ok) connect(root.querySelector('#syncCode').value);
      });
    }
  }
  function rerenderSection() {
    const el = document.getElementById('sec-sync');
    if (!el) return;
    el.outerHTML = sectionHTML();
    wire(document.getElementById('view'));
  }

  function loadQrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
      s.onload = () => resolve(window.qrcode);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function showQr() {
    const link = linkFor(meta.code);
    let img = '';
    try {
      const qrcode = await loadQrLib();
      const qr = qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      img = `<img class="qr" src="${qr.createDataURL(6, 2)}" alt="동기화 연결 QR 코드">`;
    } catch (e) { img = `<p class="muted">QR을 만들지 못했어요. 아래 링크를 복사해 폰으로 보내 주세요.</p>`; }
    UI.openSheet({
      title: 'QR로 폰 연결', cls: 'dialog',
      body: `<div class="qr-wrap">${img}<p class="muted small">폰 카메라로 찍으면 사이트가 열리고 연결할지 물어봐요. 이 QR은 동기화 코드와 같아서 다른 사람에게 보여 주지 마세요.</p>
        <p class="mono small qr-link">${esc(link)}</p></div>`,
      foot: `<button type="button" class="btn" data-act="copy" data-copy="${esc(link)}">${icon('copy')}링크 복사</button><button type="button" class="btn primary" data-close>닫기</button>`,
    });
  }

  /* ---------- 링크로 열었을 때 (#sync=CODE) ---------- */
  let pendingCode = null;
  function takeLinkCode() {
    const m = /^#sync=([0-9A-Za-z-]+)/.exec(location.hash);
    if (!m) return;
    pendingCode = normCode(m[1]);
    history.replaceState(null, '', location.pathname + location.search + '#info');
  }
  takeLinkCode();

  async function askPending() {
    if (!pendingCode || !configured()) return;
    const code = pendingCode;
    pendingCode = null;
    if (meta.code === code) { App.toast('이미 이 코드로 연결돼 있어요'); return; }
    const ok = await UI.confirm({
      title: '이 기기를 연결할까요?',
      body: `동기화 코드 <strong class="mono">${esc(prettyCode(code).slice(0, 11))}…</strong> 로 연결하면 이 기기의 데이터가 클라우드 내용으로 바뀌어요.`,
      ok: '연결',
    });
    if (ok) connect(code);
  }

  /* ---------- 시작 ---------- */
  function init() {
    S.onSave((origin) => {
      if (!connected() || origin !== 'local') return;
      editSeq++;
      meta.dirty = true;
      writeMeta();
      if (status !== 'conflict') setStatus('waiting');
      schedulePush();
    });
    listeners.add(rerenderSection);
    paint();
    if (connected()) doPull();
    setTimeout(askPending, 400);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') doPull(); });
    window.addEventListener('online', () => { if (meta.dirty) doPush(); else doPull(); });
    window.addEventListener('offline', () => { if (connected()) setStatus('offline'); });
    window.addEventListener('pagehide', () => {
      if (!connected() || !meta.dirty) return;
      try { pushRow(meta.code, S.snapshot(), meta.version ?? null, { keepalive: true }).catch(() => {}); } catch (e) { /* best effort */ }
    });
    setInterval(() => { if (document.visibilityState === 'visible') doPull(); }, 60 * 1000);
    setInterval(paint, 30 * 1000);
  }

  App.on('sync-start', async () => {
    const ok = await UI.confirm({ title: '동기화 시작', body: '이 기기의 지금 데이터를 클라우드에 올리고 동기화 코드를 만들어요. 예시 데이터가 남아 있다면 먼저 지우는 걸 추천해요.', ok: '시작' });
    if (ok) startNew();
  });
  App.on('sync-now', () => { if (meta.dirty) doPush(); else doPull({ quiet: false }); });
  App.on('sync-qr', () => showQr());
  App.on('sync-off', async () => {
    const ok = await UI.confirm({ title: '연결 해제', body: '이 기기만 동기화에서 빠져요. 이 기기의 데이터와 클라우드 데이터는 그대로 남아요. 다시 연결하려면 코드가 필요해요.', ok: '연결 해제', danger: true });
    if (ok) { disconnect(); App.toast('이 기기의 동기화를 껐어요'); }
  });

  App.Sync = { init, configured, connected, sectionHTML, wire, paint, status: () => status, doPull, doPush };
})(window.App);

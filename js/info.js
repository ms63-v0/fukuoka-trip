/* 후쿠오카 여행 노트 — 준비 화면: 여행 정보, 항공, 숙소, 체크리스트, 정보 메모, 비상 연락처, 데이터 */
(function (App) {
  'use strict';
  const { S, UI, esc, icon, uid, num, krw, yen, md, DOW_KO, dowOf, hasLoc } = App;
  let root = null;

  const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
  const syncWarn = () => (App.Sync.connected() ? '<br><strong>동기화된 다른 기기에서도 똑같이 바뀌어요.</strong>' : '');
  const bind = (path, extra = '') => `data-bind="${path}" value="${esc(getPath(S.get(), path) ?? '')}" ${extra}`;

  /* ---------- 섹션 ---------- */
  function tripSec() {
    const t = S.get().trip;
    return `<section class="card-sec" id="sec-trip">
      <h2 class="sec-h">${icon('calendar')}여행 정보</h2>
      <label class="field"><span class="field-label">여행 이름</span><input class="input" ${bind('trip.title')} placeholder="후쿠오카"></label>
      <div class="row2">
        <label class="field"><span class="field-label">출발일</span><input type="date" class="input" id="tripStart" value="${t.start}"></label>
        <label class="field"><span class="field-label">돌아오는 날</span><input type="date" class="input" id="tripEnd" value="${t.end}"></label>
      </div>
      <div class="rate">
        <label class="field"><span class="field-label">환율 <em>100엔당 원화</em></span>
          <span class="input-affix"><span>100엔 =</span><input class="input" id="rate100" inputmode="decimal" value="${esc(t.rate100)}"><span>원</span></span></label>
        <div class="conv two">
          <label class="conv-in"><span>¥</span><input id="cvYen" inputmode="numeric" placeholder="엔" aria-label="엔"></label>
          <span class="conv-eq">⇄</span>
          <label class="conv-in"><span>₩</span><input id="cvKrw" inputmode="numeric" placeholder="원" aria-label="원"></label>
        </div>
      </div>
    </section>`;
  }
  function flightCard(key, label) {
    const base = `info.flights.${key}`;
    return `<div class="flight">
      <h3><span class="flight-dir">${label}</span></h3>
      <div class="row2">
        <label class="field"><span class="field-label">항공사</span><input class="input" ${bind(base + '.airline')} placeholder="예: 진에어"></label>
        <label class="field"><span class="field-label">편명</span><input class="input mono" ${bind(base + '.no')} placeholder="LJ221"></label>
      </div>
      <div class="row2">
        <label class="field"><span class="field-label">출발</span><input class="input" ${bind(base + '.depAirport')}></label>
        <label class="field"><span class="field-label">출발 시각</span><input type="datetime-local" class="input" ${bind(base + '.depAt')}></label>
      </div>
      <div class="row2">
        <label class="field"><span class="field-label">도착</span><input class="input" ${bind(base + '.arrAirport')}></label>
        <label class="field"><span class="field-label">도착 시각</span><input type="datetime-local" class="input" ${bind(base + '.arrAt')}></label>
      </div>
      <div class="row2">
        <label class="field"><span class="field-label">예약번호</span><input class="input mono" ${bind(base + '.booking')} placeholder="ABC123"></label>
        <label class="field"><span class="field-label">메모</span><input class="input" ${bind(base + '.note')} placeholder="수하물 15kg, 좌석 12A"></label>
      </div>
    </div>`;
  }
  function flightSec() {
    return `<section class="card-sec" id="sec-flight">
      <h2 class="sec-h">${icon('plane')}항공편</h2>
      <div class="flights">${flightCard('out', '가는 편')}${flightCard('back', '오는 편')}</div>
    </section>`;
  }
  function staySec() {
    const s = S.get().info.stay;
    return `<section class="card-sec" id="sec-stay">
      <h2 class="sec-h">${icon('bed')}숙소</h2>
      ${s.sample ? `<p class="callout">${icon('info')}<span>예시 숙소예요. 실제 숙소 정보로 바꿔 주세요.</span></p>` : ''}
      <label class="field"><span class="field-label">숙소 이름</span><input class="input" ${bind('info.stay.name')} placeholder="예: ○○ 호텔 하카타"></label>
      <label class="field"><span class="field-label">주소</span><input class="input" lang="ja" ${bind('info.stay.address')} placeholder="福岡県福岡市…"></label>
      <div class="stay-loc ${hasLoc(s) ? 'is-set' : ''}">
        ${icon('pin')}<span>${hasLoc(s) ? `지도에 숙소 핀이 있어요 <span class="muted mono">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</span>` : '아직 지도 위치가 없어요'}</span>
        <button type="button" class="btn sm" data-act="stay-loc">${hasLoc(s) ? '위치 조정' : '위치 설정'}</button>
      </div>
      <div class="row2">
        <label class="field"><span class="field-label">체크인</span><input type="time" class="input" ${bind('info.stay.checkIn')}></label>
        <label class="field"><span class="field-label">체크아웃</span><input type="time" class="input" ${bind('info.stay.checkOut')}></label>
      </div>
      <div class="row2">
        <label class="field"><span class="field-label">예약번호</span><input class="input mono" ${bind('info.stay.booking')}></label>
        <label class="field"><span class="field-label">전화</span><input type="tel" class="input" ${bind('info.stay.phone')}></label>
      </div>
      <label class="field"><span class="field-label">메모</span><input class="input" ${bind('info.stay.note')} placeholder="짐 보관 가능, 조식 7시~"></label>
    </section>`;
  }
  function checklistSec() {
    const cl = S.get().info.checklist;
    const groups = [...new Set(cl.map((c) => c.group || '기타'))];
    const done = cl.filter((c) => c.done).length;
    return `<section class="card-sec" id="sec-check">
      <h2 class="sec-h">${icon('check')}준비 체크리스트 <span class="muted mono">${done}/${cl.length}</span></h2>
      <span class="bar"><i style="width:${cl.length ? Math.round((done / cl.length) * 100) : 0}%"></i></span>
      ${groups.map((g) => `<div class="cl-group"><h3>${esc(g)}</h3><ul class="cl">${cl.filter((c) => (c.group || '기타') === g).map((c) => `
        <li class="${c.done ? 'is-done' : ''}">
          <label><input type="checkbox" data-cl="${c.id}" ${c.done ? 'checked' : ''}><span class="buy-box">${icon('check')}</span><span class="cl-text">${esc(c.text)}</span></label>
          <button type="button" class="icon-btn xs" data-act="cl-del" data-id="${c.id}" aria-label="항목 삭제">${icon('x')}</button>
        </li>`).join('')}</ul></div>`).join('')}
      <form class="cl-add" id="clAdd">
        <input class="input sm" id="clGroup" list="clGroups" placeholder="분류" value="기타" aria-label="분류">
        <datalist id="clGroups">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>
        <input class="input sm" id="clText" placeholder="할 일 · 준비물 추가" aria-label="항목">
        <button type="submit" class="btn sm primary">${icon('plus')}추가</button>
      </form>
    </section>`;
  }
  function notesSec() {
    const notes = S.get().info.notes;
    return `<section class="card-sec" id="sec-notes">
      <h2 class="sec-h">${icon('note')}정보 메모 <span class="muted">${notes.length}</span>
        <button type="button" class="btn sm" data-act="note-add">${icon('plus')}메모 추가</button></h2>
      <p class="muted small">교통 패스, 면세 방법, 블로그에서 본 팁처럼 장소가 아닌 정보를 모아 두세요.</p>
      ${notes.length ? `<div class="notes">${notes.map((n) => `
        <article class="note-card">
          <header><h3>${esc(n.title || '제목 없음')}</h3>${n.sample ? '<span class="pill tone-line">예시</span>' : ''}
            <button type="button" class="icon-btn xs" data-act="note-edit" data-id="${n.id}" aria-label="메모 수정">${icon('edit')}</button></header>
          ${n.body ? `<p>${esc(n.body)}</p>` : ''}
          ${n.link ? `<a href="${esc(n.link)}" target="_blank" rel="noopener" class="note-link">${icon('link')}${esc(n.link.replace(/^https?:\/\//, '').slice(0, 42))}</a>` : ''}
        </article>`).join('')}</div>` : '<div class="empty small"><strong>메모가 없어요</strong><p>필요한 정보를 메모로 남겨 보세요.</p></div>'}
    </section>`;
  }
  function contactsSec() {
    const cs = S.get().info.contacts;
    return `<section class="card-sec" id="sec-contacts">
      <h2 class="sec-h">${icon('phone')}비상 연락처</h2>
      <ul class="contacts">${cs.map((c) => `
        <li>
          <div><strong>${esc(c.name)}</strong>${c.note ? `<span class="muted">${esc(c.note)}</span>` : ''}</div>
          <span class="mono phone">${esc(c.phone)}</span>
          <button type="button" class="icon-btn xs" data-act="copy" data-copy="${esc(c.phone)}" aria-label="번호 복사">${icon('copy')}</button>
          <button type="button" class="icon-btn xs" data-act="ct-del" data-id="${c.id}" aria-label="연락처 삭제">${icon('x')}</button>
        </li>`).join('')}</ul>
      <form class="cl-add" id="ctAdd">
        <input class="input sm" id="ctName" placeholder="이름 (예: 숙소 프런트)" aria-label="이름">
        <input class="input sm mono" id="ctPhone" placeholder="번호" inputmode="tel" aria-label="번호">
        <button type="submit" class="btn sm primary">${icon('plus')}추가</button>
      </form>
    </section>`;
  }
  function dataSec() {
    const m = S.get().meta;
    const updated = new Date(m.updatedAt);
    return `<section class="card-sec" id="sec-data">
      <h2 class="sec-h">${icon('download')}화면 · 데이터</h2>
      <div class="field"><span class="field-label">화면 테마</span>
        <div class="seg" role="radiogroup" aria-label="테마">
          ${[['system', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([k, v]) => `<label><input type="radio" name="theme" value="${k}" ${m.theme === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}
        </div>
      </div>
      <p class="muted small">${App.Sync.connected() ? '이 기기에 저장하고, 기기 동기화로 다른 기기와 자동으로 맞춰요.' : '지금은 이 브라우저에만 저장돼요. 다른 기기와 맞추려면 위의 기기 동기화를 켜세요.'} (마지막 저장 ${updated.toLocaleString('ko-KR')})</p>
      <div class="data-btns">
        <button type="button" class="btn" data-act="data-export">${icon('download')}JSON 내보내기</button>
        <label class="btn">${icon('upload')}JSON 불러오기<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        <button type="button" class="btn ghost" data-act="data-sample">예시 데이터 다시 보기</button>
        <button type="button" class="btn ghost danger-text" data-act="data-reset">${icon('trash')}모두 초기화</button>
      </div>
    </section>`;
  }

  function render() {
    if (!root) return;
    root.innerHTML = `<div class="info-page">
      <header class="page-head"><div><p class="eyebrow">여행 준비</p><h1>준비 · 정보 모음</h1></div>
        <span class="save-state"><i></i><span data-save-state>${S.saveState()}</span></span></header>
      <div class="info-grid">
        <div class="info-col">${tripSec()}${flightSec()}${staySec()}</div>
        <div class="info-col">${App.Sync.sectionHTML()}${checklistSec()}${notesSec()}${contactsSec()}${dataSec()}</div>
      </div>
    </div>`;
    wire();
  }
  function rerender(id, fn) {
    const el = root && root.querySelector('#' + id);
    if (!el) return;
    el.outerHTML = fn();
    wire();
  }

  function wire() {
    App.Sync.wire(root);
    root.querySelectorAll('[data-bind]').forEach((inp) => {
      if (inp._wired) return; inp._wired = true;
      inp.addEventListener('input', () => { setPath(S.get(), inp.dataset.bind, inp.value); S.commit({ silent: true }); });
    });
    const rate = root.querySelector('#rate100');
    if (rate && !rate._wired) {
      rate._wired = true;
      rate.addEventListener('input', () => { const v = num(rate.value); if (v) { S.get().trip.rate100 = v; S.commit({ silent: true }); } });
      const y = root.querySelector('#cvYen'), k = root.querySelector('#cvKrw');
      y.addEventListener('input', () => { const v = num(y.value); k.value = v == null ? '' : Math.round((v * S.get().trip.rate100) / 100).toLocaleString('ko-KR'); });
      k.addEventListener('input', () => { const v = num(k.value); y.value = v == null ? '' : Math.round((v * 100) / S.get().trip.rate100).toLocaleString('ja-JP'); });
      const ts = root.querySelector('#tripStart'), te = root.querySelector('#tripEnd');
      const onDates = () => {
        if (!ts.value || !te.value || ts.value > te.value) { App.toast('출발일이 돌아오는 날보다 늦을 수 없어요.'); return; }
        if (App.diffDays(ts.value, te.value) > 13) { App.toast('최대 14일까지 지원해요.'); return; }
        S.setTripDates(ts.value, te.value);
        App.Geo.resetWeather();
        App.toast('여행 날짜를 바꿨어요. 일정은 Day 순서대로 옮겨졌어요.');
      };
      ts.addEventListener('change', onDates); te.addEventListener('change', onDates);
    }
    root.querySelectorAll('[data-cl]').forEach((cb) => {
      if (cb._wired) return; cb._wired = true;
      cb.addEventListener('change', () => {
        const c = S.get().info.checklist.find((x) => x.id === cb.dataset.cl);
        if (c) { c.done = cb.checked; S.commit({ silent: true }); rerender('sec-check', checklistSec); }
      });
    });
    const clAdd = root.querySelector('#clAdd');
    if (clAdd && !clAdd._wired) {
      clAdd._wired = true;
      clAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = root.querySelector('#clText').value.trim();
        if (!text) return;
        S.get().info.checklist.push({ id: uid('c'), group: root.querySelector('#clGroup').value.trim() || '기타', text, done: false });
        S.commit({ silent: true });
        rerender('sec-check', checklistSec);
        root.querySelector('#clText').focus();
      });
    }
    const ctAdd = root.querySelector('#ctAdd');
    if (ctAdd && !ctAdd._wired) {
      ctAdd._wired = true;
      ctAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = root.querySelector('#ctName').value.trim(), phone = root.querySelector('#ctPhone').value.trim();
        if (!name || !phone) { App.toast('이름과 번호를 모두 적어 주세요.'); return; }
        S.get().info.contacts.push({ id: uid('k'), name, phone, note: '' });
        S.commit({ silent: true });
        rerender('sec-contacts', contactsSec);
      });
    }
    root.querySelectorAll('input[name="theme"]').forEach((r) => {
      if (r._wired) return; r._wired = true;
      r.addEventListener('change', () => { S.get().meta.theme = r.value; S.commit({ silent: true }); App.applyTheme(); });
    });
    const imp = root.querySelector('#importFile');
    if (imp && !imp._wired) {
      imp._wired = true;
      imp.addEventListener('change', async () => {
        const f = imp.files[0]; if (!f) return;
        try {
          const obj = JSON.parse(await f.text());
          const ok = await UI.confirm({ title: '데이터 불러오기', body: `<strong>${esc(f.name)}</strong>의 내용으로 지금 데이터를 모두 바꿀까요?<br>지금 데이터가 필요하면 먼저 내보내기 하세요.${syncWarn()}`, ok: '불러오기', danger: true });
          if (ok) { S.importData(obj); App.toast('불러왔어요'); }
        } catch (e) { App.toast(e.message && e.message.includes('앱') ? e.message : '파일을 읽지 못했어요. 이 앱에서 내보낸 JSON인지 확인해 주세요.'); }
        imp.value = '';
      });
    }
  }

  /* ---------- 메모 폼 / 숙소 위치 ---------- */
  function openNote(id) {
    const notes = S.get().info.notes;
    const n = id ? notes.find((x) => x.id === id) : { id: uid('n'), title: '', body: '', link: '' };
    UI.openSheet({
      title: id ? '메모 수정' : '메모 추가', cls: 'sheet-form sheet-narrow',
      body: `<form class="form" novalidate><fieldset class="fs">
        <label class="field"><span class="field-label">제목</span><input class="input" id="nTitle" value="${esc(n.title)}" placeholder="예: 후쿠오카 시티패스" autofocus></label>
        <label class="field"><span class="field-label">내용</span><textarea class="input" id="nBody" rows="7" placeholder="자유롭게 적어 두세요">${esc(n.body)}</textarea></label>
        <label class="field"><span class="field-label">링크 <em>선택</em></span><input type="url" class="input" id="nLink" value="${esc(n.link)}" placeholder="https://"></label>
      </fieldset></form>`,
      foot: `${id ? `<button type="button" class="btn ghost danger-text" id="nDel">${icon('trash')}삭제</button>` : ''}<span class="grow"></span>
        <button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="nSave">${icon('check')}저장</button>`,
      onMount: (sheet) => {
        const $ = (s) => sheet.querySelector(s);
        $('#nSave').addEventListener('click', () => {
          const title = $('#nTitle').value.trim();
          if (!title && !$('#nBody').value.trim()) { App.toast('제목이나 내용을 적어 주세요.'); return; }
          Object.assign(n, { title, body: $('#nBody').value.trim(), link: $('#nLink').value.trim() });
          delete n.sample;
          if (!id) notes.push(n);
          S.commit();
          UI.closeTop();
        });
        if (id) $('#nDel').addEventListener('click', async () => {
          const ok = await UI.confirm({ title: '메모 삭제', body: `<strong>${esc(n.title || '이 메모')}</strong>를 지울까요?`, ok: '삭제', danger: true });
          if (!ok) return;
          UI.closeTop();
          S.get().info.notes = notes.filter((x) => x.id !== n.id);
          S.commit();
        });
      },
    });
  }
  function openStayLoc() {
    const s = S.get().info.stay;
    let picker = null;
    UI.openSheet({
      title: '숙소 위치', cls: 'sheet-form sheet-narrow',
      body: `<form class="form" novalidate><fieldset class="fs">
        <label class="field"><span class="field-label">주소</span><input class="input" id="sAddr" lang="ja" value="${esc(s.address)}" placeholder="福岡県福岡市…"></label>
        <label class="field"><span class="field-label">숙소 현지 이름 <em>일본어 · 이름 검색에 써요</em></span><input class="input" id="sLocal" lang="ja" value="${esc(s.local || '')}"></label>
        <div id="sLoc"></div></fieldset></form>`,
      foot: `<button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="sSave">${icon('check')}위치 저장</button>`,
      onClose: () => picker && picker.destroy(),
      onMount: (sheet) => {
        const $ = (q) => sheet.querySelector(q);
        picker = App.Geo.locPicker($('#sLoc'), { lat: s.lat, lng: s.lng, getQuery: (k) => (k === 'addr' ? $('#sAddr').value : $('#sLocal').value || s.name).trim() });
        $('#sSave').addEventListener('click', () => {
          const loc = picker.get();
          Object.assign(s, { address: $('#sAddr').value.trim(), local: $('#sLocal').value.trim(), lat: loc ? loc.lat : null, lng: loc ? loc.lng : null });
          delete s.sample;
          S.commit();
          UI.closeTop();
          App.toast(loc ? '숙소 위치를 저장했어요' : '숙소 위치를 비웠어요');
        });
      },
    });
  }

  App.on('cl-del', (el) => { const i = S.get().info; i.checklist = i.checklist.filter((c) => c.id !== el.dataset.id); S.commit({ silent: true }); rerender('sec-check', checklistSec); });
  App.on('ct-del', (el) => { const i = S.get().info; i.contacts = i.contacts.filter((c) => c.id !== el.dataset.id); S.commit({ silent: true }); rerender('sec-contacts', contactsSec); });
  App.on('note-add', () => openNote());
  App.on('note-edit', (el) => openNote(el.dataset.id));
  App.on('stay-loc', () => openStayLoc());
  App.on('data-export', () => {
    const blob = new Blob([S.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fukuoka-trip-${App.jstNow().date}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    App.toast('JSON 파일로 내보냈어요');
  });
  App.on('data-sample', async () => {
    const ok = await UI.confirm({ title: '예시 데이터 다시 보기', body: `지금 데이터를 모두 지우고 예시로 바꿔요. 필요하면 먼저 내보내기 하세요.${syncWarn()}`, ok: '예시로 바꾸기', danger: true });
    if (ok) { S.loadSample(); App.toast('예시 데이터를 불러왔어요'); }
  });
  App.on('data-reset', async () => {
    const ok = await UI.confirm({ title: '모두 초기화', body: `장소, 일정, 메모를 포함한 모든 데이터를 지워요. 되돌릴 수 없어요.${syncWarn()}`, ok: '모두 지우기', danger: true });
    if (ok) { S.resetAll(); App.toast('초기화했어요'); }
  });

  App.Info = {
    mount(el) { root = el; render(); },
    unmount() { root = null; },
    refresh() { if (!root) return; const y = window.scrollY; render(); window.scrollTo(0, y); },
  };
})(window.App);

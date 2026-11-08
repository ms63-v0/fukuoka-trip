/* 후쿠오카 여행 노트 — 장소 추가/수정 폼 */
(function (App) {
  'use strict';
  const { S, UI, esc, icon, CAT, CATS, AREAS, PRIORITY, WAIT, WAIT_HINT, DOW_KO, DOW_JA, DOW_KEYS, WEEK_ORDER, uid, clone, num, dowOf } = App;

  const WAIT_METHODS = ['현장 줄서기', '식권 자판기', '번호표 발권', '이름 적고 대기', '앱 예약 (테이블체크 등)', '전화 예약'];
  const hasJa = (s) => /[぀-ヿ一-龯]/.test(s || '');

  function hoursRows(p) {
    const trip = new Set(S.tripDates().map(dowOf));
    return WEEK_ORDER.map((dow) => {
      const h = (p.hours && p.hours[DOW_KEYS[dow]]) || {};
      const extra = !!(h.bStart || h.bEnd || h.lo);
      return `<div class="hrow ${trip.has(dow) ? 'is-trip' : ''} ${h.closed ? 'is-closed' : ''}" data-dow="${dow}">
        <span class="hrow-day">${DOW_KO[dow]}<small lang="ja">${DOW_JA[dow]}</small>${trip.has(dow) ? '<i>여행</i>' : ''}</span>
        <label class="tog"><input type="checkbox" class="h-closed" ${h.closed ? 'checked' : ''}><span>휴무</span></label>
        <span class="hrow-times">
          <input type="time" class="input h-open" value="${esc(h.open || '')}" aria-label="${DOW_KO[dow]}요일 오픈">
          <span class="dash">–</span>
          <input type="time" class="input h-close" value="${esc(h.close || '')}" aria-label="${DOW_KO[dow]}요일 마감">
        </span>
        <button type="button" class="btn xs ghost h-more" aria-expanded="${extra}">${extra ? '접기' : '브레이크·LO'}</button>
        <span class="hrow-extra" ${extra ? '' : 'hidden'}>
          <span class="mini-label">브레이크</span>
          <input type="time" class="input h-bs" value="${esc(h.bStart || '')}" aria-label="브레이크 시작">
          <span class="dash">–</span>
          <input type="time" class="input h-be" value="${esc(h.bEnd || '')}" aria-label="브레이크 끝">
          <span class="mini-label">L.O.</span>
          <input type="time" class="input h-lo" value="${esc(h.lo || '')}" aria-label="라스트오더">
        </span>
      </div>`;
    }).join('');
  }
  function menuRow(m = {}) {
    return `<div class="rrow" data-id="${esc(m.id || uid('m'))}">
      <input class="input r-name" placeholder="이름" value="${esc(m.name || '')}" aria-label="이름">
      <label class="yen-in"><span>¥</span><input class="input r-price" inputmode="numeric" placeholder="가격" value="${esc(m.price ?? '')}" aria-label="가격(엔)"></label>
      <input class="input r-note" placeholder="메모 (선택)" value="${esc(m.note || '')}" aria-label="메모">
      <label class="tog r-pick" title="추천 표시"><input type="checkbox" ${m.pick ? 'checked' : ''}><span>${icon('star')}추천</span></label>
      <button type="button" class="icon-btn xs r-del" aria-label="줄 삭제">${icon('x')}</button>
    </div>`;
  }
  function itemRow(m = {}) {
    return `<div class="rrow is-item" data-id="${esc(m.id || uid('s'))}" data-bought="${m.bought ? 1 : 0}">
      <input class="input r-name" placeholder="살 것" value="${esc(m.name || '')}" aria-label="살 것">
      <label class="yen-in"><span>¥</span><input class="input r-price" inputmode="numeric" placeholder="가격" value="${esc(m.price ?? '')}" aria-label="가격(엔)"></label>
      <label class="qty-in"><span>×</span><input class="input r-qty" inputmode="numeric" value="${esc(m.qty || 1)}" aria-label="수량"></label>
      <button type="button" class="icon-btn xs r-del" aria-label="줄 삭제">${icon('x')}</button>
    </div>`;
  }

  function formHTML(p) {
    const w = p.wait || {};
    const pay = p.pay || {};
    return `<form class="form" id="placeForm" data-cat="${p.cat}" novalidate autocomplete="off">
      <datalist id="areaList">${AREAS.map((a) => `<option value="${a}">`).join('')}</datalist>
      <datalist id="subList"></datalist>
      <datalist id="waitList">${WAIT_METHODS.map((a) => `<option value="${a}">`).join('')}</datalist>

      <fieldset class="fs">
        <legend>기본 정보</legend>
        <div class="field"><span class="field-label">카테고리</span>
          <div class="seg seg-cat" role="radiogroup" aria-label="카테고리">
            ${CATS.map((c) => `<label style="--cc:${c.color}"><input type="radio" name="cat" value="${c.id}" ${p.cat === c.id ? 'checked' : ''}><span>${icon(c.icon)}${c.short}</span></label>`).join('')}
          </div>
        </div>
        <label class="field"><span class="field-label">이름 <b class="req">필수</b><em>카드 제목으로 크게 보여요</em></span>
          <input class="input" id="pfName" name="name" value="${esc(p.name)}" placeholder="예: 이치란 본점" required></label>
        <label class="field"><span class="field-label">현지 이름 <em>일본어 · 위치 검색과 구글맵 연결에 써요</em></span>
          <input class="input" id="pfLocal" name="local" lang="ja" value="${esc(p.local)}" placeholder="例: 一蘭 本社総本店"></label>
        <div class="row2">
          <label class="field"><span class="field-label">종류</span><input class="input" id="pfSub" name="sub" list="subList" value="${esc(p.sub)}" placeholder="예: 라멘"></label>
          <label class="field"><span class="field-label">지역</span><input class="input" id="pfArea" name="area" list="areaList" value="${esc(p.area)}" placeholder="예: 나카스"></label>
        </div>
        <div class="field"><span class="field-label">우선순위</span>
          <div class="seg" role="radiogroup" aria-label="우선순위">
            ${[3, 2, 1].map((n) => `<label><input type="radio" name="priority" value="${n}" ${Number(p.priority) === n ? 'checked' : ''}><span>${PRIORITY[n]}</span></label>`).join('')}
          </div>
        </div>
        <div class="field"><span class="field-label">대표 사진 <em>선택 · 없으면 현지 이름 첫 글자로 표지를 만들어요</em></span>
          <div class="img-pick">
            <div class="img-prev" id="pfImgPrev" style="--cc:${CAT[p.cat].color}">${App.Places.cover(p)}</div>
            <div class="img-btns">
              <label class="btn sm">${icon('image')}사진 고르기<input type="file" id="pfFile" accept="image/*" hidden></label>
              <input class="input sm" id="pfImgUrl" type="url" placeholder="또는 이미지 주소(URL)" value="${p.image && !p.image.startsWith('data:') ? esc(p.image) : ''}">
              <button type="button" class="btn sm ghost" id="pfImgClear">사진 지우기</button>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="fs">
        <legend>위치</legend>
        <label class="field"><span class="field-label">주소 <em>구글맵/네이버지도에서 복사해 붙여넣기</em></span>
          <textarea class="input" id="pfAddr" name="address" rows="2" lang="ja" placeholder="福岡県福岡市博多区…">${esc(p.address)}</textarea></label>
        <div id="pfLoc"></div>
      </fieldset>

      <fieldset class="fs">
        <legend>영업시간</legend>
        <p class="hint">여행 요일은 강조돼요. 자정을 넘기면 마감을 <span class="mono">01:00</span>처럼 적으면 돼요. 24시간이면 <span class="mono">00:00–00:00</span>.</p>
        <div class="hours-tools">
          <button type="button" class="btn xs" data-h="copy">월요일 시간을 모든 요일에 복사</button>
          <button type="button" class="btn xs" data-h="24">24시간 영업</button>
          <button type="button" class="btn xs ghost" data-h="clear">모두 지우기</button>
        </div>
        <div class="hours-edit">${hoursRows(p)}</div>
        <label class="field"><span class="field-label">휴무 · 영업 메모</span>
          <input class="input" id="pfHoursNote" value="${esc(p.hoursNote)}" placeholder="예: 부정기 휴무 · 공휴일은 단축 영업"></label>
      </fieldset>

      <fieldset class="fs only-food">
        <legend>웨이팅 · 예약</legend>
        <div class="field"><span class="field-label">웨이팅 정도</span>
          <div class="seg seg-wait" role="radiogroup" aria-label="웨이팅">
            <label><input type="radio" name="wait" value="" ${w.level == null ? 'checked' : ''}><span>모름</span></label>
            ${WAIT.map((label, i) => `<label><input type="radio" name="wait" value="${i}" ${w.level === i ? 'checked' : ''}><span>${label}<small>${WAIT_HINT[i]}</small></span></label>`).join('')}
          </div>
        </div>
        <div class="row2">
          <label class="field"><span class="field-label">대기 방식</span><input class="input" id="pfWaitMethod" list="waitList" value="${esc(w.method)}" placeholder="예: 현장 줄서기"></label>
          <label class="field"><span class="field-label">예약</span>
            <select class="select" id="pfReserve">
              ${['', '불가', '가능', '권장', '필수'].map((v) => `<option value="${v}" ${w.reserve === v ? 'selected' : ''}>${v || '모름'}</option>`).join('')}
            </select></label>
        </div>
        <label class="field"><span class="field-label">웨이팅 팁</span>
          <textarea class="input" id="pfWaitNote" rows="2" placeholder="예: 오픈 20분 전 도착 추천, 평일 오후가 한산">${esc(w.note)}</textarea></label>
      </fieldset>

      <fieldset class="fs not-shop">
        <legend class="lbl-list">${esc(CAT[p.cat].listLabel)}</legend>
        <div class="rlist" id="pfMenu">${(p.menu || []).map(menuRow).join('')}</div>
        <button type="button" class="btn sm ghost add-row" data-add="menu">${icon('plus')}줄 추가</button>
      </fieldset>

      <fieldset class="fs only-shop">
        <legend>살 것</legend>
        <div class="rlist" id="pfItems">${(p.items || []).map(itemRow).join('')}</div>
        <button type="button" class="btn sm ghost add-row" data-add="item">${icon('plus')}살 것 추가</button>
      </fieldset>

      <fieldset class="fs">
        <legend>결제 · 편의</legend>
        <div class="check-chips">
          ${[['cash', '현금'], ['card', '카드'], ['ic', '교통IC카드'], ['taxfree', '면세'], ['kmenu', '한국어 메뉴']].map(([k, label]) =>
            `<label class="cchip"><input type="checkbox" data-pay="${k}" ${pay[k] ? 'checked' : ''}><span>${icon('check')}${label}</span></label>`).join('')}
        </div>
      </fieldset>

      <fieldset class="fs">
        <legend>연락처 · 링크</legend>
        <div class="row2">
          <label class="field"><span class="field-label">전화</span><input class="input" id="pfPhone" type="tel" value="${esc(p.phone)}" placeholder="092-000-0000"></label>
          <label class="field"><span class="field-label">웹사이트 · 인스타</span><input class="input" id="pfWeb" type="url" value="${esc(p.website)}" placeholder="https://"></label>
        </div>
        <label class="field"><span class="field-label">네이버지도 링크 <em>선택</em></span><input class="input" id="pfNmap" type="url" value="${esc(p.nmap)}" placeholder="https://naver.me/…"></label>
      </fieldset>

      <fieldset class="fs">
        <legend>메모</legend>
        <textarea class="input" id="pfMemo" rows="3" placeholder="가는 법, 주문 팁, 같이 갈 사람 등 자유롭게">${esc(p.memo)}</textarea>
      </fieldset>
    </form>`;
  }

  function readHours(form) {
    const hours = {};
    form.querySelectorAll('.hrow').forEach((row) => {
      const key = DOW_KEYS[+row.dataset.dow];
      const closed = row.querySelector('.h-closed').checked;
      const v = (c) => row.querySelector(c).value;
      if (closed) hours[key] = { closed: true };
      else if (v('.h-open') && v('.h-close')) hours[key] = { closed: false, open: v('.h-open'), close: v('.h-close'), bStart: v('.h-bs'), bEnd: v('.h-be'), lo: v('.h-lo') };
    });
    return hours;
  }

  function resizeImage(file, max = 720) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  function open({ id, cat = 'food', preset = {} } = {}) {
    const existing = id ? S.place(id) : null;
    const p = existing ? clone(existing) : Object.assign(S.blankPlace(cat), preset);
    let picker = null;
    let image = p.image || '';
    const entry = UI.openSheet({
      title: existing ? '장소 수정' : '장소 추가',
      cls: 'sheet-form',
      head: `<div class="head-slot"><span class="kicker">${existing ? '수정' : '새 장소'}</span><h2 class="sheet-title">${existing ? esc(p.name) : '장소 추가'}</h2></div>`,
      body: formHTML(p),
      foot: `<button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="pfSave">${icon('check')}저장</button>`,
      onClose: () => picker && picker.destroy(),
      onMount: (sheet) => {
        const form = sheet.querySelector('#placeForm');
        const $ = (s) => form.querySelector(s);
        const subList = $('#subList');
        const setCat = (c) => {
          form.dataset.cat = c;
          subList.innerHTML = CAT[c].subs.map((s) => `<option value="${s}">`).join('');
          form.querySelector('.lbl-list').textContent = CAT[c].listLabel;
          $('#pfImgPrev').style.setProperty('--cc', CAT[c].color);
        };
        setCat(p.cat);
        form.querySelectorAll('input[name="cat"]').forEach((r) => r.addEventListener('change', () => setCat(r.value)));

        /* 사진 */
        const prev = () => { $('#pfImgPrev').innerHTML = App.Places.cover({ image, local: $('#pfLocal').value, name: $('#pfName').value }); };
        $('#pfFile').addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { image = await resizeImage(f); $('#pfImgUrl').value = ''; prev(); } catch (err) { App.toast('사진을 불러오지 못했어요.'); }
        });
        $('#pfImgUrl').addEventListener('input', (e) => { image = e.target.value.trim(); prev(); });
        $('#pfImgClear').addEventListener('click', () => { image = ''; $('#pfImgUrl').value = ''; prev(); });
        $('#pfLocal').addEventListener('input', () => { if (!image) prev(); });
        $('#pfName').addEventListener('input', () => { if (!image) prev(); });

        /* 위치 */
        picker = App.Geo.locPicker($('#pfLoc'), {
          lat: p.lat, lng: p.lng,
          getQuery: (kind) => (kind === 'addr' ? $('#pfAddr').value.trim() : ($('#pfLocal').value || $('#pfName').value).trim()),
          onGmap: (url, g) => {
            p.gmap = g && (g.lat != null || g.name || g.short) ? url : p.gmap;
            if (g && g.name) {
              if (hasJa(g.name) && !$('#pfLocal').value) $('#pfLocal').value = g.name;
              else if (!$('#pfName').value) $('#pfName').value = g.name;
              prev();
            }
          },
        });
        picker.setGmap(p.gmap);

        /* 영업시간 */
        form.querySelector('.hours-edit').addEventListener('click', (e) => {
          const more = e.target.closest('.h-more');
          if (!more) return;
          const ex = more.parentElement.querySelector('.hrow-extra');
          ex.hidden = !ex.hidden;
          more.textContent = ex.hidden ? '브레이크·LO' : '접기';
          more.setAttribute('aria-expanded', String(!ex.hidden));
        });
        form.querySelector('.hours-edit').addEventListener('change', (e) => {
          if (e.target.classList.contains('h-closed')) e.target.closest('.hrow').classList.toggle('is-closed', e.target.checked);
        });
        form.querySelector('.hours-tools').addEventListener('click', (e) => {
          const b = e.target.closest('[data-h]'); if (!b) return;
          const rows = [...form.querySelectorAll('.hrow')];
          const set = (row, vals) => Object.entries(vals).forEach(([cls, v]) => { const el = row.querySelector(cls); if (el.type === 'checkbox') el.checked = v; else el.value = v; });
          if (b.dataset.h === 'copy') {
            const src = rows[0];
            const vals = {}; ['.h-open', '.h-close', '.h-bs', '.h-be', '.h-lo'].forEach((c) => (vals[c] = src.querySelector(c).value));
            vals['.h-closed'] = src.querySelector('.h-closed').checked;
            rows.slice(1).forEach((r) => { set(r, vals); r.classList.toggle('is-closed', vals['.h-closed']); });
            App.toast('월요일 시간을 모든 요일에 복사했어요');
          } else if (b.dataset.h === '24') {
            rows.forEach((r) => { set(r, { '.h-open': '00:00', '.h-close': '00:00', '.h-bs': '', '.h-be': '', '.h-lo': '', '.h-closed': false }); r.classList.remove('is-closed'); });
          } else {
            rows.forEach((r) => { set(r, { '.h-open': '', '.h-close': '', '.h-bs': '', '.h-be': '', '.h-lo': '', '.h-closed': false }); r.classList.remove('is-closed'); });
          }
        });

        /* 반복 줄 */
        form.addEventListener('click', (e) => {
          const add = e.target.closest('[data-add]');
          if (add) {
            const list = add.dataset.add === 'menu' ? $('#pfMenu') : $('#pfItems');
            list.insertAdjacentHTML('beforeend', add.dataset.add === 'menu' ? menuRow() : itemRow());
            list.lastElementChild.querySelector('.r-name').focus();
          }
          const del = e.target.closest('.r-del');
          if (del) del.closest('.rrow').remove();
        });

        /* 저장 */
        sheet.querySelector('#pfSave').addEventListener('click', () => {
          const name = $('#pfName').value.trim();
          if (!name) { $('#pfName').focus(); $('#pfName').classList.add('is-invalid'); App.toast('이름을 입력해 주세요.'); return; }
          const loc = picker.get();
          const c = form.querySelector('input[name="cat"]:checked').value;
          const waitV = form.querySelector('input[name="wait"]:checked');
          const out = Object.assign(p, {
            cat: c, name, local: $('#pfLocal').value.trim(), sub: $('#pfSub').value.trim(), area: $('#pfArea').value.trim(),
            priority: Number(form.querySelector('input[name="priority"]:checked').value),
            image, address: $('#pfAddr').value.trim(),
            lat: loc ? loc.lat : null, lng: loc ? loc.lng : null,
            hours: readHours(form), hoursNote: $('#pfHoursNote').value.trim(),
            wait: { level: waitV && waitV.value !== '' ? Number(waitV.value) : null, method: $('#pfWaitMethod').value.trim(), reserve: $('#pfReserve').value, note: $('#pfWaitNote').value.trim() },
            menu: [...form.querySelectorAll('#pfMenu .rrow')].map((r) => ({
              id: r.dataset.id, name: r.querySelector('.r-name').value.trim(), price: num(r.querySelector('.r-price').value),
              note: r.querySelector('.r-note').value.trim(), pick: r.querySelector('.r-pick input').checked,
            })).filter((m) => m.name),
            items: [...form.querySelectorAll('#pfItems .rrow')].map((r) => ({
              id: r.dataset.id, name: r.querySelector('.r-name').value.trim(), price: num(r.querySelector('.r-price').value),
              qty: num(r.querySelector('.r-qty').value) || 1, bought: r.dataset.bought === '1',
            })).filter((m) => m.name),
            pay: Object.fromEntries([...form.querySelectorAll('[data-pay]')].map((cb) => [cb.dataset.pay, cb.checked])),
            phone: $('#pfPhone').value.trim(), website: $('#pfWeb').value.trim(), nmap: $('#pfNmap').value.trim(),
            memo: $('#pfMemo').value.trim(),
          });
          if (out.gmap === undefined) out.gmap = '';
          delete out.sample;
          S.upsertPlace(out);
          UI.closeTop();
          App.toast(existing ? '저장했어요' : `${CAT[c].short}에 추가했어요`);
          if (!existing && App.router && App.router.current() === 'list' && App.List.currentCat() !== c) setTimeout(() => (location.hash = `list-${c}`), 150);
        });
      },
    });
    return entry;
  }

  App.PlaceForm = { open };
})(window.App);

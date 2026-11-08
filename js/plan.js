/* 후쿠오카 여행 노트 — 일정(3일 동선) 화면, 일정 항목 폼, 동선 분석 */
(function (App) {
  'use strict';
  const { S, UI, esc, icon, CAT, CATS, MOVES, DOW_KO, DOW_JA, toMin, fmtMin, dowOf, md, mdDot, hasLoc, distKm, segText,
    statusAt, gmapDir, gmapRoute, jstNow } = App;

  const DAY_VARS = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)'];
  const dayColor = (idx) => DAY_VARS[idx % DAY_VARS.length];
  const MOVE_ICON = { walk: 'pin', subway: 'train', bus: 'train', taxi: 'nav', train: 'train', car: 'nav' };
  const BAD = ['closed', 'before', 'after', 'break'];

  /* ---------- 동선 분석: 번호, 영업시간 충돌, 다음 장소까지 거리 ---------- */
  function analyze(date) {
    const d = S.day(date);
    const dow = dowOf(date);
    let n = 0, prevT = null;
    const rows = (d.items || []).map((item) => {
      const loc = S.resolve(item);
      const located = !!(loc && hasLoc(loc));
      const t = toMin(item.time);
      let warn = null;
      if (loc && !loc.isStay && t != null && App.hasHours(loc)) {
        const s = statusAt(loc, dow, t);
        if (BAD.includes(s.code)) warn = s;
      }
      const orderWarn = t != null && prevT != null && t < prevT;
      if (t != null) prevT = t;
      return { item, loc, located, num: located ? ++n : null, warn, orderWarn, t };
    });
    rows.forEach((r, i) => {
      const next = rows[i + 1];
      if (!next) return;
      r.seg = { next, km: r.located && next.located ? distKm(r.loc, next.loc) : null };
    });
    return rows;
  }
  function warnText(w) {
    if (!w) return '';
    if (w.code === 'closed') return '이 날은 휴무일이에요';
    return `이 시간엔 ${w.label}`;
  }
  function segHTML(r, opts = {}) {
    if (!r.seg) return '';
    const m = r.item.move || {};
    const auto = r.seg.km != null ? segText(r.seg.km) : '';
    const manual = m.mode ? `${MOVES[m.mode]}${m.min ? ` ${m.min}분` : ''}${m.note ? ` · ${esc(m.note)}` : ''}` : '';
    if (!manual && !auto) return `<li class="tl-seg"><span class="seg-line"></span><span class="seg-text muted">이동</span></li>`;
    const dir = r.located && r.seg.next.located ? gmapDir(r.seg.next.loc, r.loc, m.mode === 'walk' ? 'walking' : m.mode === 'taxi' || m.mode === 'car' ? 'driving' : 'transit') : '';
    return `<li class="tl-seg"><span class="seg-line"></span>
      <span class="seg-text">${icon(MOVE_ICON[m.mode] || 'pin')}${manual || auto}${manual && auto && !opts.compact ? `<small>${auto}</small>` : ''}</span>
      ${dir ? `<a class="seg-go" href="${esc(dir)}" target="_blank" rel="noopener">길찾기</a>` : ''}</li>`;
  }
  function subLine(r) {
    if (!r.loc) return '직접 입력';
    if (r.loc.isStay) return '숙소';
    const c = CAT[r.loc.cat] || CAT.base;
    return [c.short, r.loc.sub, r.loc.area].filter(Boolean).map(esc).join(' · ');
  }
  function locColor(r) { return r.loc ? (r.loc.isStay ? 'var(--accent)' : (CAT[r.loc.cat] || CAT.base).color) : 'var(--ink-3)'; }

  /* ---------- 일정 화면 ---------- */
  let root = null;
  const st = { sel: null };
  function defaultDay() {
    const dates = S.tripDates();
    const today = jstNow().date;
    return dates.includes(today) ? today : dates[0];
  }

  function itemHTML(r, date) {
    const it = r.item;
    return `<li class="pitem ${it.done ? 'is-done' : ''}" style="--cc:${locColor(r)}">
      <button type="button" class="pcheck" data-act="item-done" data-date="${date}" data-id="${it.id}" aria-pressed="${!!it.done}" aria-label="완료 표시">${icon('check')}</button>
      <div class="ptime mono">${esc(it.time || '--:--')}${it.end ? `<small>~${esc(it.end)}</small>` : ''}</div>
      <button type="button" class="pmain" data-act="item-open" data-date="${date}" data-id="${it.id}">
        <span class="pname">${r.num ? `<span class="pnum">${r.num}</span>` : ''}<strong>${esc(S.itemTitle(it))}</strong></span>
        <span class="psub">${subLine(r)}${r.loc && !r.located ? ' · <span class="nopin">위치 없음</span>' : ''}</span>
        ${r.warn ? `<span class="pwarn">${icon('alert')}${esc(warnText(r.warn))}</span>` : ''}
        ${r.orderWarn ? `<span class="pwarn soft">${icon('clock')}앞 일정보다 시간이 빨라요</span>` : ''}
        ${it.note ? `<span class="pnote">${esc(it.note)}</span>` : ''}
      </button>
      <div class="pact">
        <button type="button" class="icon-btn xs" data-act="item-move" data-dir="-1" data-date="${date}" data-id="${it.id}" aria-label="위로">${icon('up')}</button>
        <button type="button" class="icon-btn xs" data-act="item-move" data-dir="1" data-date="${date}" data-id="${it.id}" aria-label="아래로">${icon('down')}</button>
        <button type="button" class="icon-btn xs" data-act="edit-item" data-date="${date}" data-id="${it.id}" aria-label="수정">${icon('edit')}</button>
        <button type="button" class="icon-btn xs pmenu" data-act="item-menu" data-date="${date}" data-id="${it.id}" aria-label="일정 메뉴">${icon('dots')}</button>
      </div>
    </li>`;
  }
  /* 폰에서는 ↑ ↓ ✎ 대신 ⋯ 하나로 모아서 이름이 넓게 보이게 */
  function openItemMenu(date, id) {
    const it = S.day(date).items.find((x) => x.id === id);
    if (!it) return;
    const entry = UI.openSheet({
      title: S.itemTitle(it), cls: 'dialog',
      body: `<div class="menu-sheet">
        <button type="button" class="btn" data-m="edit">${icon('edit')}수정</button>
        <button type="button" class="btn" data-m="up">${icon('up')}위로 이동</button>
        <button type="button" class="btn" data-m="down">${icon('down')}아래로 이동</button>
        <button type="button" class="btn" data-m="done">${icon('check')}${it.done ? '완료 표시 지우기' : '완료로 표시'}</button>
      </div>`,
    });
    entry.sheet.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      UI.closeTop();
      setTimeout(() => {
        if (m === 'edit') openItemForm({ date, id });
        else if (m === 'up') S.moveItem(date, id, -1);
        else if (m === 'down') S.moveItem(date, id, 1);
        else if (m === 'done') { it.done = !it.done; S.commit(); }
      }, 60);
    }));
  }
  function colHTML(d) {
    const rows = analyze(d.date);
    const route = gmapRoute(rows.filter((r) => r.located).map((r) => r.loc));
    const warnCount = rows.filter((r) => r.warn).length;
    return `<section class="dcol ${d.date === st.sel ? 'is-sel' : ''}" data-date="${d.date}" style="--dc:${dayColor(d.idx)}">
      <header class="dcol-head">
        <div class="dcol-title">
          <span class="dnum">Day ${d.idx + 1}</span>
          <strong class="mono">${mdDot(d.date)}</strong>
          <span class="dow-ja" lang="ja">${DOW_JA[d.dow]}</span><span class="dow-ko">${DOW_KO[d.dow]}요일</span>
          <span class="dcol-wx" data-wx="${d.date}"></span>
        </div>
        <input class="input dmemo" data-memo="${d.date}" value="${esc(d.memo || '')}" placeholder="이 날의 테마 (예: 다자이후 반나절)" aria-label="Day ${d.idx + 1} 메모">
        <div class="dcol-tools">
          <span class="muted">${rows.length}곳${warnCount ? ` · <b class="bad-text">시간 확인 ${warnCount}</b>` : ''}</span>
          <span class="grow"></span>
          <button type="button" class="btn xs ghost" data-act="day-sort" data-date="${d.date}">${icon('clock')}시간순</button>
          ${route ? `<a class="btn xs ghost" href="${esc(route)}" target="_blank" rel="noopener">${icon('map')}구글맵 경로</a>` : ''}
        </div>
      </header>
      ${rows.length ? `<ol class="plist">${rows.map((r) => itemHTML(r, d.date) + segHTML(r)).join('')}</ol>` :
        `<div class="empty small"><strong>아직 일정이 없어요</strong><p>아래 버튼이나 '일정에 없는 장소'에서 추가하세요.</p></div>`}
      <button type="button" class="btn add-item" data-act="add-item" data-date="${d.date}">${icon('plus')}일정 추가</button>
    </section>`;
  }
  function trayHTML() {
    const list = S.places().filter((p) => !S.scheduleOf(p.id).length)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.name || '').localeCompare(b.name || '', 'ko'));
    const days = S.days();
    return `<section class="tray">
      <header><h2>일정에 없는 장소 <span class="muted">${list.length}</span></h2><p class="muted">우선순위 높은 순 · Day 버튼으로 바로 넣기</p></header>
      ${list.length ? `<ul class="tray-list">${list.map((p) => {
        const c = CAT[p.cat] || CAT.base;
        return `<li style="--cc:${c.color}">
          <span class="tray-dot">${icon(c.icon)}</span>
          <button type="button" class="tray-name" data-act="open-place" data-id="${p.id}"><strong>${esc(p.name)}</strong><span>${[c.short, p.area].filter(Boolean).map(esc).join(' · ')}${p.priority === 3 ? ' · <b>꼭</b>' : ''}</span></button>
          <span class="tray-add">${days.map((d) => `<button type="button" class="chip xs" data-act="tray-add" data-id="${p.id}" data-date="${d.date}" style="--dc:${dayColor(d.idx)}">D${d.idx + 1}</button>`).join('')}</span>
        </li>`;
      }).join('')}</ul>` : '<p class="muted pad">저장한 장소가 모두 일정에 들어갔어요.</p>'}
    </section>`;
  }
  function render() {
    if (!root) return;
    const days = S.days();
    if (!st.sel || !days.some((d) => d.date === st.sel)) st.sel = defaultDay();
    const total = days.reduce((a, d) => a + d.items.length, 0);
    root.innerHTML = `<div class="plan-page">
      <header class="page-head">
        <div><p class="eyebrow">일정 · ${days.length}일 · ${total}곳</p><h1>날짜별 동선</h1></div>
        <a class="btn hide-sm" href="#home">${icon('map')}지도에서 보기</a>
      </header>
      <nav class="day-tabs plan-tabs" role="tablist">
        ${days.map((d) => `<button type="button" role="tab" class="day-tab ${d.date === st.sel ? 'on' : ''}" data-act="plan-day" data-date="${d.date}" style="--dc:${dayColor(d.idx)}" aria-selected="${d.date === st.sel}">
          <span class="dt-top">Day ${d.idx + 1}</span><span class="dt-main mono">${md(d.date)}</span><span class="dt-dow" lang="ja">${DOW_JA[d.dow]}</span></button>`).join('')}
      </nav>
      <div class="plan-cols" style="--cols:${days.length}">${days.map(colHTML).join('')}</div>
      ${trayHTML()}
    </div>`;
    root.querySelectorAll('[data-memo]').forEach((inp) => inp.addEventListener('input', () => { S.day(inp.dataset.memo).memo = inp.value; S.commit({ silent: true }); }));
    fillWeather(root);
  }
  function fillWeather(scope) {
    const t = S.get().trip;
    App.Geo.weather(t.start, t.end).then((data) => {
      if (!data) return;
      scope.querySelectorAll('[data-wx]').forEach((el) => {
        const w = data[el.dataset.wx];
        if (w) el.innerHTML = `${icon(w.icon)}<span class="mono">${w.max}°/${w.min}°</span>${w.pop != null ? `<small>${w.pop}%</small>` : ''}`, el.title = `${w.label} · 강수확률 ${w.pop}%`;
      });
    });
  }

  /* ---------- 일정 항목 폼 ---------- */
  function suggestTime(date) {
    const items = S.day(date).items;
    const last = items.map((i) => toMin(i.time)).filter((t) => t != null).sort((a, b) => b - a)[0];
    return last != null ? fmtMin(Math.min(last + 90, 23 * 60)) : '10:00';
  }
  function placeOptions(sel) {
    const stay = S.get().info.stay;
    return `<option value="">직접 입력 (장소 연결 없이)</option>
      <option value="__stay" ${sel === '__stay' ? 'selected' : ''}>숙소 · ${esc(stay.name || '이름 미입력')}</option>
      ${CATS.map((c) => {
        const ps = S.places(c.id);
        if (!ps.length) return '';
        return `<optgroup label="${c.label}">${ps.map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.name)}${p.area ? ` · ${esc(p.area)}` : ''}</option>`).join('')}</optgroup>`;
      }).join('')}`;
  }
  function openItemForm({ date, id, placeId } = {}) {
    const days = S.days();
    const fromDate = id ? date : null;
    const existing = id ? S.day(date).items.find((x) => x.id === id) : null;
    const item = existing ? App.clone(existing) : Object.assign(S.blankItem(), { placeId: placeId || null });
    if (!date) {
      const today = jstNow().date;
      date = days.some((d) => d.date === today) ? today : (st.sel || days[0].date);
    }
    if (!existing) item.time = suggestTime(date);
    const m = item.move || {};
    const entry = UI.openSheet({
      title: existing ? '일정 수정' : '일정 추가',
      cls: 'sheet-form sheet-narrow',
      head: `<div class="head-slot"><span class="kicker">${existing ? '일정 수정' : '새 일정'}</span><h2 class="sheet-title">${existing ? esc(S.itemTitle(item)) : '일정 추가'}</h2></div>`,
      body: `<form class="form" id="itemForm" novalidate>
        <fieldset class="fs">
          <label class="field"><span class="field-label">날짜</span>
            <select class="select" id="ifDate">${days.map((d) => `<option value="${d.date}" ${d.date === date ? 'selected' : ''}>Day ${d.idx + 1} · ${md(d.date)} (${DOW_KO[d.dow]})</option>`).join('')}</select></label>
          <div class="row2">
            <label class="field"><span class="field-label">시작</span><input type="time" class="input" id="ifTime" value="${esc(item.time)}"></label>
            <label class="field"><span class="field-label">끝 <em>선택</em></span><input type="time" class="input" id="ifEnd" value="${esc(item.end)}"></label>
          </div>
          <label class="field"><span class="field-label">장소</span><select class="select" id="ifPlace">${placeOptions(item.placeId)}</select></label>
          <label class="field if-title"><span class="field-label">제목</span><input class="input" id="ifTitle" value="${esc(item.title)}" placeholder="예: 체크인, 자유 시간, 환전"></label>
          <p class="hours-check" id="ifCheck" hidden></p>
          <label class="field"><span class="field-label">메모</span><textarea class="input" id="ifNote" rows="2" placeholder="예: 예약 18:30, 2층 창가">${esc(item.note)}</textarea></label>
        </fieldset>
        <fieldset class="fs">
          <legend>다음 장소까지 이동</legend>
          <div class="seg seg-wrap" role="radiogroup" aria-label="이동 수단">
            <label><input type="radio" name="move" value="" ${!m.mode ? 'checked' : ''}><span>자동 (거리 계산)</span></label>
            ${Object.entries(MOVES).map(([k, v]) => `<label><input type="radio" name="move" value="${k}" ${m.mode === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}
          </div>
          <div class="row2">
            <label class="field"><span class="field-label">소요 시간(분)</span><input class="input" id="ifMin" inputmode="numeric" value="${esc(m.min || '')}" placeholder="예: 15"></label>
            <label class="field"><span class="field-label">이동 메모</span><input class="input" id="ifMoveNote" value="${esc(m.note || '')}" placeholder="예: 니시테츠 급행"></label>
          </div>
        </fieldset>
      </form>`,
      foot: `${existing ? `<button type="button" class="btn ghost danger-text" id="ifDel">${icon('trash')}삭제</button>` : ''}<span class="grow"></span>
        <button type="button" class="btn ghost" data-close>취소</button><button type="button" class="btn primary" id="ifSave">${icon('check')}저장</button>`,
      onMount: (sheet) => {
        const $ = (s) => sheet.querySelector(s);
        const sync = () => {
          const pid = $('#ifPlace').value;
          $('.if-title').hidden = !!pid;
          const p = pid && pid !== '__stay' ? S.place(pid) : null;
          const t = toMin($('#ifTime').value);
          const box = $('#ifCheck');
          if (p && t != null && App.hasHours(p)) {
            const s = statusAt(p, dowOf($('#ifDate').value), t);
            const bad = BAD.includes(s.code);
            box.hidden = false;
            box.className = `hours-check tone-${bad ? 'bad' : s.tone}`;
            box.innerHTML = `${icon(bad ? 'alert' : 'clock')}<span>${bad ? warnText(s) : `이 시간엔 ${esc(s.label)}`}</span>`;
          } else if (p && !App.hasHours(p)) {
            box.hidden = false; box.className = 'hours-check tone-mute';
            box.innerHTML = `${icon('info')}<span>이 장소는 영업시간이 비어 있어서 확인할 수 없어요.</span>`;
          } else box.hidden = true;
        };
        ['#ifPlace', '#ifTime', '#ifDate'].forEach((s) => $(s).addEventListener('input', sync));
        sync();
        $('#ifSave').addEventListener('click', () => {
          const pid = $('#ifPlace').value;
          const title = $('#ifTitle').value.trim();
          if (!pid && !title) { $('#ifTitle').focus(); App.toast('장소를 고르거나 제목을 적어 주세요.'); return; }
          const mv = sheet.querySelector('input[name="move"]:checked');
          Object.assign(item, {
            time: $('#ifTime').value, end: $('#ifEnd').value, placeId: pid || null, title: pid ? '' : title,
            note: $('#ifNote').value.trim(), move: { mode: mv ? mv.value : '', min: $('#ifMin').value.trim(), note: $('#ifMoveNote').value.trim() },
          });
          delete item.sample;
          const to = $('#ifDate').value;
          S.saveItem(to, item, fromDate);
          st.sel = to;
          UI.closeTop();
          App.toast(existing ? '일정을 저장했어요' : `Day ${days.find((d) => d.date === to).idx + 1}에 추가했어요`);
        });
        if (existing) $('#ifDel').addEventListener('click', async () => {
          const ok = await UI.confirm({ title: '일정 삭제', body: `<strong>${esc(S.itemTitle(item))}</strong> 일정을 지울까요? 저장한 장소는 그대로 남아요.`, ok: '삭제', danger: true });
          if (!ok) return;
          UI.closeTop();
          S.removeItem(fromDate, item.id);
          App.toast('일정을 지웠어요');
        });
      },
    });
    return entry;
  }

  /* ---------- 액션 ---------- */
  App.on('plan-day', (el) => { st.sel = el.dataset.date; render(); });
  App.on('add-item', (el) => openItemForm({ date: el.dataset.date }));
  App.on('edit-item', (el) => openItemForm({ date: el.dataset.date, id: el.dataset.id }));
  App.on('item-open', (el) => {
    const it = S.day(el.dataset.date).items.find((x) => x.id === el.dataset.id);
    if (it && it.placeId && it.placeId !== '__stay' && S.place(it.placeId)) App.Places.openPlace(it.placeId);
    else openItemForm({ date: el.dataset.date, id: el.dataset.id });
  });
  App.on('item-done', (el) => {
    const it = S.day(el.dataset.date).items.find((x) => x.id === el.dataset.id);
    if (!it) return;
    it.done = !it.done;
    S.commit();
  });
  App.on('item-move', (el) => S.moveItem(el.dataset.date, el.dataset.id, Number(el.dataset.dir)));
  App.on('item-menu', (el) => openItemMenu(el.dataset.date, el.dataset.id));
  App.on('day-sort', (el) => { S.sortDay(el.dataset.date); App.toast('시간순으로 정렬했어요'); });
  App.on('tray-add', (el) => openItemForm({ date: el.dataset.date, placeId: el.dataset.id }));
  App.on('schedule-place', (el) => openItemForm({ placeId: el.dataset.id }));

  App.Plan = {
    mount(el) { root = el; render(); },
    unmount() { root = null; },
    refresh() { if (!root) return; const y = window.scrollY; render(); window.scrollTo(0, y); },
    analyze, segHTML, subLine, locColor, warnText, dayColor, openItemForm, fillWeather,
  };
})(window.App);

/* 후쿠오카 여행 노트 — 장소 카드, 카테고리 리스트(2×n), 장소 상세 시트 */
(function (App) {
  'use strict';
  const { S, UI, esc, icon, CAT, CATS, PRIORITY, WAIT, WAIT_HINT, DOW_KO, DOW_JA, WEEK_ORDER,
    hoursText, hoursExtra, statusNow, statusAt, yen, krw, gmapPlace, gmapDir, naverPlace, hasLoc, md, dowOf, jstNow, toMin } = App;

  const pill = (st) => `<span class="pill tone-${st.tone}">${esc(st.short)}</span>`;
  const initialOf = (p) => Array.from((p.local || p.name || '').trim().replace(/^[\s\p{P}\p{S}]+/u, ''))[0] || '·';
  function cover(p, cls = '') {
    return p.image
      ? `<img class="${cls}" src="${esc(p.image)}" alt="" loading="lazy">`
      : `<span class="kanji ${cls}" lang="ja" aria-hidden="true">${esc(initialOf(p))}</span>`;
  }
  function shopProgress(p) {
    const items = p.items || [];
    if (!items.length) return null;
    return { total: items.length, bought: items.filter((i) => i.bought).length };
  }

  /* ---------- 카드 ---------- */
  function card(p) {
    const c = CAT[p.cat] || CAT.base;
    const st = statusNow(p);
    const sched = S.scheduleOf(p.id);
    const closures = S.tripClosures(p);
    const sp = p.cat === 'shop' ? shopProgress(p) : null;
    return `<button type="button" class="pcard ${p.visited ? 'is-done' : ''}" data-act="open-place" data-id="${p.id}" style="--cc:${c.color}">
      <span class="pcard-cover">${cover(p)}
        <span class="pcard-cat">${icon(c.icon)}${esc(p.sub || c.short)}</span>
        ${p.priority === 3 ? '<span class="pcard-must">꼭</span>' : ''}
        ${p.visited ? `<span class="pcard-check" title="방문 완료">${icon('check')}</span>` : ''}
      </span>
      <span class="pcard-body">
        <strong class="pcard-name">${esc(p.name || '이름 없음')}</strong>
        ${p.local ? `<span class="pcard-local" lang="ja">${esc(p.local)}</span>` : ''}
        <span class="pcard-meta">${p.area ? `${icon('pin')}${esc(p.area)}` : '<span class="muted">지역 미입력</span>'}${hasLoc(p) ? '' : ' <span class="nopin" title="지도 위치 없음">위치 없음</span>'}</span>
        <span class="pcard-tags">
          ${pill(st)}
          ${closures.map((x) => `<span class="pill tone-bad">${DOW_KO[x.dow]} 휴무</span>`).join('')}
          ${sched.length ? `<span class="pill tone-accent">Day ${[...new Set(sched.map((s) => s.idx + 1))].join('·')}</span>` : ''}
          ${sp ? `<span class="pill tone-line">살 것 ${sp.bought}/${sp.total}</span>` : ''}
          ${p.sample ? '<span class="pill tone-line">예시</span>' : ''}
        </span>
      </span>
    </button>`;
  }

  /* ---------- 리스트 뷰 ---------- */
  const st = { cat: 'food', q: '', filter: 'all', sort: 'priority', showMap: false };
  let root = null, map = null, markers = {}, markerLayer = null;
  const wide = () => matchMedia('(min-width: 1100px)').matches;

  function filtered() {
    let list = S.places(st.cat);
    const q = st.q.trim().toLowerCase();
    if (q) list = list.filter((p) => [p.name, p.local, p.sub, p.area, p.memo, p.address, ...(p.menu || []).map((m) => m.name), ...(p.items || []).map((m) => m.name)].join(' ').toLowerCase().includes(q));
    if (st.filter === 'must') list = list.filter((p) => p.priority === 3);
    if (st.filter === 'unsched') list = list.filter((p) => !S.scheduleOf(p.id).length);
    if (st.filter === 'todo') list = list.filter((p) => !p.visited);
    if (st.filter === 'done') list = list.filter((p) => p.visited);
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko');
    if (st.sort === 'name') list.sort(byName);
    else if (st.sort === 'area') list.sort((a, b) => (a.area || '힣').localeCompare(b.area || '힣', 'ko') || byName(a, b));
    else list.sort((a, b) => (b.priority || 0) - (a.priority || 0) || Number(a.visited) - Number(b.visited) || byName(a, b));
    return list;
  }
  const FILTERS = [['all', '전체'], ['must', '꼭 가기'], ['unsched', '일정 미배정'], ['todo', '방문 전'], ['done', '방문 완료']];

  function shopSummary() {
    const shops = S.places('shop');
    const items = shops.flatMap((p) => p.items || []);
    if (!items.length) return '';
    const left = items.filter((i) => !i.bought);
    const sum = left.reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    const rate = S.get().trip.rate100;
    return `<div class="shop-sum">
      <div><span class="eyebrow">살 것 전체</span><strong>${items.length}개</strong></div>
      <div><span class="eyebrow">구매 완료</span><strong>${items.length - left.length}개</strong></div>
      <div><span class="eyebrow">남은 예상 금액</span><strong class="mono">${yen(sum)}</strong><span class="muted">${krw(sum, rate)}</span></div>
    </div>`;
  }

  function render() {
    const c = CAT[st.cat];
    root.innerHTML = `
      <div class="list-page ${st.showMap ? 'map-on' : ''}">
        <div class="list-main">
          <header class="page-head">
            <div><p class="eyebrow">장소 리스트</p><h1>${esc(c.label)}</h1></div>
            <button type="button" class="btn primary hide-sm" data-act="add-place">${icon('plus')}${esc(c.short)} 추가</button>
          </header>
          <nav class="cat-tabs" aria-label="카테고리">
            ${CATS.map((x) => `<a href="#list-${x.id}" class="cat-tab ${x.id === st.cat ? 'on' : ''}" style="--cc:${x.color}" ${x.id === st.cat ? 'aria-current="page"' : ''}>${icon(x.icon)}<span>${x.short}</span><b data-count="${x.id}">${S.places(x.id).length}</b></a>`).join('')}
          </nav>
          <div class="list-tools">
            <label class="search">${icon('search')}<input id="listQ" type="search" placeholder="이름 · 지역 · 메뉴로 검색" value="${esc(st.q)}" autocomplete="off"></label>
            <div class="list-tools-row">
              <div class="chips" role="group" aria-label="필터">
                ${FILTERS.map(([k, label]) => `<button type="button" class="chip ${st.filter === k ? 'on' : ''}" data-act="list-filter" data-f="${k}">${label}</button>`).join('')}
              </div>
              <select id="listSort" class="select sm" aria-label="정렬">
                <option value="priority" ${st.sort === 'priority' ? 'selected' : ''}>우선순위순</option>
                <option value="area" ${st.sort === 'area' ? 'selected' : ''}>지역순</option>
                <option value="name" ${st.sort === 'name' ? 'selected' : ''}>이름순</option>
              </select>
              <button type="button" class="btn sm map-toggle" data-act="list-map">${icon(st.showMap ? 'list' : 'map')}${st.showMap ? '카드' : '지도'}</button>
            </div>
          </div>
          <div id="shopSum">${st.cat === 'shop' ? shopSummary() : ''}</div>
          <div class="pgrid" id="pgrid"></div>
        </div>
        <aside class="list-map"><div id="listMap" class="map"></div></aside>
      </div>
      <button type="button" class="fab" data-act="add-place" aria-label="${esc(c.short)} 추가">${icon('plus')}</button>`;
    root.querySelector('#listQ').addEventListener('input', App.debounce((e) => { st.q = e.target.value; renderGrid(); drawMap(false); }, 120));
    root.querySelector('#listSort').addEventListener('change', (e) => { st.sort = e.target.value; renderGrid(); });
    renderGrid();
    ensureMap();
  }

  function renderGrid() {
    const grid = root && root.querySelector('#pgrid');
    if (!grid) return;
    const list = filtered();
    const c = CAT[st.cat];
    if (!list.length) {
      const none = !S.places(st.cat).length;
      grid.innerHTML = `<div class="empty">
        <span class="empty-ic" style="--cc:${c.color}">${icon(c.icon)}</span>
        <strong>${none ? `아직 ${esc(c.short)} 장소가 없어요` : '조건에 맞는 장소가 없어요'}</strong>
        <p>${none ? '가고 싶은 곳의 이름과 주소를 적으면 카드와 지도 핀이 생겨요.' : '검색어나 필터를 바꿔 보세요.'}</p>
        ${none ? `<button type="button" class="btn primary" data-act="add-place">${icon('plus')}첫 ${esc(c.short)} 추가</button>` : ''}
      </div>`;
      return;
    }
    grid.innerHTML = list.map(card).join('');
    grid.querySelectorAll('.pcard').forEach((el) => {
      el.addEventListener('mouseenter', () => hot(el.dataset.id, true));
      el.addEventListener('mouseleave', () => hot(el.dataset.id, false));
    });
  }
  function hot(id, on) {
    const m = markers[id];
    if (!m || !m._icon) return;
    m._icon.classList.toggle('is-hot', on);
    if (on) m.setZIndexOffset(800); else m.setZIndexOffset(0);
  }

  function ensureMap() {
    const visible = wide() || st.showMap;
    if (!visible) { App.Geo.destroyMap(map); map = null; return; }
    const el = root.querySelector('#listMap');
    if (!el) return;
    if (map && map.getContainer() !== el) { App.Geo.destroyMap(map); map = null; }
    if (!map) {
      map = App.Geo.createMap(el);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);
    }
    setTimeout(() => { if (map) { map.invalidateSize(); drawMap(true); } }, 60);
  }
  function popupHTML(p) {
    const s = statusNow(p);
    return `<div class="pop"><strong>${esc(p.name)}</strong>${p.local ? `<span lang="ja">${esc(p.local)}</span>` : ''}
      <div class="pop-tags">${pill(s)}</div>
      <div class="pop-acts"><button type="button" class="btn sm primary" data-act="open-place" data-id="${p.id}">상세 보기</button>
      <a class="btn sm" href="${gmapDir(p)}" target="_blank" rel="noopener">${icon('nav')}길찾기</a></div></div>`;
  }
  function drawMap(fit) {
    if (!map) return;
    markerLayer.clearLayers();
    markers = {};
    const list = filtered().filter(hasLoc);
    list.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon: App.Geo.dotIcon(p.cat), title: p.name, riseOnHover: true }).bindPopup(popupHTML(p), { closeButton: false, minWidth: 200 });
      m.addTo(markerLayer);
      markers[p.id] = m;
    });
    const stay = S.stayLoc();
    if (hasLoc(stay)) L.marker([stay.lat, stay.lng], { icon: App.Geo.stayIcon(), title: '숙소', zIndexOffset: -10 }).bindPopup(`<div class="pop"><strong>${esc(stay.name)}</strong><span>숙소</span></div>`, { closeButton: false }).addTo(markerLayer);
    if (fit && list.length) { const m = map; App.Geo.whenSized(m, () => m.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng])).pad(0.18), { maxZoom: 15 })); }
  }

  const List = {
    mount(el, arg) { root = el; if (arg && CAT[arg]) st.cat = arg; render(); },
    update(arg) { if (arg && CAT[arg] && arg !== st.cat) { st.cat = arg; st.q = ''; st.filter = 'all'; } render(); },
    unmount() { App.Geo.destroyMap(map); map = null; root = null; },
    refresh() {
      if (!root) return;
      renderGrid(); drawMap(false);
      root.querySelectorAll('[data-count]').forEach((b) => (b.textContent = S.places(b.dataset.count).length));
      const sum = root.querySelector('#shopSum'); if (sum) sum.innerHTML = st.cat === 'shop' ? shopSummary() : '';
    },
    resize() { if (root) ensureMap(); },
    currentCat: () => st.cat,
  };

  App.on('list-filter', (el) => { st.filter = el.dataset.f; root.querySelectorAll('[data-act="list-filter"]').forEach((b) => b.classList.toggle('on', b === el)); renderGrid(); drawMap(false); });
  App.on('list-map', () => { st.showMap = !st.showMap; render(); });

  /* ---------- 상세 시트 ---------- */
  function headHTML(p) {
    const c = CAT[p.cat] || CAT.base;
    return `<div class="head-slot"><span class="kicker" style="--cc:${c.color}">${icon(c.icon)}${esc(c.label)}${p.sub ? ` · ${esc(p.sub)}` : ''}</span></div>`;
  }
  function hoursTable(p) {
    const tripDays = {};
    S.tripDates().forEach((d) => (tripDays[dowOf(d)] = d));
    const today = jstNow().dow;
    return `<table class="hours">
      <tbody>${WEEK_ORDER.map((dow) => {
        const t = hoursText(p, dow), x = hoursExtra(p, dow);
        return `<tr class="${dow === today ? 'is-today' : ''} ${tripDays[dow] ? 'is-trip' : ''}">
          <th scope="row"><span>${DOW_KO[dow]}</span><span class="ja" lang="ja">${DOW_JA[dow]}</span></th>
          <td class="${t === '휴무' ? 'is-closed' : ''}"><span class="mono">${esc(t)}</span>${x ? `<small>${esc(x)}</small>` : ''}</td>
          <td class="hours-tag">${tripDays[dow] ? `<span class="trip-tag">${md(tripDays[dow])} 여행</span>` : dow === today ? '<span class="today-tag">오늘</span>' : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
  function scheduleBlock(p) {
    const sched = S.scheduleOf(p.id);
    if (!sched.length) {
      return `<div class="sched-empty"><span class="muted">아직 일정에 없어요.</span><button type="button" class="btn sm" data-act="schedule-place" data-id="${p.id}">${icon('plus')}일정에 넣기</button></div>`;
    }
    return `<ul class="sched-list">${sched.map(({ date, idx, item }) => {
      const t = toMin(item.time);
      const s = t != null && App.hasHours(p) ? statusAt(p, dowOf(date), t) : null;
      const bad = s && ['closed', 'before', 'after', 'break'].includes(s.code);
      return `<li><button type="button" data-act="edit-item" data-date="${date}" data-id="${item.id}">
        <span class="sched-day">Day ${idx + 1}</span><span>${md(date)} (${DOW_KO[dowOf(date)]})</span><strong class="mono">${esc(item.time || '시간 미정')}</strong>
        ${bad ? `<span class="pill tone-bad">${icon('alert')}${esc(s.short)}</span>` : ''}</button></li>`;
    }).join('')}</ul>`;
  }
  function waitBlock(p) {
    const w = p.wait || {};
    const has = w.level != null || w.method || w.reserve || w.note;
    if (!has) return '';
    return `<section class="pd-sec"><h3 class="sec-title">웨이팅 · 예약</h3>
      ${w.level != null ? `<div class="wait-meter" data-level="${w.level}" aria-label="웨이팅 ${WAIT[w.level]}">
        <span class="wm-bars">${[0, 1, 2, 3].map((i) => `<i class="${i <= w.level ? 'on' : ''}"></i>`).join('')}</span>
        <strong>${WAIT[w.level]}</strong><span class="muted">${WAIT_HINT[w.level]}</span></div>` : ''}
      <dl class="kv">
        ${w.method ? `<dt>대기 방식</dt><dd>${esc(w.method)}</dd>` : ''}
        ${w.reserve ? `<dt>예약</dt><dd>${esc(w.reserve)}</dd>` : ''}
      </dl>
      ${w.note ? `<p class="note">${esc(w.note)}</p>` : ''}
    </section>`;
  }
  function listBlock(p) {
    const c = CAT[p.cat] || CAT.base;
    const rate = S.get().trip.rate100;
    if (p.cat === 'shop') {
      const items = p.items || [];
      if (!items.length) return '';
      const left = items.filter((i) => !i.bought).reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
      return `<section class="pd-sec"><h3 class="sec-title">살 것 <span class="muted">${items.filter((i) => i.bought).length}/${items.length}</span></h3>
        <ul class="buy-list">${items.map((i) => `<li class="${i.bought ? 'is-bought' : ''}"><label>
          <input type="checkbox" data-buy="${i.id}" ${i.bought ? 'checked' : ''}><span class="buy-box">${icon('check')}</span>
          <span class="buy-name">${esc(i.name)}${Number(i.qty) > 1 ? ` <em>×${i.qty}</em>` : ''}</span>
          <span class="buy-price">${i.price != null && i.price !== '' ? `<span class="mono">${yen(i.price)}</span><small>${krw(i.price, rate)}</small>` : ''}</span>
        </label></li>`).join('')}</ul>
        ${left ? `<p class="total">남은 금액 <strong class="mono">${yen(left)}</strong> <span class="muted">${krw(left, rate)}</span></p>` : ''}
      </section>`;
    }
    const menu = p.menu || [];
    if (!menu.length) return '';
    return `<section class="pd-sec"><h3 class="sec-title">${esc(c.listLabel)}</h3>
      <ul class="menu-list">${menu.map((m) => `<li class="${m.pick ? 'is-pick' : ''}">
        <span class="menu-name">${m.pick ? `<span class="pick" title="추천">${icon('star')}</span>` : ''}${esc(m.name)}${m.note ? `<small>${esc(m.note)}</small>` : ''}</span>
        <span class="menu-dots" aria-hidden="true"></span>
        <span class="menu-price">${m.price != null && m.price !== '' ? (Number(m.price) === 0 ? '무료' : `<span class="mono">${yen(m.price)}</span><small>${krw(m.price, rate)}</small>`) : ''}</span>
      </li>`).join('')}</ul></section>`;
  }
  function payBlock(p) {
    const labels = { cash: '현금', card: '카드', ic: '교통IC카드', taxfree: '면세', kmenu: '한국어 메뉴' };
    const on = Object.keys(labels).filter((k) => p.pay && p.pay[k]);
    if (!on.length) return '';
    return `<div class="pay-chips">${on.map((k) => `<span class="chip static">${icon('check')}${labels[k]}</span>`).join('')}</div>`;
  }
  function bodyHTML(p) {
    const s = statusNow(p);
    const n = jstNow();
    const closures = S.tripClosures(p);
    return `
      <div class="pd-hero" style="--cc:${(CAT[p.cat] || CAT.base).color}">
        <div class="pd-cover">${cover(p)}</div>
        <div class="pd-titles">
          <h2 class="pd-name">${esc(p.name)}</h2>
          ${p.local ? `<p class="pd-local"><span lang="ja">${esc(p.local)}</span><button type="button" class="icon-btn xs" data-act="copy" data-copy="${esc(p.local)}" aria-label="현지 이름 복사">${icon('copy')}</button></p>` : ''}
          <p class="pd-meta">${p.area ? `<span>${icon('pin')}${esc(p.area)}</span>` : ''}<span class="prio prio-${p.priority}">${icon('star')}${PRIORITY[p.priority] || ''}</span></p>
        </div>
      </div>
      ${p.sample ? `<p class="callout">${icon('info')}<span>예시 장소예요. 영업시간·가격은 실제와 다를 수 있어요. 직접 확인한 정보로 고쳐 주세요.</span></p>` : ''}
      <div class="pd-actions">
        <a class="act" href="${esc(gmapPlace(p))}" target="_blank" rel="noopener">${icon('map')}<span>구글맵</span></a>
        <a class="act" href="${esc(gmapDir(p))}" target="_blank" rel="noopener">${icon('nav')}<span>길찾기</span></a>
        <button type="button" class="act" data-act="schedule-place" data-id="${p.id}">${icon('calendar')}<span>일정 추가</span></button>
        <button type="button" class="act ${p.visited ? 'on' : ''}" data-act="toggle-visited" data-id="${p.id}" aria-pressed="${p.visited}">${icon('check')}<span>${p.visited ? '다녀왔어요' : '방문 체크'}</span></button>
      </div>

      <section class="pd-sec">
        <div class="pd-status tone-${s.tone}"><span class="dot"></span><strong>${esc(s.label)}</strong><span class="muted">현지 ${n.hm} 기준</span></div>
        ${closures.length ? `<p class="callout bad">${icon('alert')}<span>여행 중 휴무일: ${closures.map((x) => `${md(x.date)}(${DOW_KO[x.dow]})`).join(', ')}</span></p>` : ''}
        <h3 class="sec-title">영업시간</h3>
        ${App.hasHours(p) ? hoursTable(p) : '<p class="muted">영업시간을 아직 적지 않았어요. 수정에서 요일별로 입력할 수 있어요.</p>'}
        ${p.hoursNote ? `<p class="note">${esc(p.hoursNote)}</p>` : ''}
      </section>

      <section class="pd-sec"><h3 class="sec-title">내 일정</h3>${scheduleBlock(p)}</section>
      ${waitBlock(p)}
      ${listBlock(p)}

      <section class="pd-sec"><h3 class="sec-title">위치 · 연락처</h3>
        ${p.address ? `<p class="addr"><span lang="ja">${esc(p.address)}</span><button type="button" class="btn xs" data-act="copy" data-copy="${esc(p.address)}">${icon('copy')}주소 복사</button></p>` : '<p class="muted">주소 미입력</p>'}
        ${hasLoc(p) ? '<div class="pd-minimap map"></div>' : `<p class="callout">${icon('pin')}<span>지도 위치가 없어서 대시보드 지도에 안 보여요. 수정에서 주소로 찾거나 핀을 꽂아 주세요.</span></p>`}
        <div class="link-row">
          <a class="btn sm" href="${esc(naverPlace(p))}" target="_blank" rel="noopener">네이버지도</a>
          ${p.phone ? `<a class="btn sm" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${esc(p.phone)}</a>` : ''}
          ${p.website ? `<a class="btn sm" href="${esc(p.website)}" target="_blank" rel="noopener">${icon('link')}웹사이트</a>` : ''}
        </div>
        ${payBlock(p)}
      </section>
      ${p.memo ? `<section class="pd-sec"><h3 class="sec-title">메모</h3><p class="memo">${esc(p.memo)}</p></section>` : ''}`;
  }
  function footHTML(p) {
    return `<button type="button" class="btn ghost danger-text" data-act="delete-place" data-id="${p.id}">${icon('trash')}삭제</button>
      <button type="button" class="btn primary" data-act="edit-place" data-id="${p.id}">${icon('edit')}수정</button>`;
  }
  function mountMini(sheet, p) {
    const el = sheet.querySelector('.pd-minimap');
    if (!el || !hasLoc(p)) return null;
    const m = App.Geo.createMap(el, { center: [p.lat, p.lng], zoom: 16, dragging: !L.Browser.mobile, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
    L.marker([p.lat, p.lng], { icon: App.Geo.dotIcon(p.cat), keyboard: false }).addTo(m);
    setTimeout(() => m.invalidateSize(), 300);
    return m;
  }
  function bindSheet(sheet, id) {
    sheet.querySelectorAll('[data-buy]').forEach((cb) => cb.addEventListener('change', () => {
      const p = S.place(id);
      const it = p && p.items.find((i) => i.id === cb.dataset.buy);
      if (it) { it.bought = cb.checked; S.commit(); }
    }));
  }
  function openPlace(id) {
    const top = UI.topLayer();
    if (top && top.placeId === id) return;
    const p = S.place(id);
    if (!p) return;
    let mini = null;
    const entry = UI.openSheet({
      title: p.name, cls: 'sheet-place', head: headHTML(p), body: bodyHTML(p), foot: footHTML(p),
      onMount: (sheet) => { mini = mountMini(sheet, p); bindSheet(sheet, id); },
      onClose: () => App.Geo.destroyMap(mini),
    });
    entry.placeId = id;
    entry.refresh = () => {
      const q = S.place(id);
      if (!q) return;
      const body = entry.sheet.querySelector('.sheet-body');
      const y = body.scrollTop;
      App.Geo.destroyMap(mini);
      entry.sheet.querySelector('.head-slot').outerHTML = headHTML(q);
      body.innerHTML = bodyHTML(q);
      body.scrollTop = y;
      mini = mountMini(entry.sheet, q);
      bindSheet(entry.sheet, id);
    };
  }

  App.on('open-place', (el) => openPlace(el.dataset.id));
  App.on('copy', (el) => App.copyText(el.dataset.copy));
  App.on('toggle-visited', (el) => { const p = S.place(el.dataset.id); if (p) { S.patchPlace(p.id, { visited: !p.visited }); App.toast(p.visited ? '방문 완료로 표시했어요' : '방문 표시를 지웠어요'); } });
  App.on('add-place', () => {
    const route = App.router ? App.router.current() : 'home';
    App.PlaceForm.open({ cat: route === 'list' ? st.cat : 'food' });
  });
  App.on('edit-place', (el) => App.PlaceForm.open({ id: el.dataset.id }));
  App.on('delete-place', async (el) => {
    const p = S.place(el.dataset.id);
    if (!p) return;
    const n = S.scheduleOf(p.id).length;
    const ok = await UI.confirm({ title: '장소 삭제', body: `<strong>${esc(p.name)}</strong>을(를) 지울까요?${n ? `<br>일정 ${n}곳에서도 함께 빠져요.` : ''} 되돌릴 수 없어요.`, ok: '삭제', danger: true });
    if (!ok) return;
    UI.closeTop();
    S.removePlace(p.id);
    App.toast('삭제했어요');
  });

  App.Places = { card, cover, pill, openPlace, popupHTML };
  App.List = List;
})(window.App);

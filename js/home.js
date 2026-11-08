/* 후쿠오카 여행 노트 — 메인 대시보드: 동선 지도 + 날짜별 타임라인 + 지금/다음 */
(function (App) {
  'use strict';
  const { S, esc, icon, CAT, CATS, DOW_JA, DOW_KO, md, mdDot, jstNow, diffDays, hasLoc, gmapDir, gmapRoute, statusNow, yen, krw, num } = App;

  let root = null, map = null, groups = {}, markerByItem = {}, holder = {};
  const st = { day: null, others: true, big: false };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2D63D6';
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  function phase() {
    const dates = S.tripDates();
    const today = jstNow().date;
    if (today < dates[0]) return { k: 'before', d: diffDays(today, dates[0]) };
    if (today > dates[dates.length - 1]) return { k: 'after' };
    return { k: 'during', idx: dates.indexOf(today), date: today };
  }
  function defaultDay() { const p = phase(); return p.k === 'during' ? p.date : 'all'; }

  /* ---------- 패널 ---------- */
  function headHTML() {
    const t = S.get().trip;
    const dates = S.tripDates();
    const p = phase();
    const first = dates[0], last = dates[dates.length - 1];
    const badge = p.k === 'before' ? `<span class="dday-num mono">D-${p.d}</span><span>출발까지</span>`
      : p.k === 'during' ? `<span class="dday-num">${p.idx + 1}일차</span><span>여행 중</span>`
      : `<span class="dday-num">끝</span><span>다녀왔어요</span>`;
    return `<div class="trip-head">
      <div class="trip-mark" lang="ja" aria-hidden="true">福岡</div>
      <div class="trip-txt">
        <p class="eyebrow">${first.slice(0, 4)} · ${dates.length - 1}박 ${dates.length}일</p>
        <h1>${esc(t.title || '후쿠오카')}</h1>
        <p class="trip-dates"><span class="mono">${mdDot(first)}</span> <span lang="ja">${DOW_JA[App.dowOf(first)]}</span> — <span class="mono">${mdDot(last)}</span> <span lang="ja">${DOW_JA[App.dowOf(last)]}</span></p>
      </div>
      <div class="dday is-${p.k}">${badge}</div>
    </div>`;
  }
  function bannerHTML() {
    if (!S.get().meta.sample) return '';
    return `<div class="banner">
      <div><strong>예시 데이터로 채워져 있어요</strong><p>화면을 둘러본 뒤 지우고 직접 입력을 시작하세요. 기본 체크리스트와 비상 연락처는 남겨 둬요.</p></div>
      <button type="button" class="btn sm" data-act="clear-sample">예시 지우기</button>
    </div>`;
  }
  function tabsHTML() {
    const days = S.days();
    const today = jstNow().date;
    return `<div class="day-tabs" role="tablist" aria-label="날짜 선택">
      <button type="button" role="tab" class="day-tab ${st.day === 'all' ? 'on' : ''}" data-act="home-day" data-date="all" aria-selected="${st.day === 'all'}">
        <span class="dt-top">전체</span><span class="dt-main">${days.length}일</span><span class="dt-wx muted">동선 비교</span></button>
      ${days.map((d) => `<button type="button" role="tab" class="day-tab ${st.day === d.date ? 'on' : ''}" data-act="home-day" data-date="${d.date}" style="--dc:${App.Plan.dayColor(d.idx)}" aria-selected="${st.day === d.date}">
        <span class="dt-top">Day ${d.idx + 1}${d.date === today ? ' · 오늘' : ''}</span>
        <span class="dt-main"><span class="mono">${md(d.date)}</span> <span lang="ja">${DOW_JA[d.dow]}</span></span>
        <span class="dt-wx" data-wx="${d.date}"><span class="muted">${d.items.length}곳</span></span></button>`).join('')}
    </div>`;
  }
  function nowCardHTML() {
    const p = phase();
    if (p.k !== 'during' || st.day !== p.date) return '';
    const rows = App.Plan.analyze(p.date);
    const now = jstNow().min;
    let cur = null, next = null;
    rows.forEach((r) => { if (r.t == null) return; if (r.t <= now) cur = r; else if (!next) next = r; });
    const title = (r) => esc(S.itemTitle(r.item));
    const left = next ? next.t - now : 0;
    const leftTxt = left >= 60 ? `${Math.floor(left / 60)}시간 ${left % 60}분 후` : `${left}분 후`;
    return `<div class="now-card">
      <div class="now-row"><span class="now-tag">지금</span>
        ${cur ? `<button type="button" class="now-name" data-act="home-focus" data-id="${cur.item.id}">${title(cur)}</button><span class="mono">${esc(cur.item.time)}</span>` : '<span class="muted">오늘 첫 일정 전이에요</span>'}</div>
      <div class="now-row is-next"><span class="now-tag">다음</span>
        ${next ? `<button type="button" class="now-name" data-act="home-focus" data-id="${next.item.id}">${title(next)}</button><span class="mono">${esc(next.item.time)} · ${leftTxt}</span>
          ${next.located ? `<a class="btn sm primary" href="${esc(gmapDir(next.loc, cur && cur.located ? cur.loc : null))}" target="_blank" rel="noopener">${icon('nav')}길찾기</a>` : ''}` : '<span class="muted">오늘 남은 일정이 없어요</span>'}</div>
    </div>`;
  }
  function tlRows(date, opts = {}) {
    const rows = App.Plan.analyze(date);
    const p = phase();
    const isToday = p.k === 'during' && p.date === date;
    const now = jstNow().min;
    let curIdx = -1;
    if (isToday) rows.forEach((r, i) => { if (r.t != null && r.t <= now) curIdx = i; });
    if (!rows.length) return `<li class="tl-empty"><span class="muted">일정이 없어요.</span> <button type="button" class="btn xs" data-act="add-item" data-date="${date}">${icon('plus')}추가</button></li>`;
    return rows.map((r, i) => {
      const it = r.item;
      const cls = [isToday && i < curIdx ? 'is-past' : '', isToday && i === curIdx ? 'is-now' : '', it.done ? 'is-done' : ''].join(' ');
      return `<li class="tl-item ${cls}" style="--cc:${App.Plan.locColor(r)}" data-item="${it.id}">
        <span class="tl-time mono">${esc(it.time || '--:--')}</span>
        <span class="tl-num">${r.num || '·'}</span>
        <div class="tl-main">
          <button type="button" class="tl-title" data-act="home-focus" data-id="${it.id}">${esc(S.itemTitle(it))}</button>
          <span class="tl-sub">${App.Plan.subLine(r)}${it.end ? ` · ~${esc(it.end)}` : ''}</span>
          ${r.warn ? `<span class="pwarn">${icon('alert')}${esc(App.Plan.warnText(r.warn))}</span>` : ''}
        </div>
        <button type="button" class="icon-btn xs tl-more" data-act="item-open" data-date="${date}" data-id="${it.id}" aria-label="상세">${icon('right')}</button>
      </li>${opts.noSeg ? '' : App.Plan.segHTML(r, { compact: true })}`;
    }).join('');
  }
  function timelineHTML() {
    const days = S.days();
    if (st.day === 'all') {
      return days.map((d) => {
        const rows = App.Plan.analyze(d.date).filter((r) => r.located);
        const route = gmapRoute(rows.map((r) => r.loc));
        return `<section class="tl-day" style="--dc:${App.Plan.dayColor(d.idx)}">
          <header><button type="button" class="tl-day-btn" data-act="home-day" data-date="${d.date}"><span class="dnum">Day ${d.idx + 1}</span><strong class="mono">${md(d.date)}</strong><span lang="ja">${DOW_JA[d.dow]}</span></button>
            <span class="tl-day-memo">${esc(d.memo || '')}</span>
            ${route ? `<a class="btn xs ghost" href="${esc(route)}" target="_blank" rel="noopener">${icon('map')}경로</a>` : ''}</header>
          <ol class="tl compact">${tlRows(d.date, { noSeg: true })}</ol>
        </section>`;
      }).join('');
    }
    const d = days.find((x) => x.date === st.day);
    const rows = App.Plan.analyze(d.date).filter((r) => r.located);
    const route = gmapRoute(rows.map((r) => r.loc));
    return `<section class="tl-day single" style="--dc:${App.Plan.dayColor(d.idx)}">
      <header><span class="tl-day-memo strong">${esc(d.memo || `Day ${d.idx + 1}`)}</span>
        ${route ? `<a class="btn xs ghost" href="${esc(route)}" target="_blank" rel="noopener">${icon('map')}구글맵 경로</a>` : ''}
        <a class="btn xs ghost" href="#plan">${icon('edit')}편집</a></header>
      <ol class="tl">${tlRows(d.date)}</ol>
      <button type="button" class="btn add-item" data-act="add-item" data-date="${d.date}">${icon('plus')}일정 추가</button>
    </section>`;
  }
  function footHTML() {
    const s = S.get();
    const cl = s.info.checklist;
    const done = cl.filter((c) => c.done).length;
    const pct = cl.length ? Math.round((done / cl.length) * 100) : 0;
    return `<div class="home-foot">
      <div class="stat-row">${CATS.slice(0, 4).map((c) => `<a class="stat" href="#list-${c.id}" style="--cc:${c.color}">${icon(c.icon)}<b class="mono">${S.places(c.id).length}</b><span>${c.short}</span></a>`).join('')}</div>
      <a class="prep" href="#info">
        <span class="prep-top"><strong>준비 체크리스트</strong><span class="mono">${done}/${cl.length}</span></span>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </a>
      <div class="conv">
        <label for="convYen" class="conv-in"><span>¥</span><input id="convYen" inputmode="numeric" value="1000" aria-label="엔화 금액"></label>
        <span class="conv-eq">=</span>
        <strong class="mono" id="convKrw">${krw(1000, s.trip.rate100).replace('약 ', '')}</strong>
        <small class="muted">100엔 = ${Number(s.trip.rate100).toLocaleString('ko-KR')}원 · 준비 탭에서 변경</small>
      </div>
    </div>`;
  }
  function renderPanel() {
    const panel = root && root.querySelector('#homePanel');
    if (!panel) return;
    const y = panel.scrollTop;
    panel.innerHTML = headHTML() + bannerHTML() + tabsHTML() + nowCardHTML() + `<div class="timeline">${timelineHTML()}</div>` + footHTML();
    panel.scrollTop = y;
    const yenIn = panel.querySelector('#convYen');
    yenIn.addEventListener('input', () => { panel.querySelector('#convKrw').textContent = krw(num(yenIn.value) || 0, S.get().trip.rate100).replace('약 ', '') || '0원'; });
    panel.querySelectorAll('.tl-item').forEach((li) => {
      li.addEventListener('mouseenter', () => hot(li.dataset.item, true));
      li.addEventListener('mouseleave', () => hot(li.dataset.item, false));
    });
    App.Plan.fillWeather(panel);
  }

  /* ---------- 지도 ---------- */
  function hot(id, on) {
    const m = markerByItem[id];
    if (m && m._icon) { m._icon.classList.toggle('is-hot', on); m.setZIndexOffset(on ? 900 : 0); }
  }
  function itemPopup(r, d) {
    const loc = r.loc;
    const place = loc && !loc.isStay ? loc : null;
    const s = place ? statusNow(place) : null;
    return `<div class="pop">
      <span class="pop-day" style="--dc:${App.Plan.dayColor(d.idx)}">Day ${d.idx + 1} · ${esc(r.item.time || '시간 미정')}</span>
      <strong>${esc(S.itemTitle(r.item))}</strong>${loc && loc.local ? `<span lang="ja">${esc(loc.local)}</span>` : ''}
      ${s ? `<div class="pop-tags">${App.Places.pill(s)}${r.warn ? `<span class="pill tone-bad">${esc(App.Plan.warnText(r.warn))}</span>` : ''}</div>` : ''}
      <div class="pop-acts">
        ${place ? `<button type="button" class="btn sm primary" data-act="open-place" data-id="${place.id}">상세 보기</button>` : ''}
        <a class="btn sm" href="${esc(gmapDir(loc))}" target="_blank" rel="noopener">${icon('nav')}길찾기</a>
      </div></div>`;
  }
  function draw(fit) {
    if (!map) return;
    Object.values(groups).forEach((g) => g.clearLayers());
    markerByItem = {};
    const days = S.days();
    const sel = st.day === 'all' ? days : days.filter((d) => d.date === st.day);
    const shown = new Set();
    const pts = [];
    const p = phase();
    const surface = cssVar('--surface');
    sel.forEach((d) => {
      const rows = App.Plan.analyze(d.date).filter((r) => r.located);
      const color = cssVar(`--day${(d.idx % 5) + 1}`);
      const line = rows.map((r) => [r.loc.lat, r.loc.lng]);
      if (line.length > 1) {
        L.polyline(line, { color: surface, weight: 8, opacity: 0.85, interactive: false, lineJoin: 'round' }).addTo(groups.route);
        L.polyline(line, { color, weight: 4, opacity: 0.95, interactive: false, lineJoin: 'round', dashArray: st.day === 'all' ? '8 7' : null }).addTo(groups.route);
      }
      const now = jstNow().min;
      rows.forEach((r) => {
        if (r.loc && r.loc.id) shown.add(r.loc.id);
        const isNow = p.k === 'during' && p.date === d.date && r.t != null && r.t <= now;
        const m = L.marker([r.loc.lat, r.loc.lng], {
          icon: App.Geo.numIcon(r.num, r.loc.isStay ? 'stay' : r.loc.cat, { done: r.item.done, ring: st.day === 'all' ? color : null }),
          title: S.itemTitle(r.item), riseOnHover: true, zIndexOffset: isNow ? 500 : 0,
        }).bindPopup(itemPopup(r, d), { closeButton: false, minWidth: 210, autoPanPadding: [30, 30] });
        m.addTo(groups.marks);
        markerByItem[r.item.id] = m;
        pts.push([r.loc.lat, r.loc.lng]);
      });
    });
    if (st.others) {
      S.places().filter((pl) => hasLoc(pl) && !shown.has(pl.id) && (st.day !== 'all' || !S.scheduleOf(pl.id).length)).forEach((pl) => {
        L.marker([pl.lat, pl.lng], { icon: App.Geo.dotIcon(pl.cat), title: pl.name, opacity: 0.85 })
          .bindPopup(App.Places.popupHTML(pl), { closeButton: false, minWidth: 200 }).addTo(groups.others);
      });
    }
    const stay = S.stayLoc();
    if (hasLoc(stay) && !shown.has('__stay')) {
      L.marker([stay.lat, stay.lng], { icon: App.Geo.stayIcon(), title: '숙소' })
        .bindPopup(`<div class="pop"><span class="pop-day">숙소</span><strong>${esc(stay.name)}</strong><div class="pop-acts"><a class="btn sm" href="${esc(gmapDir(stay))}" target="_blank" rel="noopener">${icon('nav')}길찾기</a></div></div>`, { closeButton: false })
        .addTo(groups.others);
    }
    if (fit) {
      const m = map;
      App.Geo.whenSized(m, () => {
        if (pts.length > 1) m.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 15, animate: false });
        else if (pts.length === 1) m.setView(pts[0], 15, { animate: false });
        else {
          const all = S.places().filter(hasLoc).map((x) => [x.lat, x.lng]);
          if (all.length) m.fitBounds(L.latLngBounds(all).pad(0.15), { maxZoom: 14, animate: false });
        }
      });
    }
    legend();
  }
  function legend() {
    const el = root && root.querySelector('#mapLegend');
    if (!el) return;
    const days = S.days();
    el.innerHTML = st.day === 'all'
      ? days.map((d) => `<span><i class="lg-line" style="--dc:${App.Plan.dayColor(d.idx)}"></i>Day ${d.idx + 1}</span>`).join('')
      : CATS.slice(0, 4).map((c) => `<span><i class="lg-dot" style="--cc:${c.color}"></i>${c.short}</span>`).join('') + '<span><i class="lg-dot" style="--cc:var(--accent)"></i>숙소</span>';
  }
  function initMap() {
    const el = root.querySelector('#homeMap');
    map = App.Geo.createMap(el);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    groups = { route: L.layerGroup().addTo(map), others: L.layerGroup().addTo(map), marks: L.layerGroup().addTo(map) };
    holder = {};
    setTimeout(() => { if (map) { map.invalidateSize(); draw(true); } }, 50);
  }
  function focusItem(id) {
    const m = markerByItem[id];
    if (!m) { App.toast('지도 위치가 없는 일정이에요'); return; }
    const mapEl = root.querySelector('.home-map');
    if (mapEl && mapEl.getBoundingClientRect().bottom < 80) window.scrollTo({ top: 0, behavior: 'smooth' });
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 15.5), { duration: 0.55 });
    setTimeout(() => m.openPopup(), 560);
  }
  const onTheme = () => draw(false);

  function render() {
    if (!st.day || (st.day !== 'all' && !S.tripDates().includes(st.day))) st.day = defaultDay();
    root.innerHTML = `<div class="home ${st.big ? 'map-big' : ''}">
      <section class="home-map" aria-label="동선 지도">
        <div id="homeMap" class="map"></div>
        <div class="map-ui">
          <button type="button" class="map-btn" data-act="home-fit" title="일정 전체 보기" aria-label="일정 전체 보기">${icon('expand')}</button>
          <button type="button" class="map-btn" data-act="home-locate" title="내 위치" aria-label="내 위치">${icon('locate')}</button>
          <button type="button" class="map-btn ${st.others ? 'on' : ''}" data-act="home-others" title="다른 저장 장소 표시" aria-label="다른 저장 장소 표시" aria-pressed="${st.others}">${icon('layers')}</button>
        </div>
        <div class="map-legend" id="mapLegend"></div>
        <button type="button" class="map-size" data-act="home-big" aria-label="${st.big ? '지도 작게' : '지도 크게'}">${icon(st.big ? 'up' : 'down')}<span>${st.big ? '지도 작게' : '지도 크게'}</span></button>
      </section>
      <section class="home-panel" id="homePanel"></section>
    </div>`;
    renderPanel();
    initMap();
  }

  App.on('home-day', (el) => { st.day = el.dataset.date; renderPanel(); draw(true); });
  App.on('home-focus', (el) => focusItem(el.dataset.id));
  App.on('home-fit', () => draw(true));
  App.on('home-locate', () => App.Geo.locate(map, holder));
  App.on('home-others', (el) => { st.others = !st.others; el.classList.toggle('on', st.others); el.setAttribute('aria-pressed', st.others); draw(false); });
  App.on('home-big', () => { st.big = !st.big; const h = root.querySelector('.home'); h.classList.toggle('map-big', st.big); const b = root.querySelector('.map-size'); b.innerHTML = `${icon(st.big ? 'up' : 'down')}<span>${st.big ? '지도 작게' : '지도 크게'}</span>`; setTimeout(() => map && map.invalidateSize(), 260); });
  App.on('clear-sample', async () => {
    const ok = await App.UI.confirm({ title: '예시 데이터 지우기', body: '예시 장소·일정·메모·숙소를 모두 지울까요?<br>기본 체크리스트와 비상 연락처, 직접 입력한 내용은 남아요.', ok: '예시 지우기', danger: true });
    if (!ok) return;
    S.clearSample();
    App.toast('예시를 지웠어요. 이제 직접 채워 보세요!');
  });

  App.Home = {
    mount(el) { root = el; render(); mql.addEventListener('change', onTheme); },
    unmount() { mql.removeEventListener('change', onTheme); App.Geo.destroyMap(map); map = null; root = null; },
    refresh() { if (!root) return; renderPanel(); draw(false); },
    tick() { if (root) renderPanel(); },
    resize() { if (map) map.invalidateSize(); },
    onTheme,
  };
})(window.App);

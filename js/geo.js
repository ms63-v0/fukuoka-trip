/* 후쿠오카 여행 노트 — 지도(Leaflet), 주소 검색, 구글맵 링크 해석, 날씨, 위치 선택기 */
(function (App) {
  'use strict';
  const { esc, icon, CAT, toHalf, hasLoc } = App;
  const CENTER = [33.5902, 130.4017];
  const FUKUOKA_BOX = '130.15,33.75,130.70,33.40';

  /* ---------- 테마 / 타일 ---------- */
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  // OpenStreetMap 기본 타일 (키 불필요, 일본 지명은 현지어 표기). 다크 모드는 CSS 필터로 반전.
  const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  function tileLayer() {
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: ATTR, maxZoom: 19, crossOrigin: true });
  }
  const maps = new Set();
  function createMap(el, opts = {}) {
    const map = L.map(el, Object.assign({ zoomControl: false, attributionControl: true, center: CENTER, zoom: 13, zoomSnap: 0.5, maxZoom: 19 }, opts));
    map.attributionControl.setPrefix(false);
    map._tile = tileLayer().addTo(map);
    el.classList.toggle('is-dark-tiles', isDark());
    maps.add(map);
    // 컨테이너 크기가 바뀌면(시트 애니메이션, 숨겨진 탭, 회전) 지도를 다시 맞추고, 기다리던 범위 맞추기를 실행
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (!el.isConnected || !map._loaded) return;
        map.invalidateSize();
        if (map._pendingFit && el.clientWidth > 0 && el.clientHeight > 0) { const f = map._pendingFit; map._pendingFit = null; f(); }
      });
      ro.observe(el);
      map.on('unload', () => ro.disconnect());
    }
    map.on('unload', () => maps.delete(map));
    return map;
  }
  // 지도 크기가 0일 때 fitBounds 하면 세계 지도가 되므로, 크기가 생긴 뒤에 실행
  function whenSized(map, fn) {
    const el = map.getContainer();
    if (el.clientWidth > 0 && el.clientHeight > 0) { map.invalidateSize(); fn(); } else map._pendingFit = fn;
  }
  function destroyMap(map) { if (!map) return; maps.delete(map); try { map.remove(); } catch (e) { /* already gone */ } }
  function retheme() {
    maps.forEach((m) => m.getContainer().classList.toggle('is-dark-tiles', isDark()));
  }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);

  /* ---------- 마커 ---------- */
  function catColor(cat) { return cat === 'stay' ? 'var(--accent)' : (CAT[cat] || CAT.base).color; }
  function numIcon(n, cat, opts = {}) {
    return L.divIcon({
      className: 'mk-wrap',
      html: `<div class="mk mk-num ${opts.done ? 'is-done' : ''} ${opts.now ? 'is-now' : ''}" style="--mc:${catColor(cat)};--ring:${opts.ring || 'var(--surface)'}"><span>${n}</span></div>`,
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
    });
  }
  function dotIcon(cat) {
    const c = CAT[cat] || CAT.base;
    return L.divIcon({
      className: 'mk-wrap',
      html: `<div class="mk mk-dot" style="--mc:${c.color}">${icon(c.icon)}</div>`,
      iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -11],
    });
  }
  function stayIcon() {
    return L.divIcon({ className: 'mk-wrap', html: `<div class="mk mk-stay">${icon('bed')}</div>`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -15] });
  }
  function meIcon() {
    return L.divIcon({ className: 'mk-wrap', html: '<div class="mk-me"><span></span></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  }
  function pinIcon() {
    return L.divIcon({ className: 'mk-wrap', html: `<div class="mk-pin">${icon('pin')}</div>`, iconSize: [36, 36], iconAnchor: [18, 34] });
  }

  /* ---------- 내 위치 ---------- */
  function locate(map, holder) {
    if (!navigator.geolocation) { App.toast('이 브라우저는 위치 기능을 지원하지 않아요.'); return; }
    App.toast('현재 위치를 찾는 중…');
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = [pos.coords.latitude, pos.coords.longitude];
      if (holder.me) holder.me.setLatLng(p); else holder.me = L.marker(p, { icon: meIcon(), zIndexOffset: 900, keyboard: false }).addTo(map);
      map.flyTo(p, Math.max(map.getZoom(), 15), { duration: 0.6 });
    }, (err) => {
      App.toast(err.code === 1 ? '위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.' : '위치를 찾지 못했어요.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  /* ---------- 구글맵 링크 해석 ---------- */
  function parseGmap(raw) {
    const url = String(raw || '').trim();
    if (!url) return null;
    const out = { lat: null, lng: null, name: '', short: /goo\.gl|maps\.app/.test(url) };
    let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (!m) m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!m) m = url.match(/[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i);
    if (!m) m = url.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)$/);
    if (m) { out.lat = +m[1]; out.lng = +m[2]; }
    const n = url.match(/\/place\/([^/@?]+)/);
    if (n) { try { out.name = decodeURIComponent(n[1].replace(/\+/g, ' ')); } catch (e) { out.name = n[1]; } }
    return out;
  }

  /* ---------- 주소 검색 (OpenStreetMap Nominatim → Photon) ---------- */
  function simplifyJa(q) {
    return toHalf(q).replace(/(\d+(丁目|番地|番|号)?[\-の]?)+\s*$/u, '').replace(/[\s,]+$/, '').trim();
  }
  async function nominatim(q) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=jp&accept-language=ko,ja&viewbox=${FUKUOKA_BOX}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('nominatim ' + r.status);
    const data = await r.json();
    return data.map((d) => ({ lat: +d.lat, lng: +d.lon, title: d.name || d.display_name.split(',')[0], label: d.display_name }));
  }
  async function photon(q) {
    const url = `https://photon.komoot.io/api/?limit=6&lat=${CENTER[0]}&lon=${CENTER[1]}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('photon ' + r.status);
    const data = await r.json();
    return (data.features || []).map((f) => {
      const p = f.properties || {};
      const label = [p.name, p.street, p.district, p.city, p.state].filter(Boolean).join(', ');
      return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], title: p.name || label.split(',')[0], label };
    });
  }
  /* 일본 주소는 OSM에 "中洲五丁目"(초메) 단위로만 들어 있는 경우가 많아서,
     원문 → "구+동네+N丁目" → "구+동네" 순서로 점점 넓혀 가며 찾는다. */
  function jaAddressVariants(raw) {
    const s = toHalf(raw).replace(/\s+/g, '').replace(/^〒?\d{3}-?\d{4}/, '');
    const out = [];
    const m = s.match(/^(.*?\D)(\d+)(?:丁目|-|の|番)/);
    const prefix = (m ? m[1] : s.replace(/[\d\-の番地号]+$/u, '')).replace(/^.*?[都道府県]/u, '');
    const short = prefix.replace(/^.+?市(?=.+?区)/u, '');
    const chome = m ? Number(m[2]) : null;
    if (chome && chome <= 20) out.push(`${short}${chome}丁目`);
    if (short) out.push(short);
    if (chome && chome <= 20 && short !== prefix) out.push(`${prefix}${chome}丁目`);
    if (prefix && prefix !== short) out.push(prefix);
    return [...new Set(out)].filter((v) => v && v !== s && v.length >= 2);
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function geocode(query, kind = 'addr') {
    const q = toHalf(query).trim();
    if (!q) return { results: [], approx: false };
    const direct = parseGmap(q);
    if (direct && direct.lat != null) return { results: [{ lat: direct.lat, lng: direct.lng, title: '입력한 좌표', label: `${direct.lat}, ${direct.lng}` }], approx: false };
    const attempts = [q, ...(kind === 'addr' ? jaAddressVariants(q) : [])].slice(0, 4);
    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
      if (i > 0) await wait(1050); // Nominatim 이용 정책: 초당 1회
      try {
        const res = await nominatim(attempts[i]);
        if (res.length) return { results: res, approx: i > 0 };
      } catch (e) { lastErr = e; }
    }
    if (kind === 'name') {
      try { const res = await photon(q); if (res.length) return { results: res, approx: true }; } catch (e) { lastErr = e; }
    }
    if (lastErr && !navigator.onLine) throw new Error('offline');
    return { results: [], approx: false };
  }

  /* ---------- 날씨 (Open-Meteo, 키 불필요) ---------- */
  const WMO = (c) => {
    if (c === 0) return ['맑음', 'sun'];
    if (c <= 2) return ['구름 조금', 'sun'];
    if (c === 3) return ['흐림', 'cloud'];
    if (c <= 48) return ['안개', 'cloud'];
    if (c <= 67 || (c >= 80 && c <= 82)) return ['비', 'rain'];
    if (c <= 77 || c === 85 || c === 86) return ['눈', 'snow'];
    if (c >= 95) return ['뇌우', 'rain'];
    return ['—', 'cloud'];
  };
  let weatherPromise = null;
  function weather(start, end) {
    const key = 'fukuoka-trip:weather';
    if (weatherPromise) return weatherPromise;
    weatherPromise = (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached && cached.start === start && cached.end === end && Date.now() - cached.at < 3 * 3600e3) return cached.data;
      } catch (e) { /* ignore */ }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${CENTER[0]}&longitude=${CENTER[1]}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&start_date=${start}&end_date=${end}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j.daily) return null;
      const data = {};
      j.daily.time.forEach((d, i) => {
        const [label, ic] = WMO(j.daily.weather_code[i]);
        data[d] = { label, icon: ic, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), pop: j.daily.precipitation_probability_max[i] };
      });
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), start, end, data })); } catch (e) { /* ignore */ }
      return data;
    })().catch(() => null);
    return weatherPromise;
  }
  function resetWeather() { weatherPromise = null; try { localStorage.removeItem('fukuoka-trip:weather'); } catch (e) { /* ignore */ } }

  /* ---------- 위치 선택기 (장소 폼 · 숙소 폼에서 재사용) ---------- */
  function locPicker(root, { lat, lng, getQuery, onGmap, onChange }) {
    root.innerHTML = `
      <div class="lp">
        <label class="field">
          <span class="field-label">구글맵 링크 붙여넣기 <em>가장 정확해요</em></span>
          <input type="url" class="input" id="lpGmap" placeholder="https://www.google.com/maps/place/…" autocomplete="off">
        </label>
        <div class="lp-actions">
          <button type="button" class="btn sm" data-lp="addr">${icon('search')}주소로 찾기</button>
          <button type="button" class="btn sm" data-lp="name">${icon('search')}현지 이름으로 찾기</button>
          <button type="button" class="btn sm ghost" data-lp="clear">핀 지우기</button>
        </div>
        <ul class="lp-results" hidden></ul>
        <div class="lp-map map"></div>
        <p class="lp-coord"></p>
      </div>`;
    const $ = (s) => root.querySelector(s);
    let cur = hasLoc({ lat, lng }) ? { lat, lng } : null;
    const map = createMap($('.lp-map'), { zoom: cur ? 16 : 12, center: cur ? [cur.lat, cur.lng] : CENTER, scrollWheelZoom: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    let marker = null;
    function paint(fly) {
      if (cur) {
        if (!marker) {
          marker = L.marker([cur.lat, cur.lng], { icon: pinIcon(), draggable: true, autoPan: true }).addTo(map);
          marker.on('dragend', () => { const p = marker.getLatLng(); cur = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }; paint(false); });
        } else marker.setLatLng([cur.lat, cur.lng]);
        if (fly) map.flyTo([cur.lat, cur.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
        $('.lp-coord').innerHTML = `${icon('pin')}<span>핀 위치 ${cur.lat.toFixed(5)}, ${cur.lng.toFixed(5)}</span><span class="muted">· 지도를 탭하거나 핀을 끌어 조정</span>`;
      } else {
        if (marker) { map.removeLayer(marker); marker = null; }
        $('.lp-coord').innerHTML = `${icon('info')}<span class="muted">아직 위치가 없어요. 위에서 찾거나 지도를 탭해 핀을 꽂으세요.</span>`;
      }
      onChange && onChange(cur);
    }
    map.on('click', (e) => { cur = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }; paint(false); });
    const results = $('.lp-results');
    function showResults(list, approx) {
      results.hidden = false;
      if (!list.length) {
        results.innerHTML = `<li class="lp-empty">검색 결과가 없어요. 일본어 주소에서 번지를 빼거나, 구글맵 링크를 붙여넣거나, 지도를 직접 탭해 주세요.</li>`;
        return;
      }
      results.innerHTML = (approx ? `<li class="lp-note">${icon('alert')}번지까지는 못 찾아서 근처 지역을 보여줘요. 고른 뒤 핀을 끌어 맞춰 주세요.</li>` : '') +
        list.map((r, i) => `<li><button type="button" data-pick="${i}"><strong>${esc(r.title)}</strong><span>${esc(r.label)}</span></button></li>`).join('');
      results.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
        const r = list[+b.dataset.pick];
        cur = { lat: +r.lat.toFixed(6), lng: +r.lng.toFixed(6) };
        results.hidden = true;
        paint(true);
      }));
    }
    async function search(kind) {
      const q = getQuery(kind);
      if (!q) { App.toast(kind === 'addr' ? '먼저 주소를 입력해 주세요.' : '먼저 현지 이름(일본어)을 입력해 주세요.'); return; }
      results.hidden = false;
      results.innerHTML = `<li class="lp-empty">찾는 중…</li>`;
      try {
        const { results: list, approx } = await geocode(q, kind);
        showResults(list, approx);
      } catch (e) {
        results.innerHTML = `<li class="lp-empty">검색 서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 지도를 직접 탭해 주세요.</li>`;
      }
    }
    root.querySelector('[data-lp="addr"]').addEventListener('click', () => search('addr'));
    root.querySelector('[data-lp="name"]').addEventListener('click', () => search('name'));
    root.querySelector('[data-lp="clear"]').addEventListener('click', () => { cur = null; paint(false); });
    $('#lpGmap').addEventListener('input', (e) => {
      const g = parseGmap(e.target.value);
      if (!g) return;
      if (g.lat != null) { cur = { lat: g.lat, lng: g.lng }; paint(true); App.toast('링크에서 위치를 가져왔어요'); }
      else if (g.short) App.toast('짧은 링크(maps.app.goo.gl)는 좌표가 없어요. 링크를 열어 주소창의 긴 주소를 붙여넣어 주세요.');
      onGmap && onGmap(e.target.value.trim(), g);
    });
    setTimeout(() => { map.invalidateSize(); paint(false); }, 320);
    return {
      get: () => cur,
      setGmap: (v) => { $('#lpGmap').value = v || ''; },
      invalidate: () => map.invalidateSize(),
      destroy: () => destroyMap(map),
    };
  }

  App.Geo = { CENTER, createMap, whenSized, destroyMap, retheme, isDark, numIcon, dotIcon, stayIcon, pinIcon, locate, parseGmap, geocode, weather, resetWeather, locPicker, catColor };
})(window.App);

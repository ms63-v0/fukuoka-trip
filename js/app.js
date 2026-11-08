/* 후쿠오카 여행 노트 — 앱 셸, 라우터, 테마, 시작 */
(function (App) {
  'use strict';
  const { S, icon, esc, jstNow, diffDays } = App;

  const NAV = [
    { id: 'home', label: '홈', icon: 'map', hash: '#home' },
    { id: 'plan', label: '일정', icon: 'calendar', hash: '#plan' },
    { id: 'list', label: '리스트', icon: 'list', hash: '#list-food' },
    { id: 'info', label: '준비', icon: 'note', hash: '#info' },
  ];
  const VIEWS = () => ({ home: App.Home, plan: App.Plan, list: App.List, info: App.Info });

  function applyTheme() {
    const t = S.get().meta.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    App.Geo.retheme();
    if (App.Home && App.router && App.router.current() === 'home') App.Home.onTheme();
  }

  function dday() {
    const dates = S.tripDates();
    const today = jstNow().date;
    if (today < dates[0]) return `D-${diffDays(today, dates[0])}`;
    if (today > dates[dates.length - 1]) return '여행 끝';
    return `${dates.indexOf(today) + 1}일차`;
  }

  function shell() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <aside class="rail">
        <a class="brand" href="#home" aria-label="홈으로">
          <span class="brand-mark" lang="ja">福岡</span>
          <span class="brand-txt"><strong>후쿠오카 노트</strong><span class="mono" data-trip-range></span></span>
        </a>
        <nav class="rail-nav" aria-label="주 메뉴">
          ${NAV.map((n) => `<a href="${n.hash}" class="nav-a" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
        </nav>
        <div class="rail-cats">
          <p class="eyebrow">리스트</p>
          ${App.CATS.map((c) => `<a href="#list-${c.id}" class="rail-cat" data-navcat="${c.id}" style="--cc:${c.color}"><i></i>${c.label}<b class="mono" data-railcount="${c.id}"></b></a>`).join('')}
        </div>
        <div class="rail-foot">
          <span class="dday-pill" data-dday></span>
          <span class="save-state"><i></i><span data-save-state>${S.saveState()}</span></span>
        </div>
      </aside>
      <header class="topbar">
        <a class="brand" href="#home" aria-label="홈으로"><span class="brand-mark" lang="ja">福岡</span><strong>후쿠오카 노트</strong></a>
        <span class="grow"></span>
        <span class="clock mono" data-clock title="현지 시각 (JST)"></span>
        <span class="dday-pill" data-dday></span>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
      <nav class="tabbar" aria-label="주 메뉴">
        ${NAV.map((n) => `<a href="${n.hash}" class="tab-a" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
      </nav>`;
    updateChrome();
  }
  function updateChrome() {
    const dates = S.tripDates();
    document.querySelectorAll('[data-dday]').forEach((el) => (el.textContent = dday()));
    document.querySelectorAll('[data-trip-range]').forEach((el) => (el.textContent = `${App.mdDot(dates[0])} – ${App.mdDot(dates[dates.length - 1])}`));
    document.querySelectorAll('[data-railcount]').forEach((el) => (el.textContent = S.places(el.dataset.railcount).length || ''));
    document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = `현지 ${jstNow().hm}`));
  }

  /* ---------- 라우터 ---------- */
  let current = null, currentName = '', currentKey = '';
  function parse() {
    const h = location.hash.replace(/^#/, '');
    const [name, arg] = h.split('-');
    return VIEWS()[name] ? { name, arg } : { name: 'home', arg: undefined };
  }
  function sync() {
    if (App.UI.layers.length) return; // 시트가 열려 있으면 화면 전환을 미룸
    const r = parse();
    const key = `${r.name}-${r.arg || ''}`;
    if (key === currentKey) return;
    const view = document.getElementById('view');
    if (current && currentName === r.name && current.update) {
      currentKey = key;
      current.update(r.arg);
    } else {
      if (current && current.unmount) current.unmount();
      current = VIEWS()[r.name];
      currentName = r.name;
      currentKey = key;
      view.innerHTML = '';
      document.documentElement.dataset.route = r.name;
      current.mount(view, r.arg);
      window.scrollTo(0, 0);
    }
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === r.name;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-navcat]').forEach((a) => a.classList.toggle('on', r.name === 'list' && a.dataset.navcat === (r.arg || 'food')));
  }
  App.router = { sync, current: () => currentName };
  App.applyTheme = applyTheme;

  /* ---------- 시작 ---------- */
  function start() {
    if (!window.L) {
      document.getElementById('app').innerHTML = '<p class="boot-error">지도 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요.</p>';
      return;
    }
    S.load();
    if (history.state && history.state.layer) history.replaceState({ layer: 0 }, '');
    shell();
    applyTheme();
    window.addEventListener('hashchange', sync);
    sync();
    S.subscribe(() => {
      updateChrome();
      if (current && current.refresh) current.refresh();
      App.UI.refreshLayers();
    });
    window.addEventListener('resize', App.debounce(() => { if (current && current.resize) current.resize(); }, 200));
    App.Sync.init();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('service worker', e));
    }
    setInterval(() => {
      updateChrome();
      if (currentName === 'home' && !App.UI.layers.length && current.tick) current.tick();
    }, 60 * 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window.App);

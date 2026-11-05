/* ============================================================
   ANIMEVERSE — script.js (v11 — исправленный AniPub API + fallback)
   ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    ONE_PIECE_FALLBACK_EPISODES: 1180,
    FALLBACK_POSTER: window.__POSTER_PLACEHOLDER__,
    FETCH_TIMEOUT_MS: 12000,
    PLAYER_WATCHDOG_MS: 15000,
    TOAST_VISIBLE_MS: 5000,
    ACHIEVEMENT_TIME_TOLERANCE: 2,
    DEBUG_MAX_ENTRIES: 100,
    STORAGE_ACHIEVEMENTS: 'onepiece_achievements_unlocked_v1',
    STORAGE_WATCHED: 'onepiece_watched_episodes_v1',
    EPISODES_PER_TAB: 100,
    ONE_PIECE_ID: '21',
    // ✅ ИСПРАВЛЕНО: правильный поддомен api
    ANIPUB_API_BASE: 'https://api.anipub.xyz/v1/api/details/',
    // Резервный прямой iframe (если API не ответит)
    XXIKU_ORIGIN: 'https://player.xxiku.com'
  };

  /* ---------- DEBUG LOGGER ---------- */
  const DebugLog = (function () {
    const entries = [];
    let renderScheduled = false;
    let panelOpen = false;
    const panelEl = () => document.getElementById('debug-panel');
    const logEl = () => document.getElementById('debug-log');

    function scheduleRender() {
      if (renderScheduled || !panelOpen) return;
      renderScheduled = true;
      requestAnimationFrame(function () { renderScheduled = false; flush(); });
    }
    function flush() {
      const log = logEl(); if (!log) return;
      const fragment = document.createDocumentFragment();
      entries.forEach(function (e) {
        const row = document.createElement('div');
        row.className = 'debug-entry debug-entry--' + e.type;
        const time = document.createElement('span');
        time.className = 'debug-entry__time'; time.textContent = e.time;
        const msg = document.createElement('span');
        msg.className = 'debug-entry__msg'; msg.textContent = e.message;
        row.appendChild(time); row.appendChild(msg);
        fragment.appendChild(row);
      });
      log.replaceChildren(fragment);
      log.scrollTop = log.scrollHeight;
    }
    function push(type, message) {
      const d = new Date();
      const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
      entries.push({ type: type, message: String(message), time: time });
      if (entries.length > CONFIG.DEBUG_MAX_ENTRIES) entries.shift();
      if (type === 'error') console.error('[AnimeVerse]', message);
      else if (type === 'warn') console.warn('[AnimeVerse]', message);
      else console.log('[AnimeVerse]', message);
      scheduleRender();
    }
    function open() { const el = panelEl(); if (!el) return; panelOpen = true; el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); flush(); }
    function close() { const el = panelEl(); if (!el) return; panelOpen = false; el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true'); }
    function toggle() { if (panelOpen) close(); else open(); }
    function clear() { entries.length = 0; flush(); }
    return { info: m => push('info', m), warn: m => push('warn', m), error: m => push('error', m), heal: m => push('heal', m), open, close, toggle, clear };
  })();

  /* ---------- GLOBAL ERRORS ---------- */
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'IMG') {
      const img = event.target;
      if (img.src !== CONFIG.FALLBACK_POSTER) {
        DebugLog.warn('Постер не загрузился, ставлю заглушку');
        img.src = CONFIG.FALLBACK_POSTER;
      }
      return;
    }
    DebugLog.error('JS Error: ' + (event.message || 'unknown'));
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    DebugLog.error('Promise: ' + (event.reason && event.reason.message ? event.reason.message : event.reason));
  });

  /* ---------- UTILS ---------- */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeParseInt(v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function formatRange(s, e) { return s + '–' + e; }

  /* ---------- CATALOG ---------- */
  const CATALOG = [{
    id: 'one-piece',
    shikimoriId: CONFIG.ONE_PIECE_ID,
    title: 'Ван-Пис',
    titleOrig: 'One Piece',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/b21-6cR2gKz6nJ6F.jpg',
    rating: 8.72, year: 1999, status: 'Онгоинг',
    genres: ['Приключения', 'Сёнен', 'Фэнтези', 'Экшен'],
    description: 'Монки Д. Луффи отправляется в путешествие, чтобы найти легендарное сокровище Ван-Пис и стать Королём пиратов.',
    isHit: true,
    episodes: CONFIG.ONE_PIECE_FALLBACK_EPISODES
  }];

  /* ---------- HERO SLIDER ---------- */
  const HeroSlider = (function () {
    const slides = []; let current = 0, timer = null;
    function build() {
      const root = document.getElementById('hero-slider'), dots = document.getElementById('hero-dots');
      if (!root || !dots) return;
      Array.from(root.children).forEach(c => { if (c.id !== 'hero-dots') c.remove(); });
      dots.innerHTML = '';
      CATALOG.forEach((item, idx) => {
        const slide = document.createElement('div');
        slide.className = 'hero-slide' + (idx === 0 ? ' is-active' : '');
        slide.style.backgroundImage = 'url("' + item.poster + '")';
        slide.innerHTML =
          '<div class="hero-content">' +
            '<span class="hero-badge">🔥 В тренде</span>' +
            '<h1 class="hero-title">' + escapeHtml(item.title) + '</h1>' +
            '<div class="hero-meta">' +
              '<span class="hero-rating">★ ' + item.rating + '</span>' +
              '<span>' + item.year + '</span>' +
              '<span>' + escapeHtml(item.status) + '</span>' +
            '</div>' +
            '<p class="hero-desc">' + escapeHtml(item.description) + '</p>' +
            '<div class="hero-actions">' +
              '<button type="button" class="btn btn--primary" data-hero-watch="' + item.id + '">Смотреть</button>' +
              '<button type="button" class="btn btn--ghost" data-hero-more="' + item.id + '">Подробнее</button>' +
            '</div>' +
          '</div>';
        root.appendChild(slide); slides.push(slide);
        const dot = document.createElement('button');
        dot.type = 'button'; dot.className = 'hero-dot' + (idx === 0 ? ' is-active' : '');
        dot.addEventListener('click', () => goTo(idx));
        dots.appendChild(dot);
      });
      root.addEventListener('click', e => {
        const w = e.target.closest('[data-hero-watch]');
        const m = e.target.closest('[data-hero-more]');
        if (w) openDetail(w.dataset.heroWatch);
        else if (m) openDetail(m.dataset.heroMore);
      });
      startAuto();
    }
    function goTo(i) {
      if (!slides.length) return;
      slides[current].classList.remove('is-active');
      current = (i + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      document.querySelectorAll('.hero-dot').forEach((d, idx) => d.classList.toggle('is-active', idx === current));
    }
    function startAuto() { stopAuto(); timer = setInterval(() => goTo(current + 1), 6000); }
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
    return { build, goTo, stopAuto };
  })();

  /* ---------- ANIME GRID ---------- */
  function renderAnimeGrid() {
    const grid = document.getElementById('anime-grid');
    const badge = document.getElementById('anime-count-badge');
    if (!grid) return;
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    CATALOG.forEach((item, idx) => {
      const card = document.createElement('article');
      card.className = 'anime-card';
      card.dataset.animeId = item.id;
      card.style.setProperty('--i', idx);
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="card-poster">' +
          '<img src="' + escapeHtml(item.poster) + '" alt="Постер ' + escapeHtml(item.title) + '" loading="lazy" />' +
          (item.isHit ? '<span class="card-hit-badge">ХИТ</span>' : '') +
          '<span class="card-rating"><span>★</span> ' + item.rating + '</span>' +
          '<div class="card-overlay"></div>' +
          '<div class="card-play-btn" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + escapeHtml(item.title) + '</h3>' +
          '<div class="card-genres">' +
            item.genres.slice(0, 3).map(g => '<span class="card-genre">' + escapeHtml(g) + '</span>').join('') +
          '</div>' +
        '</div>';
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    if (badge) badge.textContent = CATALOG.length + ' тайтлов';
    grid.addEventListener('click', e => {
      const c = e.target.closest('.anime-card');
      if (c && c.dataset.animeId) openDetail(c.dataset.animeId);
    });
    grid.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const c = e.target.closest('.anime-card');
      if (c && c.dataset.animeId) { e.preventDefault(); openDetail(c.dataset.animeId); }
    });
  }

  /* ---------- ROUTER ---------- */
  const Router = (function () {
    let current = null;
    function showView(id) {
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === id));
      const header = document.getElementById('site-header');
      if (header) header.classList.toggle('is-scrolled', id === 'detail-view');
    }
    function openDetail(id) {
      const item = CATALOG.find(a => a.id === id);
      if (!item) { DebugLog.warn('Не найдено: ' + id); return; }
      current = item;
      DetailView.render(item);
      showView('detail-view');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      DebugLog.info('Открыта карточка: ' + item.title);
    }
    function goHome() {
      PlayerManager.destroy();
      showView('home-view');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return { showView, openDetail, goHome, getCurrent: () => current };
  })();
  function openDetail(id) { Router.openDetail(id); }

  /* ---------- DETAIL VIEW ---------- */
  const DetailView = (function () {
    let currentAnime = null, total = 0, tabIndex = 0, cache = new Map(), currentEp = null, watched = new Set();

    function loadWatched() {
      try {
        const r = localStorage.getItem(CONFIG.STORAGE_WATCHED);
        const a = r ? JSON.parse(r) : [];
        return new Set(Array.isArray(a) ? a.filter(n => typeof n === 'number') : []);
      } catch (e) { return new Set(); }
    }
    function saveWatched() {
      try { localStorage.setItem(CONFIG.STORAGE_WATCHED, JSON.stringify(Array.from(watched))); } catch (e) {}
    }

    function render(anime) {
      currentAnime = anime;
      total = anime.episodes || CONFIG.ONE_PIECE_FALLBACK_EPISODES;
      watched = loadWatched();
      currentEp = null; tabIndex = 0; cache = new Map();

      const poster = document.getElementById('detail-poster-img');
      if (poster) {
        poster.src = anime.poster;
        poster.alt = 'Постер ' + anime.title;
        poster.onerror = () => { poster.src = CONFIG.FALLBACK_POSTER; };
      }
      document.getElementById('detail-title').textContent = anime.title;
      document.getElementById('detail-meta').innerHTML =
        '<span class="detail-meta__item"><strong>★ ' + anime.rating + '</strong></span>' +
        '<span class="detail-meta__item"><strong>' + anime.year + '</strong> год</span>' +
        '<span class="detail-meta__item"><strong>' + escapeHtml(anime.status) + '</strong></span>' +
        '<span class="detail-meta__item"><strong>' + total + '</strong> серий</span>';
      document.getElementById('detail-genres').innerHTML = anime.genres.map(g => '<span class="detail-genre">' + escapeHtml(g) + '</span>').join('');
      document.getElementById('detail-description').textContent = anime.description;
      document.getElementById('episodes-count-badge').textContent = total + ' серий';

      renderTabs();
      renderTab(0);
      renderVoiceovers();
      selectEpisode(1, true);
      window.currentEpisode = currentEp;

      document.getElementById('detail-watch-btn').onclick = () => document.querySelector('.player-section').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('detail-list-btn').onclick = () => DebugLog.info('«В список» — заглушка.');
    }

    function tabCount() { return Math.ceil(total / CONFIG.EPISODES_PER_TAB); }
    function bounds(i) {
      const s = i * CONFIG.EPISODES_PER_TAB + 1;
      const e = Math.min((i + 1) * CONFIG.EPISODES_PER_TAB, total);
      return { s, e };
    }

    function renderTabs() {
      const el = document.getElementById('episode-tabs');
      if (!el) return;
      el.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < tabCount(); i++) {
        const b = bounds(i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'episode-tab' + (i === 0 ? ' is-active' : '');
        btn.dataset.tabIndex = i;
        btn.setAttribute('role', 'tab');
        btn.textContent = formatRange(b.s, b.e);
        btn.addEventListener('click', () => switchTab(i));
        frag.appendChild(btn);
      }
      el.appendChild(frag);
    }

    function switchTab(i) {
      if (i === tabIndex) return;
      tabIndex = i;
      document.querySelectorAll('.episode-tab').forEach(t => t.classList.toggle('is-active', safeParseInt(t.dataset.tabIndex) === i));
      renderTab(i);
    }

    function renderTab(i) {
      const grid = document.getElementById('episode-grid');
      if (!grid) return;
      if (cache.has(i)) {
        grid.replaceChildren(cache.get(i).cloneNode(true));
        attach(grid); highlight(grid);
        return;
      }
      const b = bounds(i);
      const frag = document.createDocumentFragment();
      for (let ep = b.s; ep <= b.e; ep++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'episode-btn';
        btn.dataset.episode = ep;
        btn.textContent = ep;
        if (watched.has(ep)) btn.classList.add('is-watched');
        frag.appendChild(btn);
      }
      cache.set(i, frag.cloneNode(true));
      grid.replaceChildren(frag);
      attach(grid); highlight(grid);
    }

    function attach(grid) {
      grid.onclick = e => {
        const b = e.target.closest('.episode-btn');
        if (b) selectEpisode(safeParseInt(b.dataset.episode));
      };
    }

    function highlight(grid) {
      if (currentEp === null) return;
      grid.querySelectorAll('.episode-btn').forEach(b => b.classList.toggle('is-active', safeParseInt(b.dataset.episode) === currentEp));
    }

    function selectEpisode(ep, silent) {
      currentEp = ep;
      window.currentEpisode = ep;
      document.querySelectorAll('.episode-btn').forEach(b => {
        const n = safeParseInt(b.dataset.episode);
        b.classList.toggle('is-active', n === ep);
        if (n === ep) b.classList.add('is-watched');
      });
      if (!watched.has(ep)) { watched.add(ep); saveWatched(); }
      PlayerManager.loadEpisode(currentAnime, ep);
      if (!silent) DebugLog.info('Выбрана серия ' + ep);
    }

    function renderVoiceovers() {
      const el = document.getElementById('voiceover-tabs');
      if (!el) return;
      const list = [
        { id: 'anilibria', name: 'AniLibria' },
        { id: 'animemedia', name: 'AnimeMedia' },
        { id: 'anidub', name: 'AniDUB' },
        { id: 'jam', name: 'JAM Club' }
      ];
      el.innerHTML = '';
      list.forEach((v, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'voiceover-tab' + (i === 0 ? ' is-active' : '');
        b.textContent = v.name;
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => {
          el.querySelectorAll('.voiceover-tab').forEach(t => t.classList.toggle('is-active', t === b));
          PlayerManager.setVoiceover(v.id);
        });
        el.appendChild(b);
      });
    }

    return { render, selectEpisode };
  })();

  /* ============================================================
     PLAYER MANAGER — AniPub API (правильный домен) + fallback
     ============================================================ */
  const PlayerManager = (function () {
    let watchdog = null;
    let recovering = false;
    let anime = null, ep = null;
    let queue = [], idx = 0;
    let iframe = null;

    function wrapper() { return document.getElementById('player-wrapper'); }
    function errText() { return document.getElementById('player-error-text'); }

    function buildQueue(a, episode) {
      const malId = a.shikimoriId || '21';
      return [
        {
          name: 'AniPub API',
          type: 'api',
          apiUrl: CONFIG.ANIPUB_API_BASE + malId
        },
        {
          name: 'xxiku fallback',
          type: 'iframe',
          url: CONFIG.XXIKU_ORIGIN + '/embed/anime/mal/' + malId + '/' + episode + '?auto=1'
        }
      ];
    }

    async function loadEpisode(a, episode) {
      anime = a; ep = episode;
      const w = wrapper();
      if (w) {
        w.classList.remove('has-error', 'is-loaded');
        w.classList.add('is-loading');
      }
      queue = buildQueue(a, episode);
      idx = 0;
      recovering = false;
      await attempt(0);
    }

    async function attempt(i) {
      if (i >= queue.length) {
        showError('Все источники недоступны.');
        DebugLog.error('Failover exhausted');
        return;
      }
      idx = i;
      const src = queue[i];

      if (src.type === 'api') {
        try {
          DebugLog.info('Запрос к AniPub API: ' + src.apiUrl);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
          const res = await fetch(src.apiUrl, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          // Логируем ответ, чтобы видеть структуру (для отладки)
          DebugLog.info('Ответ AniPub API: ' + JSON.stringify(data).substring(0, 200));

          const iframeLink = data.iframe || data.streaming_link || data.player_url || data.link;
          if (!iframeLink) throw new Error('В ответе API нет iframe-ссылки');

          DebugLog.heal('✅ AniPub API вернул ссылку');
          injectIframe(iframeLink);
        } catch (e) {
          DebugLog.warn('AniPub API ошибка: ' + e.message + ' → fallback');
          await attempt(i + 1);
        }
      } else {
        DebugLog.info('Прямой iframe fallback: ' + src.url);
        injectIframe(src.url);
      }
    }

    function injectIframe(url) {
      const w = wrapper();
      if (!w) return;
      w.classList.remove('has-error');
      w.classList.add('is-loading');
      w.classList.remove('is-loaded');

      if (iframe) { iframe.remove(); iframe = null; }

      iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.title = 'Видеоплеер';

      iframe.addEventListener('load', () => {
        clearTimeout(watchdog);
        w.classList.remove('is-loading');
        w.classList.add('is-loaded');
        recovering = false;
        DebugLog.heal('Плеер загружен (iframe load)');
      });
      iframe.addEventListener('error', () => {
        clearTimeout(watchdog);
        DebugLog.warn('iframe error');
        onFail();
      });

      w.insertBefore(iframe, w.firstChild);

      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        DebugLog.warn('Таймаут ' + CONFIG.PLAYER_WATCHDOG_MS + 'мс');
        onFail();
      }, CONFIG.PLAYER_WATCHDOG_MS);
    }

    function onFail() {
      if (recovering) return;
      recovering = true;
      clearTimeout(watchdog);
      const w = wrapper();
      if (w) {
        w.classList.remove('is-loading');
        w.classList.add('has-error');
      }
      if (idx + 1 < queue.length) {
        DebugLog.heal('Переключение на резервный источник');
        setTimeout(() => { recovering = false; attempt(idx + 1); }, 500);
      } else {
        showError('Не удалось загрузить видео.');
        DebugLog.error('Все источники исчерпаны');
        recovering = false;
      }
    }

    function showError(msg) {
      const w = wrapper();
      const t = errText();
      if (w) {
        w.classList.remove('is-loading', 'is-loaded');
        w.classList.add('has-error');
      }
      if (t) t.textContent = msg;
    }

    function retry() {
      if (anime && ep) {
        DebugLog.info('Ручной retry');
        recovering = false;
        loadEpisode(anime, ep);
      }
    }

    function setVoiceover(id) {
      DebugLog.info('Смена озвучки: ' + id);
      if (anime && ep) loadEpisode(anime, ep);
    }

    function destroy() {
      clearTimeout(watchdog);
      if (iframe) { iframe.remove(); iframe = null; }
      const w = wrapper();
      if (w) w.classList.remove('is-loading', 'is-loaded', 'has-error');
      recovering = false;
    }

    document.addEventListener('click', e => {
      if (e.target && e.target.id === 'player-retry-btn') retry();
    });

    return { loadEpisode, retry, setVoiceover, destroy };
  })();

  /* ---------- ACHIEVEMENTS SYSTEM ---------- */
  const AchievementsSystem = (function () {
    const db = [
      { id: 'rubber_pirate', title: 'Резиновый пират', desc: 'Луффи съедает фрукт Гому Гому.', ep: 1, time: 840, icon: '🏴‍☠️' },
      { id: 'nothing_happened', title: 'Ничего... не произошло!', desc: 'Легендарный момент с Зоро.', ep: 377, time: 1080, icon: '⚔️' },
      { id: 'era_is_gone', title: 'Эра ушла...', desc: 'Трагический момент с Эйсом.', ep: 483, time: 900, icon: '🔥' }
    ];
    let unlocked = new Set();
    let toastTimer = null;
    let lastTime = -1, lastEp = null;

    function load() {
      try {
        const r = localStorage.getItem(CONFIG.STORAGE_ACHIEVEMENTS);
        const a = r ? JSON.parse(r) : [];
        const valid = new Set(db.map(x => x.id));
        return new Set(Array.isArray(a) ? a.filter(id => valid.has(id)) : []);
      } catch (e) { return new Set(); }
    }
    function save() {
      try { localStorage.setItem(CONFIG.STORAGE_ACHIEVEMENTS, JSON.stringify(Array.from(unlocked))); } catch (e) {}
    }

    function render() {
      const grid = document.getElementById('achievements-grid');
      const counter = document.getElementById('achievements-counter');
      if (!grid) return;
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      db.forEach(a => {
        const un = unlocked.has(a.id);
        const card = document.createElement('div');
        card.className = 'achievement-card' + (un ? ' is-unlocked' : '');
        card.dataset.achievementId = a.id;
        card.innerHTML =
          '<div class="achievement-card__icon">' + escapeHtml(a.icon) + '</div>' +
          '<div class="achievement-card__info">' +
            '<div class="achievement-card__title">' + escapeHtml(a.title) + '</div>' +
            '<div class="achievement-card__desc">' + escapeHtml(a.desc) + '</div>' +
          '</div>' +
          '<div class="achievement-card__lock" aria-hidden="true">🔒</div>';
        frag.appendChild(card);
      });
      grid.appendChild(frag);
      if (counter) counter.textContent = unlocked.size + ' / ' + db.length;
    }

    function toast(a) {
      const el = document.getElementById('achievement-toast');
      if (!el) return;
      el.innerHTML =
        '<div class="achievement-toast__icon">' + escapeHtml(a.icon) + '</div>' +
        '<div class="achievement-toast__body">' +
          '<div class="achievement-toast__label">Достижение разблокировано</div>' +
          '<div class="achievement-toast__title">' + escapeHtml(a.title) + '</div>' +
          '<div class="achievement-toast__desc">' + escapeHtml(a.desc) + '</div>' +
        '</div>';
      clearTimeout(toastTimer);
      el.classList.remove('is-visible');
      void el.offsetWidth;
      el.classList.add('is-visible');
      toastTimer = setTimeout(() => el.classList.remove('is-visible'), CONFIG.TOAST_VISIBLE_MS);
    }

    function unlock(id) {
      if (unlocked.has(id)) return false;
      const a = db.find(x => x.id === id);
      if (!a) return false;
      unlocked.add(id);
      save();
      const c = document.querySelector('.achievement-card[data-achievement-id="' + id + '"]');
      if (c) c.classList.add('is-unlocked');
      const counter = document.getElementById('achievements-counter');
      if (counter) counter.textContent = unlocked.size + ' / ' + db.length;
      toast(a);
      DebugLog.heal('🏆 Достижение: ' + a.title);
      return true;
    }

    function check(e, t) {
      if (typeof e !== 'number' || typeof t !== 'number' || t < 0) return;
      db.forEach(a => {
        if (a.ep !== e || unlocked.has(a.id)) return;
        if (Math.abs(t - a.time) <= CONFIG.ACHIEVEMENT_TIME_TOLERANCE) { unlock(a.id); return; }
        const jump = lastEp === e && lastTime >= 0 && t - lastTime > 5;
        if (jump && a.time > lastTime && a.time <= t) unlock(a.id);
      });
      lastTime = t; lastEp = e;
    }

    function handleMsg(ev) {
      const d = ev.data;
      if (!d || typeof d !== 'object') return;
      let t = null;
      if (typeof d.time === 'number') t = d.time;
      else if (typeof d.value === 'number') t = d.value;
      else if (typeof d.currentTime === 'number') t = d.currentTime;
      if (t === null) return;
      let e = null;
      if (typeof d.episode === 'number') e = d.episode;
      else if (typeof d.series === 'number') e = d.series;
      if (e === null) {
        if (window.currentEpisode > 0) e = window.currentEpisode;
        else {
          const btn = document.querySelector('.episode-btn.is-active');
          if (btn) e = safeParseInt(btn.dataset.episode);
        }
      }
      if (e !== null) check(e, t);
    }

    function init() {
      unlocked = load();
      render();
      window.addEventListener('message', handleMsg);
      DebugLog.info('Achievements ready: ' + unlocked.size + '/' + db.length);
    }

    return {
      init, unlock,
      getUnlocked: () => Array.from(unlocked),
      reset: () => { unlocked.clear(); save(); lastTime = -1; lastEp = null; render(); DebugLog.info('Achievements reset'); },
      test: (e, t) => check(e, t)
    };
  })();

  /* ---------- INIT ---------- */
  function init() {
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    HeroSlider.build();
    renderAnimeGrid();

    document.getElementById('detail-back').addEventListener('click', () => Router.goHome());
    document.getElementById('debug-toggle').addEventListener('click', DebugLog.toggle);
    document.getElementById('footer-debug-btn').addEventListener('click', DebugLog.open);
    document.getElementById('debug-close').addEventListener('click', DebugLog.close);
    document.getElementById('debug-clear').addEventListener('click', DebugLog.clear);

    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        DebugLog.toggle();
      }
      if (e.key === 'Escape') DebugLog.close();
    });

    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 50);
    }, { passive: true });

    AchievementsSystem.init();

    window.AnimeVerse = {
      Debug: DebugLog,
      Achievements: AchievementsSystem,
      Router,
      Player: PlayerManager
    };

    DebugLog.info('✅ AnimeVerse запущен (AniPub API + fallback)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
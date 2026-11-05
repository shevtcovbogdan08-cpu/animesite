/* ============================================================
   ANIMEVERSE — script.js (v2 — Sibnet fix)
   ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    ONE_PIECE_FALLBACK_EPISODES: 1180,
    FALLBACK_POSTER: window.__POSTER_PLACEHOLDER__,
    FETCH_TIMEOUT_MS: 7000,
    PLAYER_WATCHDOG_MS: 5000,
    TOAST_VISIBLE_MS: 5000,
    ACHIEVEMENT_TIME_TOLERANCE: 2,
    DEBUG_MAX_ENTRIES: 100,
    STORAGE_ACHIEVEMENTS: 'onepiece_achievements_unlocked_v1',
    STORAGE_WATCHED: 'onepiece_watched_episodes_v1',
    EPISODES_PER_TAB: 100,
    SIBNET_VIDEO_ID: 2038198 // реальный ID первой серии Ван-Писа на Sibnet
  };

  /* ---------- DEBUG ---------- */
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
      const log = logEl();
      if (!log) return;
      const fragment = document.createDocumentFragment();
      entries.forEach(function (e) {
        const row = document.createElement('div');
        row.className = 'debug-entry debug-entry--' + e.type;
        const time = document.createElement('span');
        time.className = 'debug-entry__time';
        time.textContent = e.time;
        const msg = document.createElement('span');
        msg.className = 'debug-entry__msg';
        msg.textContent = e.message;
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
    if (event.target && event.target !== window) {
      const tag = event.target.tagName;
      if (tag === 'IMG') {
        const img = event.target;
        if (img.src !== CONFIG.FALLBACK_POSTER) {
          DebugLog.warn('Постер не загрузился: ' + (img.alt || img.src));
          img.src = CONFIG.FALLBACK_POSTER;
        }
        return;
      }
    }
    DebugLog.error('JS Error: ' + (event.message || 'unknown'));
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    DebugLog.error('Unhandled Promise: ' + (event.reason && event.reason.message ? event.reason.message : event.reason));
  });

  /* ---------- UTILS ---------- */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeParseInt(value) { const n = parseInt(value, 10); return isNaN(n) ? null : n; }
  function formatRange(start, end) { return start + '–' + end; }

  /* ---------- CATALOG ---------- */
  const CATALOG = [
    {
      id: 'one-piece',
      shikimoriId: '21',
      title: 'Ван-Пис',
      titleOrig: 'One Piece',
      poster: 'https://cdn.myanimelist.net/images/anime/6/73245l.jpg',
      rating: 8.72,
      year: 1999,
      status: 'Онгоинг',
      genres: ['Приключения', 'Сёнен', 'Фэнтези', 'Экшен'],
      description: 'Монки Д. Луффи отправляется в путешествие, чтобы найти легендарное сокровище Ван-Пис и стать Королём пиратов.',
      isHit: true,
      episodes: CONFIG.ONE_PIECE_FALLBACK_EPISODES
    }
  ];

  /* ---------- HERO ---------- */
  const HeroSlider = (function () {
    const slides = [];
    let current = 0;
    let timer = null;
    function build() {
      const root = document.getElementById('hero-slider');
      const dots = document.getElementById('hero-dots');
      if (!root || !dots) return;
      Array.from(root.children).forEach(c => { if (c.id !== 'hero-dots') c.remove(); });
      dots.innerHTML = '';
      CATALOG.slice(0, 3).forEach(function (item, idx) {
        const slide = document.createElement('div');
        slide.className = 'hero-slide' + (idx === 0 ? ' is-active' : '');
        slide.style.backgroundImage = 'url("' + item.poster + '")';
        slide.innerHTML =
          '<div class="hero-content">' +
            '<span class="hero-badge">🔥 В тренде</span>' +
            '<h1 class="hero-title">' + escapeHtml(item.title) + '</h1>' +
            '<div class="hero-meta"><span class="hero-rating">★ ' + item.rating + '</span><span>' + item.year + '</span><span>' + escapeHtml(item.status) + '</span></div>' +
            '<p class="hero-desc">' + escapeHtml(item.description) + '</p>' +
            '<div class="hero-actions"><button type="button" class="btn btn--primary" data-hero-watch="' + item.id + '">Смотреть</button><button type="button" class="btn btn--ghost" data-hero-more="' + item.id + '">Подробнее</button></div>' +
          '</div>';
        root.appendChild(slide); slides.push(slide);
        const dot = document.createElement('button');
        dot.type = 'button'; dot.className = 'hero-dot' + (idx === 0 ? ' is-active' : '');
        dot.addEventListener('click', function () { goTo(idx); });
        dots.appendChild(dot);
      });
      root.addEventListener('click', function (e) {
        const watchBtn = e.target.closest('[data-hero-watch]');
        const moreBtn = e.target.closest('[data-hero-more]');
        if (watchBtn) openDetail(watchBtn.dataset.heroWatch);
        else if (moreBtn) openDetail(moreBtn.dataset.heroMore);
      });
      startAuto();
    }
    function goTo(index) {
      if (!slides.length) return;
      slides[current].classList.remove('is-active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('is-active', i === current));
    }
    function startAuto() { stopAuto(); timer = setInterval(() => goTo(current + 1), 6000); }
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
    return { build, goTo, stopAuto };
  })();

  function renderAnimeGrid() {
    const grid = document.getElementById('anime-grid');
    const badge = document.getElementById('anime-count-badge');
    if (!grid) return;
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    CATALOG.forEach(function (item, idx) {
      const card = document.createElement('article');
      card.className = 'anime-card';
      card.dataset.animeId = item.id;
      card.style.setProperty('--i', idx);
      card.setAttribute('role', 'listitem'); card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="card-poster">' +
          '<img src="' + escapeHtml(item.poster) + '" alt="Постер ' + escapeHtml(item.title) + '" loading="lazy" />' +
          (item.isHit ? '<span class="card-hit-badge">ХИТ</span>' : '') +
          '<span class="card-rating"><span>★</span> ' + item.rating + '</span>' +
          '<div class="card-overlay"></div>' +
          '<div class="card-play-btn" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' +
        '</div>' +
        '<div class="card-body"><h3 class="card-title">' + escapeHtml(item.title) + '</h3><div class="card-genres">' + item.genres.slice(0,3).map(g => '<span class="card-genre">' + escapeHtml(g) + '</span>').join('') + '</div></div>';
      fragment.appendChild(card);
    });
    grid.appendChild(fragment);
    if (badge) badge.textContent = CATALOG.length + ' тайтлов';
    grid.addEventListener('click', function (e) {
      const card = e.target.closest('.anime-card');
      if (card && card.dataset.animeId) openDetail(card.dataset.animeId);
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.anime-card');
      if (card && card.dataset.animeId) { e.preventDefault(); openDetail(card.dataset.animeId); }
    });
  }

  /* ---------- ROUTER ---------- */
  const Router = (function () {
    let currentAnime = null;
    function showView(viewId) {
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === viewId));
      const header = document.getElementById('site-header');
      if (header) header.classList.toggle('is-scrolled', viewId === 'detail-view');
    }
    function openDetail(animeId) {
      const item = CATALOG.find(a => a.id === animeId);
      if (!item) { DebugLog.warn('Не найдено: ' + animeId); return; }
      currentAnime = item;
      DetailView.render(item);
      showView('detail-view');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      DebugLog.info('Открыта карточка: ' + item.title);
    }
    function goHome() { PlayerManager.destroy(); showView('home-view'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    return { showView, openDetail, goHome, getCurrent: () => currentAnime };
  })();
  function openDetail(id) { Router.openDetail(id); }

  /* ---------- DETAIL VIEW ---------- */
  const DetailView = (function () {
    let currentAnime = null;
    let totalEpisodes = 0;
    let currentTabIndex = 0;
    let fragmentCache = new Map();
    let currentEpisode = null;
    let watchedEpisodes = new Set();

    function loadWatched() {
      try { const raw = localStorage.getItem(CONFIG.STORAGE_WATCHED); if (!raw) return new Set(); const arr = JSON.parse(raw); if (!Array.isArray(arr)) return new Set(); return new Set(arr.filter(n => typeof n === 'number')); }
      catch (e) { DebugLog.warn('watched load: ' + e.message); return new Set(); }
    }
    function saveWatched() { try { localStorage.setItem(CONFIG.STORAGE_WATCHED, JSON.stringify(Array.from(watchedEpisodes))); } catch (e) { DebugLog.warn('watched save: ' + e.message); } }

    function render(anime) {
      currentAnime = anime;
      totalEpisodes = anime.episodes || CONFIG.ONE_PIECE_FALLBACK_EPISODES;
      watchedEpisodes = loadWatched();
      currentEpisode = null; currentTabIndex = 0; fragmentCache = new Map();

      const posterImg = document.getElementById('detail-poster-img');
      if (posterImg) { posterImg.src = anime.poster || CONFIG.FALLBACK_POSTER; posterImg.alt = 'Постер ' + anime.title; posterImg.onerror = () => { posterImg.src = CONFIG.FALLBACK_POSTER; }; }

      const titleEl = document.getElementById('detail-title');
      if (titleEl) titleEl.textContent = anime.title;

      const metaEl = document.getElementById('detail-meta');
      if (metaEl) metaEl.innerHTML =
        '<span class="detail-meta__item"><strong>★ ' + anime.rating + '</strong></span>' +
        '<span class="detail-meta__item"><strong>' + anime.year + '</strong> год</span>' +
        '<span class="detail-meta__item"><strong>' + escapeHtml(anime.status) + '</strong></span>' +
        '<span class="detail-meta__item"><strong>' + totalEpisodes + '</strong> серий</span>';

      const genresEl = document.getElementById('detail-genres');
      if (genresEl) genresEl.innerHTML = anime.genres.map(g => '<span class="detail-genre">' + escapeHtml(g) + '</span>').join('');

      const descEl = document.getElementById('detail-description');
      if (descEl) descEl.textContent = anime.description;

      const badge = document.getElementById('episodes-count-badge');
      if (badge) badge.textContent = totalEpisodes + ' серий';

      renderEpisodeTabs(); renderTab(0); renderVoiceovers(anime); selectEpisode(1, true);
      window.currentEpisode = currentEpisode;

      const watchBtn = document.getElementById('detail-watch-btn');
      if (watchBtn) watchBtn.onclick = () => document.querySelector('.player-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      const listBtn = document.getElementById('detail-list-btn');
      if (listBtn) listBtn.onclick = () => DebugLog.info('«В список» — заглушка.');
    }

    function getTabCount() { return Math.ceil(totalEpisodes / CONFIG.EPISODES_PER_TAB); }
    function getTabBounds(index) {
      const start = index * CONFIG.EPISODES_PER_TAB + 1;
      const end = Math.min((index + 1) * CONFIG.EPISODES_PER_TAB, totalEpisodes);
      return { start, end };
    }

    function renderEpisodeTabs() {
      const tabsEl = document.getElementById('episode-tabs');
      if (!tabsEl) return;
      tabsEl.innerHTML = '';
      const tabCount = getTabCount();
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < tabCount; i++) {
        const bounds = getTabBounds(i);
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'episode-tab' + (i === 0 ? ' is-active' : '');
        btn.dataset.tabIndex = i; btn.setAttribute('role', 'tab');
        btn.textContent = formatRange(bounds.start, bounds.end);
        btn.addEventListener('click', () => switchTab(i));
        fragment.appendChild(btn);
      }
      tabsEl.appendChild(fragment);
    }

    function switchTab(index) {
      if (index === currentTabIndex) return;
      currentTabIndex = index;
      document.querySelectorAll('.episode-tab').forEach(t => t.classList.toggle('is-active', safeParseInt(t.dataset.tabIndex) === index));
      renderTab(index);
    }

    function renderTab(index) {
      const grid = document.getElementById('episode-grid');
      if (!grid) return;
      if (fragmentCache.has(index)) {
        grid.replaceChildren(fragmentCache.get(index).cloneNode(true));
        attachEpisodeListeners(grid); highlightCurrentEpisode(grid); return;
      }
      const bounds = getTabBounds(index);
      const fragment = document.createDocumentFragment();
      for (let ep = bounds.start; ep <= bounds.end; ep++) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'episode-btn';
        btn.dataset.episode = ep; btn.textContent = ep;
        if (watchedEpisodes.has(ep)) btn.classList.add('is-watched');
        fragment.appendChild(btn);
      }
      fragmentCache.set(index, fragment.cloneNode(true));
      grid.replaceChildren(fragment);
      attachEpisodeListeners(grid); highlightCurrentEpisode(grid);
    }

    function attachEpisodeListeners(grid) {
      grid.onclick = function (e) {
        const btn = e.target.closest('.episode-btn');
        if (!btn) return;
        const ep = safeParseInt(btn.dataset.episode);
        if (ep !== null) { spawnRipple(btn, e); selectEpisode(ep); }
      };
    }

    function spawnRipple(btn, event) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    }

    function highlightCurrentEpisode(grid) {
      if (currentEpisode === null) return;
      grid.querySelectorAll('.episode-btn').forEach(b => b.classList.toggle('is-active', safeParseInt(b.dataset.episode) === currentEpisode));
    }

    function selectEpisode(ep, silent) {
      currentEpisode = ep; window.currentEpisode = ep;
      document.querySelectorAll('.episode-btn').forEach(b => {
        const n = safeParseInt(b.dataset.episode);
        b.classList.toggle('is-active', n === ep);
        if (n === ep) b.classList.add('is-watched');
      });
      if (!watchedEpisodes.has(ep)) { watchedEpisodes.add(ep); saveWatched(); }
      PlayerManager.loadEpisode(currentAnime, ep);
      if (!silent) DebugLog.info('Выбрана серия ' + ep);
    }

    function renderVoiceovers(anime) {
      const tabs = document.getElementById('voiceover-tabs');
      if (!tabs) return;
      const voiceovers = [
        { id: 'anilibria', name: 'AniLibria' },
        { id: 'animemedia', name: 'AnimeMedia' },
        { id: 'anidub', name: 'AniDUB' },
        { id: 'jam', name: 'JAM Club' }
      ];
      tabs.innerHTML = '';
      voiceovers.forEach((v, i) => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'voiceover-tab' + (i === 0 ? ' is-active' : '');
        btn.dataset.voiceoverId = v.id; btn.textContent = v.name;
        btn.setAttribute('role', 'tab');
        btn.addEventListener('click', () => {
          tabs.querySelectorAll('.voiceover-tab').forEach(t => t.classList.toggle('is-active', t === btn));
          PlayerManager.setVoiceover(v.id);
        });
        tabs.appendChild(btn);
      });
    }

    return { render, getCurrentEpisode: () => currentEpisode, getAnime: () => currentAnime, selectEpisode };
  })();

  /* ---------- PLAYER MANAGER ---------- */
  const PlayerManager = (function () {
    let watchdogTimer = null;
    let isRecovering = false;
    let currentAnime = null;
    let currentEpisode = null;
    let currentSourceIndex = 0;
    let sourceQueue = [];
    let currentVoiceover = 'anilibria';
    let currentIframe = null;

    function getWrapper() { return document.getElementById('player-wrapper'); }
    function getErrorText() { return document.getElementById('player-error-text'); }

    function buildSourceQueue(anime, episode) {
      const queue = [];

      // 1. Sibnet — рабочий источник (ID первой серии Ван-Писа)
      queue.push({
        name: 'Sibnet',
        url: 'https://video.sibnet.ru/shell.php?videoid=' + CONFIG.SIBNET_VIDEO_ID + '&width=100%&height=100%'
      });

      // 2. Aniboom — fallback
      queue.push({
        name: 'Aniboom',
        url: 'https://aniboom.one/embed/' + (anime.shikimoriId || '21') + '?episode=' + episode
      });

      return queue;
    }

    function loadEpisode(anime, episode) {
      currentAnime = anime; currentEpisode = episode;
      currentVoiceover = currentVoiceover || 'anilibria';
      sourceQueue = buildSourceQueue(anime, episode);
      currentSourceIndex = 0;
      isRecovering = false;
      attemptSource(0);
    }

    function attemptSource(index) {
      if (index >= sourceQueue.length) {
        showError('Все источники плеера недоступны.');
        DebugLog.error('All player sources failed for episode ' + currentEpisode);
        return;
      }
      currentSourceIndex = index;
      const source = sourceQueue[index];
      DebugLog.info('Загрузка: ' + source.name + ' (' + (index + 1) + '/' + sourceQueue.length + ')');
      injectIframe(source.url);
    }

    function injectIframe(url) {
      const wrapper = getWrapper();
      if (!wrapper) return;
      wrapper.classList.remove('has-error'); wrapper.classList.add('is-loading'); wrapper.classList.remove('is-loaded');
      if (currentIframe) { currentIframe.remove(); currentIframe = null; }

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.setAttribute('loading', 'eager');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.title = 'Видеоплеер';
      currentIframe = iframe;

      iframe.addEventListener('load', function () {
        clearTimeout(watchdogTimer);
        wrapper.classList.remove('is-loading'); wrapper.classList.add('is-loaded');
        isRecovering = false;
        DebugLog.heal('Плеер загружен: ' + sourceQueue[currentSourceIndex].name);
      });
      iframe.addEventListener('error', function () {
        clearTimeout(watchdogTimer);
        DebugLog.warn('iframe error: ' + sourceQueue[currentSourceIndex].name);
        onSourceFailure();
      });

      wrapper.insertBefore(iframe, wrapper.firstChild);

      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(function () {
        DebugLog.warn('Таймаут 5с: ' + sourceQueue[currentSourceIndex].name);
        onSourceFailure();
      }, CONFIG.PLAYER_WATCHDOG_MS);

      window.addEventListener('message', onPlayerMessage);
    }

    function onPlayerMessage(event) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'error' || data.event === 'error') { DebugLog.warn('postMessage error'); onSourceFailure(); return; }
      if (data.type === 'ready' || data.event === 'ready') {
        clearTimeout(watchdogTimer);
        const wrapper = getWrapper();
        if (wrapper) { wrapper.classList.remove('is-loading'); wrapper.classList.add('is-loaded'); }
        DebugLog.heal('Плеер готов (postMessage)');
      }
    }

    function onSourceFailure() {
      if (isRecovering) return;
      isRecovering = true;
      clearTimeout(watchdogTimer);
      const wrapper = getWrapper();
      if (wrapper) { wrapper.classList.remove('is-loading'); wrapper.classList.add('has-error'); }
      const nextIndex = currentSourceIndex + 1;
      if (nextIndex < sourceQueue.length) {
        DebugLog.heal('Переключение на: ' + sourceQueue[nextIndex].name);
        setTimeout(function () { isRecovering = false; attemptSource(nextIndex); }, 600);
      } else {
        showError('Не удалось загрузить плеер ни из одного источника.');
        DebugLog.error('Failover exhausted');
        isRecovering = false;
      }
    }

    function showError(message) {
      const wrapper = getWrapper(); const text = getErrorText();
      if (wrapper) { wrapper.classList.remove('is-loading', 'is-loaded'); wrapper.classList.add('has-error'); }
      if (text) text.textContent = message;
    }

    function retry() {
      if (currentAnime && currentEpisode) {
        DebugLog.info('Ручной retry');
        isRecovering = false;
        sourceQueue = buildSourceQueue(currentAnime, currentEpisode);
        currentSourceIndex = 0;
        attemptSource(0);
      }
    }

    function setVoiceover(id) {
      currentVoiceover = id;
      DebugLog.info('Смена озвучки: ' + id);
      if (currentAnime && currentEpisode) loadEpisode(currentAnime, currentEpisode);
    }

    function destroy() {
      clearTimeout(watchdogTimer);
      if (currentIframe) { currentIframe.remove(); currentIframe = null; }
      const wrapper = getWrapper();
      if (wrapper) wrapper.classList.remove('is-loading', 'is-loaded', 'has-error');
      isRecovering = false;
    }

    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'player-retry-btn') retry();
    });

    return { loadEpisode, retry, setVoiceover, destroy };
  })();

  /* ---------- ACHIEVEMENTS ---------- */
  const AchievementsSystem = (function () {
    const achievementsDB = [
      { id: 'rubber_pirate', title: 'Резиновый пират', description: 'Луффи съедает фрукт Гому Гому.', episode: 1, time: 840, icon: '🏴‍☠️' },
      { id: 'nothing_happened', title: 'Ничего... не произошло!', description: 'Легендарный момент с Зоро.', episode: 377, time: 1080, icon: '⚔️' },
      { id: 'era_is_gone', title: 'Эра ушла...', description: 'Трагический момент с Эйсом.', episode: 483, time: 900, icon: '🔥' }
    ];
    let unlocked = new Set();
    let toastTimer = null;
    let lastTime = -1;
    let lastEpisode = null;

    function load() {
      try { const raw = localStorage.getItem(CONFIG.STORAGE_ACHIEVEMENTS); if (!raw) return new Set(); const arr = JSON.parse(raw); if (!Array.isArray(arr)) return new Set(); const valid = new Set(achievementsDB.map(a => a.id)); return new Set(arr.filter(id => valid.has(id))); }
      catch (e) { DebugLog.warn('Achievements load: ' + e.message); return new Set(); }
    }
    function save() { try { localStorage.setItem(CONFIG.STORAGE_ACHIEVEMENTS, JSON.stringify(Array.from(unlocked))); } catch (e) { DebugLog.warn('Achievements save: ' + e.message); } }

    function renderCollection() {
      const grid = document.getElementById('achievements-grid');
      const counter = document.getElementById('achievements-counter');
      if (!grid) return;
      grid.innerHTML = '';
      const fragment = document.createDocumentFragment();
      achievementsDB.forEach(function (ach) {
        const isUnlocked = unlocked.has(ach.id);
        const card = document.createElement('div');
        card.className = 'achievement-card' + (isUnlocked ? ' is-unlocked' : '');
        card.dataset.achievementId = ach.id;
        card.innerHTML =
          '<div class="achievement-card__icon">' + escapeHtml(ach.icon) + '</div>' +
          '<div class="achievement-card__info"><div class="achievement-card__title">' + escapeHtml(ach.title) + '</div><div class="achievement-card__desc">' + escapeHtml(ach.description) + '</div></div>' +
          '<div class="achievement-card__lock" aria-hidden="true">🔒</div>';
        fragment.appendChild(card);
      });
      grid.appendChild(fragment);
      if (counter) counter.textContent = unlocked.size + ' / ' + achievementsDB.length;
    }

    function showToast(ach) {
      const toast = document.getElementById('achievement-toast');
      if (!toast) return;
      toast.innerHTML =
        '<div class="achievement-toast__icon">' + escapeHtml(ach.icon) + '</div>' +
        '<div class="achievement-toast__body"><div class="achievement-toast__label">Достижение разблокировано</div><div class="achievement-toast__title">' + escapeHtml(ach.title) + '</div><div class="achievement-toast__desc">' + escapeHtml(ach.description) + '</div></div>';
      clearTimeout(toastTimer);
      toast.classList.remove('is-visible');
      void toast.offsetWidth;
      toast.classList.add('is-visible');
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), CONFIG.TOAST_VISIBLE_MS);
    }

    function unlock(id) {
      if (unlocked.has(id)) return false;
      const ach = achievementsDB.find(a => a.id === id);
      if (!ach) return false;
      unlocked.add(id); save();
      const card = document.querySelector('.achievement-card[data-achievement-id="' + id + '"]');
      if (card) card.classList.add('is-unlocked');
      const counter = document.getElementById('achievements-counter');
      if (counter) counter.textContent = unlocked.size + ' / ' + achievementsDB.length;
      showToast(ach);
      DebugLog.heal('🏆 Достижение: ' + ach.title);
      return true;
    }

    function check(episode, time) {
      if (typeof episode !== 'number' || typeof time !== 'number' || time < 0) return;
      achievementsDB.forEach(function (ach) {
        if (ach.episode !== episode || unlocked.has(ach.id)) return;
        if (Math.abs(time - ach.time) <= CONFIG.ACHIEVEMENT_TIME_TOLERANCE) { unlock(ach.id); return; }
        const sameEpisode = lastEpisode === episode;
        const jumped = sameEpisode && lastTime >= 0 && time - lastTime > 5;
        if (jumped && ach.time > lastTime && ach.time <= time) unlock(ach.id);
      });
      lastTime = time; lastEpisode = episode;
    }

    function handleMessage(event) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      let time = null;
      if (typeof data.time === 'number') time = data.time;
      else if (typeof data.value === 'number') time = data.value;
      else if (typeof data.currentTime === 'number') time = data.currentTime;
      if (time === null) return;
      let episode = null;
      if (typeof data.episode === 'number') episode = data.episode;
      else if (typeof data.series === 'number') episode = data.series;
      if (episode === null) {
        if (typeof window.currentEpisode === 'number' && window.currentEpisode > 0) episode = window.currentEpisode;
        else {
          const btn = document.querySelector('.episode-btn.is-active');
          if (btn) { const n = safeParseInt(btn.dataset.episode); if (n !== null) episode = n; }
        }
      }
      if (episode === null) return;
      check(episode, time);
    }

    function init() {
      unlocked = load(); renderCollection();
      window.addEventListener('message', handleMessage);
      DebugLog.info('Achievements ready: ' + unlocked.size + '/' + achievementsDB.length);
    }

    return {
      init, unlock,
      getUnlocked: () => Array.from(unlocked),
      reset: function () { unlocked.clear(); save(); lastTime = -1; lastEpisode = null; renderCollection(); DebugLog.info('Achievements reset'); },
      test: (ep, t) => check(ep, t)
    };
  })();

  /* ---------- INIT ---------- */
  function init() {
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    HeroSlider.build();
    renderAnimeGrid();

    const backBtn = document.getElementById('detail-back');
    if (backBtn) backBtn.addEventListener('click', () => Router.goHome());

    const debugToggle = document.getElementById('debug-toggle');
    if (debugToggle) debugToggle.addEventListener('click', DebugLog.toggle);
    const footerDebug = document.getElementById('footer-debug-btn');
    if (footerDebug) footerDebug.addEventListener('click', DebugLog.open);
    const debugClose = document.getElementById('debug-close');
    if (debugClose) debugClose.addEventListener('click', DebugLog.close);
    const debugClear = document.getElementById('debug-clear');
    if (debugClear) debugClear.addEventListener('click', DebugLog.clear);

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); DebugLog.toggle(); }
      if (e.key === 'Escape') DebugLog.close();
    });

    const header = document.getElementById('site-header');
    window.addEventListener('scroll', function () { if (header) header.classList.toggle('is-scrolled', window.scrollY > 50); }, { passive: true });

    AchievementsSystem.init();
    window.AnimeVerse = { Debug: DebugLog, Achievements: AchievementsSystem, Router, Player: PlayerManager };
    DebugLog.info('✅ AnimeVerse инициализирован (Sibnet fix)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

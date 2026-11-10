import passages from './passages.js';

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function readingTime(text) {
  return Math.max(60_000, text.split(/\s+/).length * 900);
}

export class PassageSequence {
  constructor(items, random = Math.random) {
    this.items = items;
    this.random = random;
    this.history = [];
    this.position = -1;
    this.bag = [];
  }
  next() {
    if (this.position < this.history.length - 1) return this.history[++this.position];
    if (!this.bag.length) {
      this.bag = shuffled(this.items, this.random);
      if (this.bag.length > 1 && this.bag.at(-1) === this.history.at(-1)) {
        [this.bag[0], this.bag[this.bag.length - 1]] = [this.bag.at(-1), this.bag[0]];
      }
    }
    const passage = this.bag.pop();
    this.history.push(passage);
    // Bound history for screens that stay open for days.
    if (this.history.length > this.items.length * 2) this.history.shift();
    this.position = this.history.length - 1;
    return passage;
  }
  previous() {
    this.position = Math.max(0, this.position - 1);
    return this.history[this.position];
  }
}

function mount() {
  const $ = selector => document.querySelector(selector);
  const figure = $('#passage');
  const quote = $('#quote');
  const reference = $('#reference');
  const pause = $('#pause');
  const previous = $('#previous');
  const appearance = $('#appearance');
  const mode = $('#screensaver');
  const status = $('#status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const sequence = new PassageSequence(passages);
  let current;
  let paused = motion.matches;
  let timer;
  let idleTimer;
  let statusTimer;
  let resizeFrame;
  let busy = false;
  let transition = 0;
  let head;

  function announce(message) {
    status.textContent = message;
    reveal();
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ''; }, 8000);
  }
  function reveal() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.body.classList.add('idle');
      head?.rest(); // he looks back at the viewer
    }, 4500);
  }
  function schedule() {
    clearTimeout(timer);
    if (!paused && !document.hidden && !busy) {
      timer = setTimeout(() => change('next'), readingTime(current.text));
    }
  }
  function fitQuote() {
    quote.style.fontSize = '';
    const layout = getComputedStyle($('main'));
    const available = innerHeight - parseFloat(layout.paddingTop) - parseFloat(layout.paddingBottom);
    const minimum = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const fits = size => {
      quote.style.fontSize = `${size}px`;
      return figure.getBoundingClientRect().height <= available;
    };
    let high = Math.floor(parseFloat(getComputedStyle(quote).fontSize));
    if (figure.getBoundingClientRect().height <= available) return;
    // Binary search for the largest whole pixel size that fits, down to a
    // readable minimum. Very small screens and zoom may still scroll.
    let low = Math.ceil(minimum);
    if (!fits(low)) return;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (fits(middle)) low = middle; else high = middle;
    }
    fits(low);
  }
  // Chrome balances six lines at most and Firefox ten; past that a last word can
  // sit alone. So narrow a longer passage as far as it goes without adding a line.
  function balanceQuote() {
    const height = quote.offsetHeight;
    if (height < 6.5 * parseFloat(getComputedStyle(quote).lineHeight)) return;
    let high = quote.offsetWidth;
    let low = high / 2;
    while (high - low > 2) {
      const middle = (low + high) / 2;
      quote.style.maxWidth = `${middle}px`;
      if (quote.offsetHeight > height) low = middle; else high = middle;
    }
    quote.style.maxWidth = `${high}px`;
  }
  function layoutQuote() {
    quote.style.maxWidth = '';
    fitQuote();
    balanceQuote();
  }
  function render(passage) {
    current = passage;
    quote.textContent = passage.text;
    const length = passage.text.length;
    figure.dataset.length = length > 260 ? 'long' : length < 75 ? 'brief' : 'short';
    reference.textContent = `Meditations · ${passage.label}`;
    reference.href = `/meditations/#${passage.id}`;
    reference.setAttribute('aria-label', `Read Meditations ${passage.label} in context (opens in a new tab)`);
    previous.disabled = sequence.position <= 0;
    // Burn-in guard: each passage sits a few pixels from where the last one did,
    // and the head behind it follows slowly.
    for (const axis of ['x', 'y']) {
      document.body.style.setProperty(`--drift-${axis}`, `${Math.round((Math.random() - 0.5) * 24)}px`);
    }
    layoutQuote();
  }
  async function change(direction) {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    const token = ++transition;
    figure.classList.add('fading');
    if (!motion.matches) await new Promise(resolve => setTimeout(resolve, 900));
    if (token !== transition) return;
    render(direction === 'previous' ? sequence.previous() : sequence.next());
    figure.classList.remove('fading');
    busy = false;
    schedule();
  }
  function updatePause() {
    const label = paused ? 'Resume rotation' : 'Pause rotation';
    pause.setAttribute('aria-label', label);
    pause.title = `${label} (Space)`;
    pause.classList.toggle('paused', paused);
    schedule();
  }
  function togglePause() { paused = !paused; updatePause(); }
  pause.addEventListener('click', togglePause);
  previous.addEventListener('click', () => change('previous'));
  $('#next').addEventListener('click', () => change('next'));
  motion.addEventListener('change', () => {
    if (motion.matches) { paused = true; updatePause(); }
  });

  // One button steps through the three appearances; its icon shows the current one.
  const appearances = ['system', 'light', 'dark'];
  function showAppearance(mode) {
    appearance.dataset.mode = mode;
    appearance.title = `Appearance: ${mode}`;
    appearance.setAttribute('aria-label', appearance.title);
  }
  showAppearance(document.documentElement.dataset.theme || 'system');
  appearance.addEventListener('click', () => {
    const mode = appearances[(appearances.indexOf(appearance.dataset.mode) + 1) % appearances.length];
    if (mode === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    showAppearance(mode);
    head?.redraw();
    try { localStorage.setItem('meditations-appearance', mode); } catch {}
  });

  // One button for what a screensaver is: fullscreen and a screen that stays
  // awake, each where the browser has it (an iPhone has no fullscreen).
  const canFullscreen = document.fullscreenEnabled;
  const canWake = 'wakeLock' in navigator;
  let screensaver = false;
  let wakeLock = null;
  let requestingWake = false;
  mode.hidden = !canFullscreen && !canWake;
  function updateScreensaver() {
    const label = screensaver ? 'Stop screensaver' : 'Start screensaver';
    mode.setAttribute('aria-pressed', String(screensaver));
    mode.setAttribute('aria-label', label);
    mode.title = `${label} (F)`;
  }
  async function requestWake() {
    if (!canWake || !screensaver || document.hidden || wakeLock || requestingWake) return;
    requestingWake = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!screensaver || document.hidden) { await lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener('release', () => {
        if (wakeLock !== lock) return;
        wakeLock = null;
        if (!document.hidden && screensaver) announce('Your screen can sleep again.');
      });
    } catch {
      announce('Your browser could not keep the screen awake.');
    } finally { requestingWake = false; }
  }
  async function toggleScreensaver() {
    if (mode.hidden) return;
    screensaver = !screensaver;
    status.textContent = '';
    updateScreensaver();
    if (screensaver) {
      // Both are asked for at once, while the click still counts as a gesture.
      const full = canFullscreen && !document.fullscreenElement
        ? document.documentElement.requestFullscreen().catch(() => announce('Fullscreen is unavailable in this browser.'))
        : null;
      await Promise.all([full, requestWake()]);
      if (!screensaver) return;
      if (!document.fullscreenElement && !wakeLock) { screensaver = false; updateScreensaver(); }
      else if (!canFullscreen) announce('The screen will stay awake.');
    } else {
      const lock = wakeLock;
      wakeLock = null;
      try { await lock?.release(); } catch {}
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
    }
  }
  mode.addEventListener('click', toggleScreensaver);
  // Leaving fullscreen another way (Esc) ends the screensaver too.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && screensaver) toggleScreensaver();
    reveal();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(timer);
      ++transition;
      busy = false;
      figure.classList.remove('fading');
    } else { schedule(); requestWake(); }
  });
  document.addEventListener('keydown', event => {
    reveal();
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.repeat) return;
    if (event.target.closest('button, select, input, textarea, a, [contenteditable]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); change('next'); }
    else if (event.key === 'ArrowLeft' && sequence.position > 0) { event.preventDefault(); change('previous'); }
    else if (event.code === 'Space') { event.preventDefault(); togglePause(); }
    else if (event.key?.toLowerCase() === 'f') toggleScreensaver();
  });
  document.addEventListener('pointermove', reveal, { passive: true });
  document.addEventListener('pointerdown', reveal, { passive: true });
  // A mouse click leaves focus on the button (or link), which would swallow
  // the keyboard shortcuts. Keyboard activation has detail 0 and keeps focus.
  document.addEventListener('click', event => {
    if (event.detail) event.target.closest('button, a')?.blur();
  });
  document.addEventListener('focusin', reveal);
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layoutQuote);
  });
  $('.controls').hidden = false;
  render(sequence.next());
  figure.classList.remove('fading'); // the first passage arrives like every other
  updatePause();
  reveal();
  // The head is decoration: load it after the first passage renders, and never
  // let it break the page.
  Promise.all([import('./head.js'), import('./head-data.js')])
    .then(([{ mountHead }, { default: drawing }]) => {
      head = mountHead($('#head'), drawing);
      const credit = $('.credit');
      if (head && credit) credit.hidden = false;
    })
    .catch(error => console.warn('Screensaver head unavailable', error));
}

if (typeof document !== 'undefined') mount();

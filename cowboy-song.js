(() => {
  const audio = document.querySelector('audio');
  const follow = document.querySelector('#follow-lyrics');
  const status = document.querySelector('#playback-status');
  const cues = Array.from(document.querySelectorAll('#lyrics [data-start]'), (line) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lyric-line';
    button.textContent = line.textContent;
    button.title = 'Speel vanaf deze regel';
    line.replaceWith(button);
    const cue = { start: Number(line.dataset.start), end: Number(line.dataset.end), button };
    button.addEventListener('click', async () => {
      status.textContent = '';
      audio.currentTime = cue.start;
      update();
      try {
        await audio.play();
      } catch {
        status.textContent = 'Afspelen lukt niet. Probeer de afspeelknop hierboven.';
      }
    });
    return cue;
  });
  let active = null;

  function scrollToActive() {
    if (!active || !follow.checked || audio.paused) return;
    const bounds = active.button.getBoundingClientRect();
    const playerBottom = document.querySelector('figure').getBoundingClientRect().bottom;
    if (bounds.top < playerBottom + 24 || bounds.bottom > window.innerHeight - 48) {
      active.button.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  }

  function update() {
    const next = cues.find((cue) => audio.currentTime >= cue.start && audio.currentTime < cue.end) || null;
    if (next === active) return;
    if (active) active.button.removeAttribute('aria-current');
    active = next;
    if (active) active.button.setAttribute('aria-current', 'true');
    scrollToActive();
  }

  for (const event of ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'ended']) {
    audio.addEventListener(event, update);
  }
  audio.addEventListener('play', () => {
    status.textContent = '';
    update();
    scrollToActive();
  });
  audio.addEventListener('error', () => {
    status.textContent = 'De audio kon niet worden geladen. Probeer de pagina opnieuw te laden.';
  });
  follow.addEventListener('change', scrollToActive);
  // Let listeners browse the lyrics without the next line pulling them back.
  window.addEventListener('wheel', () => { follow.checked = false; }, { passive: true });
  window.addEventListener('touchmove', () => { follow.checked = false; }, { passive: true });
  window.addEventListener('keydown', (event) => {
    if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)
        && !event.target.closest('audio, input, button')) follow.checked = false;
  });
  document.querySelector('#lyric-options').hidden = false;
  update();
})();

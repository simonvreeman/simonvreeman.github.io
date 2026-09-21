import { buildRandomEntries, currentEntryId, readingLine } from './search.js';

const labels = {
  chronology: 'Chronology', introduction: 'Introduction', notes: 'Notes', persons: 'Persons',
  'philosophical-background': 'Philosophy',
  'stoicism-and-the-meditations': 'Stoicism and Meditations',
  'the-meditations-genre-structure-and-style': 'Genre and style',
  'on-the-book-of-marcus': 'On the book',
};

export function headingLabel(heading) {
  const clone = heading.cloneNode(true);
  clone.querySelectorAll('a, sup, .heading-marker').forEach(node => {
    if (!node.classList.contains('heading-link')) node.remove();
  });
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

export function mountBreadcrumb(doc) {
  const root = doc.querySelector('.breadcrumb');
  if (!root) return;
  const view = doc.defaultView;
  const title = doc.querySelector('header h1');
  const items = [...root.querySelectorAll('li')];
  const links = items.map(item => item.querySelector('a'));
  const entries = buildRandomEntries(doc);
  const sections = [...doc.querySelectorAll('main > section[id]')].map(section => ({
    section,
    label: labels[section.id] || `Book ${section.id.slice(4)}`,
    entries: entries.filter(entry => entry.section === section),
    headings: section.id === 'introduction' ? [...section.querySelectorAll('h3[id], h4[id]')].map(marker => ({
      marker, label: labels[marker.id] || headingLabel(marker),
    })) : [],
  }));
  let frame = 0;
  let settling = false;
  let settleTimer;
  let lastKey;

  function update() {
    frame = 0;
    // Preserve both the focused element and its destination until focus leaves the trail.
    if (root.contains(doc.activeElement) || settling) return;
    root.hidden = title.getBoundingClientRect().bottom > 0;
    if (root.hidden) return;
    const line = readingLine(doc);
    const trail = [{ id: 'header', label: 'Meditations' }];
    const current = sections.find(({ section }) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= line && rect.bottom > line;
    });
    if (current) {
      trail.push({ id: current.section.id, label: current.label });
      const entry = currentEntryId(current.entries, line);
      if (entry) trail.push({ id: entry, label: entry.slice(4).replace('-', '.'), passage: true });
      else {
        const heading = current.headings.filter(({ marker }) => marker.getBoundingClientRect().top <= line).at(-1);
        if (heading) trail.push({ id: heading.marker.id, label: heading.label });
      }
    } else {
      const contents = doc.getElementById('nav');
      if (contents.getBoundingClientRect().top <= line && sections[0].section.getBoundingClientRect().top > line) {
        trail.push({ id: 'nav', label: 'Contents' });
      }
    }
    const key = trail.map(item => item.id).join('/');
    if (key === lastKey) return;
    lastKey = key;
    items.forEach((item, i) => {
      const crumb = trail[i];
      item.hidden = !crumb;
      links[i].removeAttribute('aria-current');
      if (!crumb) return;
      links[i].textContent = crumb.label;
      links[i].setAttribute('href', `#${crumb.id}`);
      links[i].setAttribute('title', crumb.label);
      item.dataset.passage = String(!!crumb.passage);
      if (i === trail.length - 1) links[i].setAttribute('aria-current', 'location');
    });
  }
  const schedule = () => { if (!frame) frame = view.requestAnimationFrame(update); };
  const finish = () => { settling = false; view.clearTimeout(settleTimer); schedule(); };
  const settle = () => {
    settling = true;
    view.clearTimeout(settleTimer);
    settleTimer = view.setTimeout(finish, 180);
  };
  // Hold the previous trail during smooth anchor jumps. Scrollend plus the debounce fallback
  // handles browsers without scrollend and jumps which do not move the viewport.
  doc.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    const url = new URL(link.href, view.location.href);
    if (url.origin === view.location.origin && url.pathname === view.location.pathname && url.hash) settle();
  });
  view.addEventListener('hashchange', settle);
  doc.addEventListener('scroll', () => { if (settling) settle(); else schedule(); }, { passive: true });
  doc.addEventListener('scrollend', finish);
  root.addEventListener('focusout', schedule);
  view.addEventListener('resize', schedule);
  view.addEventListener('pageshow', schedule);
  view.addEventListener('load', schedule);
  if (view.ResizeObserver) new view.ResizeObserver(schedule).observe(doc.body);
  schedule();
  return root;
}

if (typeof document !== 'undefined') mountBreadcrumb(document);

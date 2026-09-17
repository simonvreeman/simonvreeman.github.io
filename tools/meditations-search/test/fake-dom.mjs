// A minimal stand-in for the DOM, just large enough to run the adapter functions and
// mountSearch() from meditations/search.js under node:test. Supports the selectors the
// module uses: tag, #id, .class, tag[attr], comma lists and one "parent > child" step.
// Events bubble from the target to the document (fire()); focus() updates document.activeElement.

const SIMPLE = /^([a-z]+)?(?:#([\w-]+))?(?:\.([\w-]+))?(?:\[([\w-]+)\])?$/;

function matchesSimple(el, sel) {
  const m = SIMPLE.exec(sel);
  if (!m) throw new Error(`fake-dom: unsupported selector "${sel}"`);
  const [, tag, id, cls, attr] = m;
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  if (id && el.id !== id) return false;
  if (cls && !el.classList.contains(cls)) return false;
  if (attr && !el.hasAttribute(attr)) return false;
  return true;
}

function matches(el, selector) {
  return selector.split(',').some(part => {
    const [child, parent] = part.split('>').map(s => s.trim()).reverse();
    if (!matchesSimple(el, child)) return false;
    return !parent || (el.parentNode instanceof Element && matchesSimple(el.parentNode, parent));
  });
}

const toNode = n => (typeof n === 'string' ? new Text(n) : n);

class Node {
  constructor() { this.parentNode = null; }
  remove() {
    const p = this.parentNode;
    if (!p) return;
    p.childNodes.splice(p.childNodes.indexOf(this), 1);
    this.parentNode = null;
  }
  before(...nodes) { this.parentNode.insertAt(this.parentNode.childNodes.indexOf(this), nodes); }
  after(...nodes) { this.parentNode.insertAt(this.parentNode.childNodes.indexOf(this) + 1, nodes); }
}

export class Text extends Node {
  constructor(data) { super(); this.data = String(data); }
  get textContent() { return this.data; }
  cloneNode() { return new Text(this.data); }
}

export class Element extends Node {
  constructor(tagName, attrs = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
    this.childNodes = [];
    this.listeners = {};
    this.hidden = 'hidden' in attrs;
    const props = {};
    this.style = { setProperty: (n, v) => { props[n] = v; }, getPropertyValue: n => props[n] ?? '' };
  }
  get id() { return this.attrs.id ?? ''; }
  get className() { return this.attrs.class ?? ''; }
  set className(v) { this.attrs.class = v; }
  get classList() { return { contains: c => this.className.split(/\s+/).includes(c) }; }
  hasAttribute(n) { return n in this.attrs; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  get children() { return this.childNodes.filter(n => n instanceof Element); }
  get firstElementChild() { return this.children[0] ?? null; }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) { this.childNodes = []; this.append(v); }
  get ownerDocument() { let n = this; while (n.parentNode) n = n.parentNode; return n instanceof Document ? n : null; }
  insertAt(i, nodes) {
    const list = nodes.map(toNode);
    for (const n of list) { n.remove(); n.parentNode = this; }
    this.childNodes.splice(i, 0, ...list);
  }
  append(...nodes) { this.insertAt(this.childNodes.length, nodes); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { for (const n of [...this.childNodes]) n.remove(); this.append(...nodes); }
  cloneNode(deep) {
    const c = new Element(this.tagName, this.attrs);
    if (deep) for (const n of this.childNodes) c.appendChild(n.cloneNode(true));
    return c;
  }
  contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
  closest(sel) { for (let n = this; n instanceof Element; n = n.parentNode) if (matches(n, sel)) return n; return null; }
  *descendants() { for (const n of this.children) { yield n; yield* n.descendants(); } }
  querySelectorAll(sel) { return [...this.descendants()].filter(el => matches(el, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  focus() { const d = this.ownerDocument; if (d) d.activeElement = this; }
  select() {}
}

export class Document extends Element {
  constructor() {
    super('#document');
    this.body = this.appendChild(new Element('body'));
    this.activeElement = this.body;
    this.defaultView = { matchMedia: () => ({ matches: false }) };
  }
  getElementById(id) { return this.querySelector(`#${id}`); }
  createElement(tag) { return new Element(tag); }
}

// h('p', { id: 'x' }, 'text', h('em', {}, 'more')) builds a subtree; strings become text nodes.
export function h(tag, attrs = {}, ...children) {
  const el = new Element(tag, attrs);
  el.append(...children);
  return el;
}

// Dispatch a bubbling event from target up to the document; returns the event so tests can read defaultPrevented.
export function fire(target, type, init = {}) {
  const ev = { type, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
  for (let n = target; n; n = n.parentNode) for (const fn of n.listeners?.[type] ?? []) fn(ev);
  return ev;
}

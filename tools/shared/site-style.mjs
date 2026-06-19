// Shared base CSS for the GENERATED pages (entitymap.html, okf/index.html), kept in lock-step
// with the vreeman.com homepage design language: its CSS custom properties, font stacks, link
// styling, narrow centered column, and light/dark via prefers-color-scheme. Inlined into each
// page's <style> (the homepage inlines its CSS too — no external request, no homepage edit).
//
// Tokens only: the homepage's personal chrome (portrait header, rainbow .footer easter egg) is
// intentionally NOT included — these are data/reference pages.
//
// SITE_STYLE is the CSS body (no <style> tags); callers wrap it and may append page-specific rules.
// Muted text / hairline borders use color-mix against currentColor so they adapt to both themes.

export const SITE_STYLE = `
:root {
  color-scheme: light dark;
  --eigengrau: oklch(0.20 0.01 285.06);
  --blue-dark: oklch(0.52 0.18 255.84);
  --blue-light: oklch(0.67 0.18 251.85);
  --blue-lighter: oklch(0.77 0.13 244.77);
  --gray: oklch(0.85 0.00 none);
  --sans-serif: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --serif: ui-serif, -apple-system-ui-serif, Palatino, Georgia, Cambria, "Times New Roman", Times, serif;
  --monospace: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Roboto Mono", "Liberation Mono", "Courier New", monospace;
  accent-color: var(--blue-lighter);
}
:focus-visible { outline-color: var(--blue-lighter); }
:focus { outline: 3px solid var(--blue-lighter); outline-offset: 1px; }
::selection { color: var(--eigengrau); background-color: var(--blue-light); }
::marker { color: var(--blue-dark); }
html {
  overflow-y: scroll;
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
}
body {
  background-color: oklch(0 0 none / 0);
  color: var(--eigengrau);
  font-family: var(--sans-serif);
  font-size: 1.125rem;
  line-height: 1.618;
  letter-spacing: .01618em;
  font-weight: 400;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
main { max-width: 33.75rem; margin: 5% auto 10%; padding: 0 3%; }
h1 { text-align: center; }
h1, h2, h3 { line-height: 1.2; letter-spacing: .02em; }
a {
  color: var(--blue-dark);
  text-decoration: underline;
  text-decoration-skip: ink;
  text-decoration-skip-ink: auto;
}
a:not(:is(:hover, :focus)) {
  text-decoration-color: color-mix(in oklch, currentColor, transparent 75%);
}
code { font-family: var(--monospace); font-size: 1rem; }
hr { border: 0; border-top: 1px solid var(--gray); height: 0; overflow: visible; }
dt, summary { font-weight: 700; }
.muted { color: color-mix(in oklch, currentColor, transparent 35%); font-size: .85em; }
@media (prefers-color-scheme: dark) {
  body { background-color: var(--eigengrau); color: oklch(1.00 0.00 none); word-spacing: .05em; }
  a { color: var(--blue-light); }
  a:active, a:focus, a:hover { color: var(--blue-dark); }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}`;

# Meditations screensaver

Open `/meditations/screensaver/` through the site's static server.

The collection contains 53 editorially selected, standalone highlights. Each uses exact `<mark>` excerpts
from Books 1–12; no unmarked text is added or wording rewritten. The two adjacent
marked paragraphs in 5.20 are explicitly selected together, with a line break.
All other selections use a single highlight. Wording and entry links come from the original page.
The opening words in `tools/meditations-search/build-screensaver.mjs` identify the
selection. Regenerate after editing highlights:

```sh
node tools/meditations-search/build-screensaver.mjs
node --test tools/meditations-search/test/*.test.mjs
```

Appearance defaults to the system and can be overridden with Light or Dark. Only
this preference is saved. Space pauses/resumes, arrow keys navigate, and F toggles
fullscreen, unless keyboard focus is on a control (mouse clicks release focus).
Controls appear on interaction and fade after 4.5 seconds. Each passage stays for
at least 60 seconds, with extra time for longer passages. Hidden tabs suspend
rotation and receive a fresh reading interval on return. Reduced-motion users
start paused and get instant passage changes. Screen wake lock and fullscreen
controls appear only when supported. Wake lock requires an explicit click and is
not saved across visits. If JavaScript is unavailable, one marked passage remains
readable with its source link.

A faint crosshatched head of Marcus Aurelius sits behind the passage. It looks
toward the mouse (not touch), turns back to the viewer when the page goes idle,
and drifts very slowly; with reduced motion it stays still. Its strokes carry a
sculpted depth, so a turn moves the nose more than the silhouette. It loads
after the first passage and never blocks it. The drawing is traced from a
photograph of British Museum 1861,1127.15, © The Trustees of the British Museum
(CC BY-NC-SA 4.0), and is shared under the same licence; the page credits it
alongside the controls. Regenerate it after changing the generator (macOS, uses
`sips`):

```sh
node tools/meditations-search/build-screensaver-head.mjs
```

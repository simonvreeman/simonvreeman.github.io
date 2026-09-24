# Meditations screensaver: a crosshatched head of Marcus Aurelius — Design

- **Date:** 2026-09-24
- **Status:** Implemented 2026-09-24. §9 lists the deviations from this design. The step-by-step implementation plan was deleted after the build, because it only repeated the code.
- **Author:** Simon Vreeman (with Claude Code)
- **Scope:** Add a faint, crosshatched head of Marcus Aurelius to the deep background of `/meditations/screensaver/`. It drifts slowly, turns to look toward the mouse, and looks back at the viewer when the page goes idle. Nothing else on the page changes behaviour.

Guiding rule, from Simon: **the page should not distract.** The head may nearly disappear; it must never compete with the passage.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Style | Crosshatch (chosen over stipple and engraving after comparing samples in context) |
| Source | `meditations/marcus-aurelius-british-museum.jpg`, already in the repo, currently unused |
| Crop | The head only: hair to the bottom of the beard; the drapery fades out below the beard |
| Placement | Centred behind the passage, ~94% of the viewport height; on narrow portrait screens limited by width |
| Contrast | `--ink` at `--head-opacity: .1`; one stroke set for both themes (pencil on paper / chalk on slate) |
| Mouse | Marcus **looks toward** the pointer (not parallax): up to about ±8° yaw and ±5° pitch (reduced from ±10°/±6°, see §9.11) |
| Easing | Critically damped spring, settles in about 2 s, no overshoot |
| Idle | When the page goes idle (the existing 4.5 s `body.idle` moment), he turns back to look at you |
| Drift | Always on, barely visible: about ±1.2° yaw and ±0.6° pitch on ~50 s and ~35 s cycles (reduced from ±1.5°/±0.8°) |
| Touch-only | Drift only; a tap is not a gaze target |
| Reduced motion | A still, frontal head. No drift, no tracking (the page already starts paused) |
| Rendering | 3D strokes re-projected onto one `<canvas>` (chosen over stacked CSS-3D SVG layers and a flat tilted SVG) |
| Credit | Visible credit line that shows and fades with the controls, plus the data file header and README |
| Dependencies | None. The generator decodes the JPEG with macOS `sips`; the runtime is plain JS |

## 2. Facts the design relies on

- The photo is 1961×2500, near-frontal, on a flat dark slate backdrop, so a flood fill from the border separates marble from backdrop cleanly. The head sits at roughly x 620–1400, y 170–1120. The bust is turned slightly to his right (the nose sits left of the face's centre line by roughly 10°).
- British Museum images are licensed **CC BY-NC-SA 4.0**. A traced drawing is an adaptation: it needs attribution, a licence link, a note that it was changed, and the same licence.
- `screensaver.js` owns an idle timer (`reveal()` → `body.idle` after 4.5 s, which fades `.chrome` and hides the cursor). It is an ES module, imported by `screensaver.test.mjs` for its pure exports, and it only mounts when `document` exists.
- Style samples (scratchpad, 2026-09-24): the crosshatch had ~2,300 strokes and ~14,000 points; median stroke 4.8 and p90 12 processing px, on a 390×475 half-scale crop.
- Module scripts do not load from `file://`. Local checks use `python3 -m http.server 8765 --bind 127.0.0.1` from the repo root (a `.claude/launch.json` launcher cannot read `~/Documents` on this Mac).

## 3. Build: the generator

`tools/meditations-search/build-screensaver-head.mjs`, a sibling of `build-screensaver.mjs`, writes `meditations/screensaver/head-data.js`.

1. **Decode.** `sips -s format bmp` into a temp dir; parse the 24-bit BMP in Node (no npm packages).
2. **Crop and mask.** Crop the head, average down to half scale (390×475). Marble = everything not reached by a flood fill of dark pixels from the crop border. Multiply by an egg-shaped ellipse that fades out below the beard.
3. **Ink.** Darkness within the marble's own range (2nd–98.5th percentile) plus local detail (darkness minus a blurred copy), so the carved curls keep their edges and the smooth face does not turn into haze.
4. **Hatch.** Four layers of parallel strokes at different angles; each layer draws only where the ink passes its threshold, and strokes break into short pen-like lengths with a slight wobble. A seeded PRNG makes the output deterministic. Tuned from the approved sample (angles 38°, −52°, 82°, 8°; thresholds .2/.38/.56/.74).
5. **Depth.** Every stroke endpoint gets a depth `z` from a sculpted head model (see §4). Strokes are stored as straight segments: at these angles and lengths the surface curvature along one stroke is invisible.
6. **Rest pose.** Counter-rotate all vertices by a small yaw (~10°, tuned by eye) so the frontal pose looks straight at the viewer, and centre coordinates on the rotation pivot.
7. **Write** `head-data.js`: a "Generated … Do not edit" header, the attribution and licence, the drawing's size and pivot, and one flat integer array `[x0, y0, z0, x1, y1, z1, …]`, 6 numbers per stroke. About 60 KB, about 20 KB gzipped.

## 4. The depth model

No depth data exists for the bust, so the generator sculpts it, in processing px:

- **Skull:** a flattened-front ellipsoid centred on the head. The silhouette (hair edge, ears) sits at `z ≈ 0`, on the rotation axis, so it barely moves; the face sits about one half-width in front.
- **Features:** Gaussian bumps and dents on landmarks measured on the photo: the nose ridge and tip (the strongest, about +⅓ half-width), the brow ridge, cheekbones, lips, and beard volume, with the eye sockets as dents.
- **Pivot:** head centre horizontally, ear level vertically (the neck's axis).

Small turns mainly reveal how far the nose sticks out, so this is convincing at ≤10°. The model is tuned by rendering the head at the extreme poses (±max yaw, ±max pitch, plus the rest correction) and looking at them.

## 5. Runtime

### 5.1 `meditations/screensaver/head.js`

Pure functions, exported for tests:

- `project(vertices, yaw, pitch, out)`: orthographic rotation about the pivot. Yaw is positive to the viewer's right, pitch positive downward. `(0, 0)` reproduces the drawing exactly.
- `gazeTarget(dx, dy)`: pointer offset from the head's centre, normalised by half the viewport, to `{ yaw, pitch }` with soft saturation (`max × tanh(k × d)`).
- `springStep(state, target, dt)`: critically damped spring.
- `drift(seconds)`: the two slow sinusoids.

Plus `mountHead(canvas, { reducedMotion })`, returning `{ rest(), redraw() }`. It owns:

- **Pointer:** a `pointermove` listener for `pointerType` mouse and pen that sets the gaze target.
- **Loop:** `requestAnimationFrame` while the spring is moving. When it settles and only the drift remains, it switches to a ~8 fps timer, and it skips any frame whose largest vertex movement since the last drawn frame is under ~0.25 device px. Stops on `visibilitychange` hidden and resumes on visible.
- **Canvas:** sized to the head's box plus a small margin (not the full viewport), backing store at `devicePixelRatio` (capped at 2). One path per frame, stroked once, line width ~0.75 CSS px scaled with the head. The colour is read from `getComputedStyle(canvas).color` (`color: var(--ink)`) and re-read on theme changes.
- **Fade-in:** the canvas gets a `ready` class after the first draw; CSS fades it from 0 to `--head-opacity` over 2 s.
- **Reduced motion:** draw the rest pose once. No loop, no pointer. Redraw on resize and theme change.

### 5.2 Integration

- `index.html`: `<canvas id="head" aria-hidden="true">` before `<main>`; a `<p class="credit">` in the footer.
- `screensaver.css`: fixed, centred, `pointer-events: none`, beneath `main`; `--head-opacity`; the fade-in; the credit line inherits `.chrome`'s fade.
- `screensaver.js`: loads the head with a **dynamic** `import('./head.js')` after the first passage renders, inside a `catch`. A missing or broken head can never take the passages down, and the ~60 KB of stroke data never delays the text. Calls `head.rest()` where the idle timer adds `body.idle`, and `head.redraw()` after an appearance change.
- `README.md`: how to regenerate the head, plus the credit.

## 6. Credit and licence

- **On the page:** a short line in the footer, visible only while the controls are, for example "Drawing after a bust © The Trustees of the British Museum · CC BY-NC-SA 4.0". It links to the object page (URL to be verified during implementation, not guessed) and to the licence.
- **In `head-data.js`:** the same credit, "adapted (traced as a crosshatch drawing)", and "shared under CC BY-NC-SA 4.0".

## 7. Testing

`tools/meditations-search/test/screensaver-head.test.mjs` (`node --test`, repo convention):

1. **Data:** assert the stroke count is in the expected range **first** (an empty array would make everything else pass); all values are finite integers within the drawing's bounds; `z` is within the model's range.
2. **Projection:** `project(…, 0, 0)` returns the stored x/y exactly. With yaw > 0 the frontmost vertex moves right by more than any silhouette vertex (he turns, rather than slides).
3. **Gaze:** the centre gives `(0, 0)`; right gives positive yaw, below gives positive pitch; magnitudes never exceed the maximums.
4. **Spring:** reaches the target within ~3 s of simulated time without overshooting.
5. **Drift:** bounded by its amplitudes.
6. **Regeneration:** on macOS (where `sips` exists), running the generator reproduces the committed `head-data.js` byte for byte; skipped elsewhere.

Visual and manual checks, against the local server in the built-in browser and with headless Chrome screenshots: rest pose frontal in light and dark; pointer at the four edges; idle return; reduced motion; frame cost with `performance.now()` around the draw; loop stopped while the tab is hidden.

## 8. Risks and tuning items

- **The depth model is approximate.** Mitigated by modest angles, visual tuning at the extremes, and the fact that the head is at 10% opacity. Turns toward the viewer's right sit further from the photographed pose (rest correction plus turn), so check that side hardest.
- **`sips` is macOS-only.** The generated data is committed, and the regeneration test skips elsewhere.
- **Canvas colour parsing.** If a browser cannot parse the computed `oklch()` colour, `strokeStyle` stays at its default. That fails quietly: black strokes at 10% opacity, invisible on the dark theme.
- **Credit line on landscape phones** (`max-height: 500px`) competes for space with the controls. Keep it one short line; check it.

## 9. Deviations and measurements (2026-09-24)

1. **Skull shape.** The ellipsoid in §4 did not cover the upper corners of the hair (depth clamped to 0 there), and its √ profile has an infinitely steep rim. At double angles, strokes crossing that rim smeared into horizontal streaks. The skull is now a rounded box (superellipse, exponent 3, radii 190 × 235) with a `1 − r²` profile, which reaches the axis at the silhouette with a finite slope. The streaks are gone at 2× the angles, and all five poses are clean at 1×.
2. **Rest correction.** `REST_YAW = 10°` held after tuning; the test "at rest he faces the viewer" asserts that the frontmost vertex is within 12 units of the pivot axis.
3. **API.** `mountHead(canvas, drawing)` takes the drawing as an argument (loaded in parallel with `head.js`), so `head.js` stays importable in Node without the data. It reads `prefers-reduced-motion` itself and follows changes, rather than taking a `reducedMotion` option.
4. **Hidden tabs.** The drift's clock pauses while the tab is hidden, so he does not jump on return. It also counts as paused from mount, for pages opened in a background tab.
5. **Credit.** The object is **British Museum 1861,1127.15** (marble bust of Marcus Aurelius in a fringed cloak, c. 160–170, from the House of Jason Magnus, Cyrene; Room 70), confirmed on the collection page. The credit links to it and to the licence. The links do not wrap internally (the narrow portrait layout had split "CC / BY-NC-SA").
6. **Measured cost** (built-in browser): 0.16 ms per frame for projection plus stroke at a 2× backing store. While only drifting, 2.3 redraws per second at 1× (see 10e; it was about 4 per second at 1× and 7.5 at 2× before the review).
7. **Data size:** 2,373 strokes; `head-data.js` is 49 KB raw and 19 KB gzipped once packed (see 12; it was 84 KB and 31 KB). Regeneration takes 0.26 s.
8. **Local server.** A `python3 -m http.server 8765` from an earlier session was already serving the repo and was reused.
9. **Eyes (Simon's feedback).** The lower lids are soft in the marble and dropped out of the hatching. `EYES` in the generator adds a local lift to the ink map around each eye, mostly just below it: it raises the local-detail gain (so the carved lid line crosses the first hatch threshold) plus a faint tone. The requested "touch, don't overdo it" is 18 more strokes, checked at 10% in both themes.
10. **Review fixes.** An independent review found nothing critical or important. The minor findings are fixed, each with a test against a fake browser with a manual clock, written to fail first:
    - a. *(Removed in 12.)* **Reduced motion switched off mid-turn.** The spring now restarts at `−drift(now)`, so motion resumes from the frontal frame that was showing. It used to jump about 110 device px.
    - b. *(Removed in 12.)* **Pixel ratio.** A `(resolution: …dppx)` media query re-lays out the canvas when the window moves to a screen with another pixel ratio, which fires no `resize`.
    - c. **No 2D context.** `mountHead` returns `null`, and the credit only appears with a drawing.
    - d. **Settled check.** `settled()` is now measured in pixels: the remaining travel, plus the coast `v / STIFFNESS`, under ¼ device px. Animation frames stop about 3.7 s into a turn instead of 5.4 s.
    - e. **Drift steps.** While he only drifts, a frame is drawn only once a stroke would move a whole device pixel (0.5 CSS px at 2×, invisible at 10%). That gives 2.3 redraws per second at 1× and at most about 5 at 2×, down from 7.5.
    - f. **Scheduler tests.** Timer versus animation frames, hidden tabs, reduced motion, and the pixel-ratio change are now tested.
    - g. **Generator errors.** The generator now reports why `sips` failed. `sips` exits 0 when it skips a file, so the generator checks that the BMP exists and quotes `sips`'s message.
    - h. **Test tightening.** The data test's depth bounds match the real range, and the stale-data message mentions macOS and Node updates.
11. **Less movement (Simon, after discussing it with Codex).** All four angles are about 20% smaller: the turn is ±8° yaw and ±5° pitch (was ±10°/±6°), and the drift is ±1.2° and ±0.6° (was ±1.5°/±0.8°). The motion test now asserts the property (the nose moves the right way and at least 10× as far as the ear on the axis) rather than a magnitude tied to the old angles.
12. **Leaner (Simon asked whether it needed this much JS).** Only `head.js` and `head-data.js` ship. The rest is repo-only.
    - **Packed drawing:** half-unit precision, with each stroke's second end stored relative to its first. That takes the drawing from 31 KB to 19 KB gzipped. No coordinate moved more than 0.2 units (about 0.4 CSS px), which is invisible at 10%. `strokeVertices()` in `head.js` decodes it.
    - **Rare cases removed:** 10a and 10b, with their tests. The reduced-motion listener is back to one line; switching the setting off mid-turn causes a one-time jump.
    - **Plan deleted:** the implementation plan duplicated the code.

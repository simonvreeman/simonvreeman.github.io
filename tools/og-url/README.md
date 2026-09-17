# og:url repair

**The rule: a page's `og:url` is its canonical URL, byte for byte.** Nothing else. A page that
states two different identities for itself has told every consumer to pick one, and they do not all
pick the same one.

The failure it prevents is not theoretical — it was shipped. 81 of the site's 112 pages disagreed
with their own canonical. 80 of them were repaired by this tool in commit `47a54da`; the 81st,
`meditations/index.html`, had been fixed by hand one commit earlier as part of the Meditations
metadata work. The split, counted from that diff:

- **75 carried an empty `og:url`** — all 72 Seneca pages (69 letters, the index and the two essays)
  and 3 Stockdale essays, all from one template whose `content=""` was never filled in. This is the
  worse half. A tagged URL at least resolves; an empty string gives a platform nothing to
  canonicalise against, so a crawler or a social card falls back to whatever URL it was handed —
  tracking parameters and all. Every share of a Seneca letter was affected.
- **5 still carried `?utm_source=social&utm_medium=organic&utm_campaign=share`** (`index.html`,
  `discourses/index.html`, `discourses/enchiridion.html`, `discourses/fragments.html`,
  `discourses/george-long.html`), and `meditations/index.html` made a sixth. Campaign attribution for
  a share belongs in the share link, not in the page's own statement of what it is. Anything that
  treats `og:url` as page identity — including an agent building a link graph — recorded the tagged
  URL as the page.

## Regenerating

    node tools/og-url/build.mjs

Prints a `SKIP` line per page it declined to touch, a `NOTE` per canonical that points somewhere
other than its own page, and a count. It is idempotent: a second run reports `0 pages repointed`.

## The value is derived, never typed

Every page already carries a correct `<link rel="canonical">`, so `og:url` is **copied from it**. The
two therefore cannot disagree — not because someone checked 81 files, but because there is only one
value and one of the tags is a copy of the other. A hand-edit pass over 81 pages would have
reintroduced the same class of error it was fixing, a few times, silently.

`tools/og-url/test/og-url.test.mjs` then re-checks every shipped page, which makes this a ratchet as
much as a repair: the next page that copies the template and leaves `og:url` empty fails the suite
instead of shipping. One test (`the generator has nothing left to do`) asserts `planFixes().fixes` is
empty, so a green suite cannot mean "someone fixed the pages by hand and the generator has since
drifted".

## Scope: `git ls-files`

Pages come from `git ls-files -z -- '*.html'`, not from a directory walk. The sweep therefore covers
**what the site actually publishes and nothing else**. An untracked draft in the working tree is left
to its author until they commit it — at which point the test names it and re-running this fixes it.
That is deliberate: a generator that rewrites files the author has not committed yet is a generator
that fights the person using it.

## What it refuses to do

The patterns `CANONICAL` and `OG_URL` match a whole tag in the exact form all 112 pages use — double
quotes, this attribute order. Regex over HTML is where this repo's bugs have lived, and a lenient
pattern fails in the dangerous direction: it quietly rewrites a tag it did not really understand.
Strict fails in the safe direction — a page that reorders the attributes or switches to single quotes
is skipped rather than mangled, and the test's separate loose scan turns that skip into a red suite
rather than a page that quietly never gets fixed.

A canonical that is empty, off-origin, or carries a `?` or `#` is **unusable**: copying it into
`og:url` would launder the exact defect this tool exists to remove. Such a page is skipped and named,
never patched with a value the tool had to invent. After the write, the file must have grown by
exactly the length difference between the two URLs; any other delta aborts before anything is written.

## `seneca/letter-124.html` — the one `NOTE`

    NOTE seneca/letter-124.html: canonical points at https://vreeman.com/seneca/letter-,
         not https://vreeman.com/seneca/letter-124

That page is an unfilled copy of the template: `<title>📗 Letter X: - Seneca</title>`, empty
`<h1>Letter X: </h1>`, an empty `<p>`, and a canonical, `hreflang` pair and `og:url` all still reading
`https://vreeman.com/seneca/letter-`. `seneca/letter-.html` is a second, near-identical stray with
the **same** canonical.

This tool reports that and deliberately does not overrule it. Its whole contract is that the
canonical is the source of truth; a generator that decided a page's canonical was wrong and invented
a replacement would be doing something quite different, and far less safe. So `letter-124.html`'s
`og:url` agrees with its canonical — the two are consistent, and both are wrong. Neither stub is in
`sitemap.xml` or linked from `seneca/index.html`, but **`llms.txt` advertises `/seneca/letter-124`**.
Finishing or deleting those two pages, and reconciling `llms.txt`, is recorded as backlog in
[the design doc](../../docs/plans/2026-09-17-agent-surfaces-design.md#9-out-of-scope--backlog).

`letter-.html` draws no `NOTE`, because its canonical happens to match the URL its own filename
implies. The check is "does this canonical point at this page", and for that stray it does.

## Not repaired here: a canonical with no `og:url`

18 pages declare a canonical and carry no `og:url` tag at all. `build.mjs` skips them without a word:
inventing a tag is a different change from repairing one, with different judgement behind it (most of
the 18 are utility pages that canonicalise to the homepage, where a self-referential `og:url` would be
wrong). They are listed in the design doc's backlog.

## Tests

    node --test tools/og-url/test/*.test.mjs

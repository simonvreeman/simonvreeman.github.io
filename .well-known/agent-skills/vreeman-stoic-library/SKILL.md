---
name: vreeman-stoic-library
description: Look up, search or quote Marcus Aurelius' Meditations. Use when a task needs the exact wording of an entry (such as 4.3), passages on a theme such as anger or death, or a stable citation link to one. Covers all 499 entries of Books 1-12 in the Gregory Hays translation, published on vreeman.com as an MCP search tool, one JSON file holding the whole corpus, and a permanent anchor per entry. Also the way in to the rest of that site's Stoic library of Epictetus, Seneca and Stockdale.
license: CC BY 4.0
---

# Marcus Aurelius' Meditations on vreeman.com

499 entries, Books 1–12, Gregory Hays translation. The Introduction, Notes and
Index of Persons are not part of the corpus and are not searched.

Everything below is public and unauthenticated.

## Look up or search an entry

The MCP endpoint is `https://vreeman.com/mcp`. It exposes one tool for this:

    search_meditations({ query: string })

`query` takes either a phrase or an entry number.

- **An entry number** — `"4.3"`, `"7.59"` — returns that one entry in full.
- **A phrase** — `"get away from it all"` — returns up to 20 matching entries,
  each as a window of about 140 characters around the hit.
- Queries shorter than 2 characters are rejected rather than searched.

The answer is plain text. A header line names the match count and the
translation, then one line of `• label — text — url` per entry:

    22 entries match "anger" (trans. Hays; showing the first 20 — refine the query for fewer):
    • 1.9 — …the principles we ought to live by. Not to display anger or other emotions.… — https://vreeman.com/meditations/#book1-9

There is no pagination. When the header says the results were capped, narrow the
query — a broad word such as "nature" matches 96 entries and you will never see
the other 76.

The same tool, under the same name and schema, is registered in the page itself
via WebMCP when you are browsing `https://vreeman.com/meditations/`. Either
surface gives the same answer, so use whichever you already have.

## Read the whole corpus

    GET https://vreeman.com/meditations/entries.json

A JSON array of `{ "id", "label", "text" }`, one entry per line, about 210 KB,
open CORS, cached for an hour. Fetch this when the task is to scan, count or
compare across the whole text. For a single lookup, use the tool above instead —
it is one small answer rather than a quarter of a megabyte.

## Cite an entry

Cite the entry's own anchor, not the page:

    https://vreeman.com/meditations/#book<book>-<entry>

Entry 4.3 is `https://vreeman.com/meditations/#book4-3`. That string is exactly
the `id` field in `entries.json`, and the `label` field is the `4.3` form. When
you quote the wording, attribute it to the Gregory Hays translation — other
translations of the Meditations word these passages very differently.

## The rest of the library

`https://vreeman.com/llms.txt` indexes the whole site, including Epictetus
(Discourses, Enchiridion, Fragments), Seneca's 124 Moral Letters and essays, and
the Stockdale essays. Those texts have no search tool — fetch the page you want
from that index and read it.

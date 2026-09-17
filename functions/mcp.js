// MCP server for vreeman.com — Cloudflare Pages Function serving https://vreeman.com/mcp
// Stateless JSON-RPC 2.0 over the MCP Streamable HTTP transport (application/json only;
// no SSE, no sessions, no auth — read-only). Spec: https://modelcontextprotocol.io/specification/2025-06-18
//
// Exposes two tools: `search_content` over the page catalog below (mirroring the WebMCP tool on the
// homepage), and `search_meditations` over the 499 entries of the Meditations.
//
// The Meditations matching logic is IMPORTED from meditations/search.js — the same module the page's
// own search box runs — so quote folding, label matching and snippets have one definition, not three.
// Cloudflare Pages compiles functions/ with esbuild and inlines relative imports, including ones
// reaching above functions/, so this resolves at deploy time; see tools/mcp/README.md. The module's
// trailing mountSearch(document) is guarded on `typeof document`, so it bundles in as a no-op here.
import { findMatches, snippet, statusText, withLower } from "../meditations/search.js";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = {
  name: "com.vreeman/site-search",
  title: "Vreeman Site Search",
  version: "1.0.0",
};

// Pages on this site (kept in sync with the WebMCP catalog in index.html).
const CATALOG = [
  { title: "Simon Vreeman — Growth & Technical Marketing Advisor", url: "https://vreeman.com/", tags: "home about growth conversion analytics marketing advisor" },
  { title: "List of CRO Tools", url: "https://vreeman.com/cro", tags: "cro conversion rate optimization experimentation ab testing tools" },
  { title: "Experiment Hypothesis Builder", url: "https://vreeman.com/hypothesis", tags: "cro experiment hypothesis ab test builder" },
  { title: "GA4 UTM Campaign URL Builder", url: "https://vreeman.com/utm", tags: "utm campaign url google analytics ga4 tracking source medium" },
  { title: "GA4 Measurement Protocol Hit Builder", url: "https://vreeman.com/mp", tags: "measurement protocol ga4 server side events hits" },
  { title: "Meditations by Marcus Aurelius", url: "https://vreeman.com/meditations/", tags: "stoicism marcus aurelius meditations philosophy" },
  { title: "Discourses of Epictetus (Arrian)", url: "https://vreeman.com/discourses/", tags: "stoicism epictetus discourses arrian philosophy" },
  { title: "Enchiridion (Handbook) of Epictetus", url: "https://vreeman.com/discourses/enchiridion", tags: "stoicism epictetus enchiridion handbook" },
  { title: "Fragments of Epictetus", url: "https://vreeman.com/discourses/fragments", tags: "stoicism epictetus fragments" },
  { title: "Moral Letters of Seneca (124 letters)", url: "https://vreeman.com/seneca/", tags: "stoicism seneca letters lucilius philosophy death virtue" },
  { title: "Seneca — On the Shortness of Life", url: "https://vreeman.com/seneca/on-the-shortness-of-life", tags: "stoicism seneca essay time life brevity" },
  { title: "Seneca — On the Tranquillity of Mind", url: "https://vreeman.com/seneca/on-the-tranquillity-of-mind", tags: "stoicism seneca essay tranquillity peace mind" },
  { title: "Essays on Stoicism by James Stockdale", url: "https://vreeman.com/stockdale/", tags: "stoicism stockdale epictetus vietnam navy" },
  { title: "Stockdale — Courage Under Fire", url: "https://vreeman.com/stockdale/courage-under-fire", tags: "stoicism stockdale epictetus courage prisoner" },
  { title: "Stockdale — The Stoic Warrior's Triad", url: "https://vreeman.com/stockdale/stoic-warriors-triad", tags: "stoicism stockdale tranquility fearlessness freedom" },
  { title: "Stockdale — Master of My Fate", url: "https://vreeman.com/stockdale/master-of-my-fate", tags: "stoicism stockdale hanoi prison fate" },
  { title: "The Man in the Arena — Theodore Roosevelt", url: "https://vreeman.com/roosevelt/", tags: "roosevelt man arena speech courage critic" },
  { title: "Invictus — William Ernest Henley", url: "https://vreeman.com/invictus", tags: "poem invictus henley unconquerable soul" },
  { title: "If— — Rudyard Kipling", url: "https://vreeman.com/if", tags: "poem if kipling" },
  { title: "Experiment — Cole Porter", url: "https://vreeman.com/experiment", tags: "song cole porter experiment" },
  { title: "Get Drunk — Charles Baudelaire", url: "https://vreeman.com/drunk", tags: "poem baudelaire enivrez-vous get drunk" },
];

const SEARCH_TOOL = {
  name: "search_content",
  title: "Search Simon Vreeman's site",
  description:
    "Search Simon Vreeman's site and return matching pages (title + URL). Covers technical-marketing tools (GA4 UTM builder, Measurement Protocol hit builder, CRO tools, experiment hypothesis builder) and a Stoic philosophy library (Seneca's letters, Marcus Aurelius' Meditations, Epictetus' Discourses, Stockdale's essays, classic poems).",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search terms, e.g. 'utm', 'measurement protocol', 'cro', 'seneca death', 'epictetus', 'meditations'.",
      },
    },
    required: ["query"],
  },
};

function searchContent(query) {
  const q = String(query).trim().toLowerCase();
  const hits = CATALOG.filter((e) => (e.title + " " + e.url + " " + e.tags).toLowerCase().includes(q));
  if (!hits.length) {
    return `No results for "${q}". Try: utm, measurement protocol, cro, hypothesis, seneca, meditations, epictetus, stockdale.`;
  }
  return (
    `${hits.length} result${hits.length === 1 ? "" : "s"} for "${q}":\n` +
    hits.map((e) => `• ${e.title} — ${e.url}`).join("\n")
  );
}

// --- search_meditations --------------------------------------------------
const MEDITATIONS_TOOL = {
  name: "search_meditations",
  title: "Search the Meditations",
  description:
    "Search the 499 entries of Marcus Aurelius' Meditations (Books 1–12, Gregory Hays translation) " +
    "and return the matching entries with a snippet and a deep link. Books only — the Introduction, " +
    "Notes and Index of Persons are not searched.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        // Every example here is checked against the real corpus by tools/mcp/test/dispatch.test.mjs:
        // an agent will copy one verbatim, and this is the Hays wording, not Long's.
        description: "A phrase, e.g. 'get away from it all', or an entry number such as '4.3'.",
      },
    },
    required: ["query"],
  },
  annotations: { readOnlyHint: true },
};

// The corpus is generated by tools/meditations-search/build-index.mjs. Fetched once per isolate and
// cached in module scope; edge-cached for an hour by _headers. A failed fetch clears the cache so the
// next request retries, rather than poisoning the isolate with a rejected promise for its whole life.
const ENTRIES_URL = "https://vreeman.com/meditations/entries.json";
let entriesPromise = null;
const defaultLoadEntries = () =>
  (entriesPromise ??= fetch(ENTRIES_URL)
    .then((r) => r.json())
    .catch((e) => {
      entriesPromise = null;
      throw e;
    }));

const MAX_RESULTS = 20;

// findMatches/snippet/statusText are imported from meditations/search.js, never copied. `entries`
// arrives rehydrated — see the withLower() call in dispatch().
function searchMeditations(entries, query) {
  const { query: q, matches } = findMatches(entries, query);
  if (!matches.length) return `No entries match "${q}".`;
  const shown = matches.slice(0, MAX_RESULTS);
  const head =
    `${statusText(matches.length)} "${q}"` +
    (matches.length > MAX_RESULTS ? ` (showing the first ${MAX_RESULTS})` : "") +
    ":";
  const lines = shown.map((e) => {
    const s = snippet(e, q);
    const text = (s.leading ? "…" : "") + s.before + s.hit + s.after + (s.trailing ? "…" : "");
    return `• ${e.label} — ${text} — https://vreeman.com/meditations/#${e.id}`;
  });
  return [head, ...lines].join("\n");
}

// --- JSON-RPC helpers ----------------------------------------------------
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

const toolResult = (id, text, isError = false) => ok(id, { content: [{ type: "text", text }], isError });

// Async because search_meditations fetches its corpus. `deps` exists so the tests can hand it one
// without a network round trip (tools/mcp/test/dispatch.test.mjs).
export async function dispatch(msg, deps = {}) {
  const loadEntries = deps.loadEntries || defaultLoadEntries;
  const id = msg.id;
  const params = msg.params || {};
  switch (msg.method) {
    case "initialize": {
      const requested = params.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Use search_content to find pages on vreeman.com — Simon Vreeman's marketing tools and Stoic " +
          "philosophy library. Use search_meditations to quote a specific entry of Marcus Aurelius' " +
          "Meditations; it returns a deep link to each matching entry.",
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: [SEARCH_TOOL, MEDITATIONS_TOOL] });
    case "tools/call": {
      const name = params.name;
      const args = params.arguments || {};
      if (name !== SEARCH_TOOL.name && name !== MEDITATIONS_TOOL.name) {
        return err(id, -32602, `Unknown tool: ${name}`);
      }
      const query = args.query;
      if (typeof query !== "string" || query.trim() === "") {
        return toolResult(id, "The 'query' argument is required (a non-empty search string).", true);
      }
      if (name === SEARCH_TOOL.name) return toolResult(id, searchContent(query));
      let entries;
      try {
        // entries.json ships { id, label, text }: `lower` is derivable and carrying it would nearly
        // double the file, but findMatches() reads it unconditionally. withLower() puts it back —
        // never a second groupEntries() pass, which would strip a leading "§ N.M" again and truncate
        // an entry that legitimately starts with its own number. It mutates, and what it is handed is
        // the module-scoped cache, so every request after the first re-applies it to the same objects.
        // That is safe: it is idempotent, and synchronous, so no request sees a half-rehydrated array.
        entries = withLower(await loadEntries());
      } catch {
        // Without this the rejection escapes dispatch() and the client gets a bodiless 500 instead of
        // something it can show. dispatch() could not throw at all before it started fetching.
        return toolResult(id, "The Meditations corpus could not be loaded. Please try again.", true);
      }
      return toolResult(id, searchMeditations(entries, query));
    }
    default:
      return err(id, -32601, `Method not found: ${msg.method}`);
  }
}

// --- HTTP wrappers (Cloudflare Pages Functions) --------------------------
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, authorization",
  "access-control-max-age": "86400",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });

export async function onRequestPost(context) {
  let raw;
  try {
    raw = await context.request.text();
  } catch {
    raw = "";
  }
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return json(err(null, -32700, "Parse error"));
  }

  // Must be a single JSON-RPC object (primitives and batch arrays are unsupported).
  if (msg === null || typeof msg !== "object" || Array.isArray(msg)) {
    return json(err(null, -32600, "Invalid Request"));
  }

  // Streamable HTTP: a POSTed notification or response is acknowledged with 202, no body.
  const isNotification = typeof msg.method === "string" && msg.id === undefined;
  const isResponse = msg.method === undefined && ("result" in msg || "error" in msg);
  if (isNotification || isResponse) {
    return new Response(null, { status: 202, headers: CORS });
  }

  if (typeof msg.method !== "string") {
    return json(err(msg.id !== undefined ? msg.id : null, -32600, "Invalid Request"));
  }
  return json(await dispatch(msg));
}

export function onRequestGet() {
  return new Response(
    "Method Not Allowed. This MCP endpoint does not offer an SSE stream; send JSON-RPC via HTTP POST.",
    { status: 405, headers: { "content-type": "text/plain; charset=utf-8", allow: "POST, OPTIONS", ...CORS } }
  );
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

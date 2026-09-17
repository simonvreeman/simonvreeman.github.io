// MCP server for vreeman.com — Cloudflare Pages Function serving https://vreeman.com/mcp
// Stateless JSON-RPC 2.0 over the MCP Streamable HTTP transport (application/json only;
// no SSE, no sessions, no auth — read-only). Spec: https://modelcontextprotocol.io/specification/2026-07-28
//
// DUAL-ERA. The 2026-07-28 revision removed the `initialize` handshake: every request declares its
// own protocol version in params._meta, sessions and the standalone GET stream are gone, and
// `server/discover` is mandatory. Older ("legacy") clients open with a handshake and have no way to
// fall forward when it is refused, so this one URL answers both eras — which the spec explicitly
// permits: "A dual-era server MAY serve both eras concurrently on the same endpoint or process."
//
// Exposes two tools: `search_content` over the page catalog below (mirroring the WebMCP tool on the
// homepage), and `search_meditations` over the 499 entries of the Meditations.
//
// The Meditations matching logic is IMPORTED from meditations/search.js — the same module the page's
// own search box runs — so quote folding, label matching and snippets have one definition, not three.
// Cloudflare Pages compiles functions/ with esbuild and inlines relative imports, including ones
// reaching above functions/, so this resolves at deploy time; see tools/mcp/README.md. The module's
// trailing mountSearch(document) is guarded on `typeof document`, so it bundles in as a no-op here.
import { findMatches, MIN_QUERY, snippet, statusText, withLower } from "../meditations/search.js";

// Newest first: DiscoverResult.supportedVersions is the list a modern client picks from.
const MODERN_PROTOCOL_VERSION = "2026-07-28";
// Versions reachable through the `initialize` handshake. 2025-11-25 is a legacy revision we do not
// implement, so it is deliberately absent rather than claimed.
const LEGACY_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SUPPORTED_PROTOCOL_VERSIONS = [MODERN_PROTOCOL_VERSION, ...LEGACY_PROTOCOL_VERSIONS];
const LATEST_LEGACY_PROTOCOL_VERSION = LEGACY_PROTOCOL_VERSIONS[0];

// Reserved _meta keys (schema.ts: RequestMetaObject / ResultMetaObject). Any prefix whose second
// label is `modelcontextprotocol` or `mcp` belongs to MCP; these are its own.
const PROTOCOL_VERSION_META = "io.modelcontextprotocol/protocolVersion";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
// schema.ts: UNSUPPORTED_PROTOCOL_VERSION. Distinct from -32602; carries {supported, requested}.
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

const SERVER_INFO = {
  name: "com.vreeman/site-search",
  title: "Vreeman Site Search",
  version: "1.1.0",
};

const CAPABILITIES = { tools: { listChanged: false } };

// Named once and served by both `server/discover` and the legacy `initialize`, so the two eras can
// never drift into describing different servers.
const INSTRUCTIONS =
  "Use search_content to find pages on vreeman.com — Simon Vreeman's marketing tools and Stoic " +
  "philosophy library. Use search_meditations to quote a specific entry of Marcus Aurelius' " +
  "Meditations; it returns a deep link to each matching entry.";

// DiscoverResult extends CacheableResult, so ttlMs and cacheScope are required. Nothing here is
// user-specific and the tool list is static, so a shared proxy may cache it for anyone; an hour
// matches the edge cache _headers already puts on the corpus.
const DISCOVER_TTL_MS = 3600000;

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
    "and return the matching entries with a deep link. Books only — the Introduction, Notes and " +
    "Index of Persons are not searched. Each hit is a snippet of about 140 characters and at most " +
    "20 are returned per call, so a broad word needs a narrower query; an exact entry number such " +
    "as '4.3' returns that entry's full text instead of a snippet.",
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
// cached in module scope; edge-cached for an hour by _headers. A failed load clears the cache so the
// next request retries, rather than poisoning the isolate for its whole life.
//
// Both checks have to happen INSIDE this chain, so that the .catch below sees them and clears the
// cache. fetch() does not reject on a 404 — Pages would answer one with its HTML error page — so
// without the r.ok check a bad response resolves, gets cached, and every later request fails in
// withLower() instead, telling the client to "try again" when trying again can never help.
const ENTRIES_URL = "https://vreeman.com/meditations/entries.json";
let entriesPromise = null;
const defaultLoadEntries = () =>
  (entriesPromise ??= fetch(ENTRIES_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`entries.json: HTTP ${r.status}`);
      return r.json();
    })
    .then((entries) => {
      if (!Array.isArray(entries)) throw new Error("entries.json: not an array of entries");
      return entries;
    })
    .catch((e) => {
      entriesPromise = null;
      throw e;
    }));

const MAX_RESULTS = 20;

// findMatches/snippet/statusText are imported from meditations/search.js, never copied. `entries`
// arrives rehydrated — see the withLower() call in dispatch().
function searchMeditations(entries, query) {
  const { query: q, matches } = findMatches(entries, query);
  // findMatches() returns no matches below MIN_QUERY without looking at the corpus. The browser
  // renders an empty status line for that; over MCP, saying "no entries match" would be a false
  // negative the agent has no way to doubt.
  if (q.length < MIN_QUERY) {
    return `Queries must be at least ${MIN_QUERY} characters; "${q}" was not searched.`;
  }
  if (!matches.length) return `${statusText(0)} "${q}".`;
  // An exact entry number is a request to READ that entry, not to find it — and `instructions`
  // promises this tool can quote one. A ~140-character window would leave the agent no way to get
  // the rest but to fetch all 210 KB of entries.json (4.3 alone is 2,378 characters). This is the
  // one place the browser's semantics do not transfer: there a snippet is a link you click, here it
  // is the whole answer. The label branch of findMatches() is also the only way a match can carry no
  // occurrence of the query in its text, since the leading "§ 4.3" is stripped at build time.
  const exact = matches.length === 1 && matches[0].label === q;
  const shown = matches.slice(0, MAX_RESULTS);
  // The edition is named per call: it appears in the tool description too, but an agent may not
  // carry that into its answer, and a Meditations quotation is worth attributing correctly.
  const capped =
    matches.length > MAX_RESULTS ? `; showing the first ${MAX_RESULTS} — refine the query for fewer` : "";
  const head = `${statusText(matches.length)} "${q}" (trans. Hays${capped}):`;
  const lines = shown.map((e) => {
    let text = e.text;
    if (!exact) {
      const s = snippet(e, q);
      text = (s.leading ? "…" : "") + s.before + s.hit + s.after + (s.trailing ? "…" : "");
    }
    return `• ${e.label} — ${text} — https://vreeman.com/meditations/#${e.id}`;
  });
  return [head, ...lines].join("\n");
}

// --- JSON-RPC helpers ----------------------------------------------------
// 2026-07-28 requires `resultType` on every result ("Servers implementing this protocol version
// MUST include this field"). Clients on earlier revisions must treat an absent one as "complete"
// and ignore unknown fields, so emitting it unconditionally is correct for both eras.
const ok = (id, result) => ({ jsonrpc: "2.0", id, result: { resultType: "complete", ...result } });
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

  // A modern request names its version in params._meta; `initialize` is the legacy handshake and
  // names it in params.protocolVersion instead, so it is negotiated separately below.
  //
  // An ABSENT version is served rather than rejected. The transport allows exactly that for a
  // server that supports clients older than 2025-06-18 — which never sent a version at all — and we
  // do (2025-03-26, 2024-11-05). A version that IS named and that we do not implement must be
  // refused with -32022 rather than answered under some other revision: the error is what tells the
  // client which versions to retry with.
  if (msg.method !== "initialize") {
    const declared = (params._meta || {})[PROTOCOL_VERSION_META];
    if (declared !== undefined && !SUPPORTED_PROTOCOL_VERSIONS.includes(declared)) {
      return err(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", {
        supported: SUPPORTED_PROTOCOL_VERSIONS,
        requested: declared,
      });
    }
  }

  switch (msg.method) {
    // Mandatory since 2026-07-28 ("Servers MUST implement it"), and the one request a modern client
    // can send before it knows anything about us.
    case "server/discover":
      return ok(id, {
        supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
        capabilities: CAPABILITIES,
        instructions: INSTRUCTIONS,
        ttlMs: DISCOVER_TTL_MS,
        cacheScope: "public",
        _meta: { [SERVER_INFO_META]: SERVER_INFO },
      });
    case "initialize": {
      // Deliberately NOT a delegation to server/discover: the two results are different shapes.
      // DiscoverResult has `supportedVersions` (an array) and hides serverInfo under _meta; the
      // legacy InitializeResult has a single `protocolVersion` and a top-level `serverInfo`.
      //
      // Negotiated against the LEGACY list only. A client that gets here speaks the handshake, and
      // 2026-07-28 is the one revision with no handshake — naming it would have the client stamp
      // MCP-Protocol-Version: 2026-07-28 on legacy-shaped requests. "Another protocol version [we]
      // support" has to mean one this client can actually use.
      const requested = params.protocolVersion;
      const protocolVersion = LEGACY_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : LATEST_LEGACY_PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
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
  // mcp-method and mcp-name are REQUIRED on every 2026-07-28 request. A browser-based client would
  // be stopped at the preflight without them here, whatever dispatch() is willing to answer.
  // mcp-session-id is kept only so a pre-2026 client's preflight still passes; we never read it.
  "access-control-allow-headers":
    "content-type, accept, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, authorization",
  // Neither Deprecation nor Link is CORS-safelisted, so without this a browser-based client is
  // handed the deprecation notice below and cannot read a byte of it — and a browser client is
  // precisely the kind most likely to be modern enough to act on it.
  "access-control-expose-headers": "deprecation, link",
  "access-control-max-age": "86400",
};

const json = (obj, status = 200, extra) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...extra },
  });

// The legacy handshake is deprecated, not scheduled for removal, and these headers say exactly that.
//
// RFC 9745 makes `Deprecation` an Item Structured Field whose value MUST be a Date: an "@" followed
// by a Unix timestamp. The string "true" is not a Date and would simply be discarded as malformed —
// a malformed header being worse than none. This timestamp is 2026-07-28T00:00:00Z, the day the
// handshake-less revision shipped and the handshake became deprecated.
//
// There is deliberately NO `Sunset`. RFC 8594 defines Sunset as the time the resource "will become
// unresponsive", and RFC 9745 requires it to be no earlier than the deprecation date. We have no
// date on which we intend to stop answering `initialize` — the spec schedules no removal for
// dual-era servers — and announcing one we would not honour is worse than staying silent. Add one
// here (an IMF-fixdate, e.g. "Wed, 30 Sep 2027 00:00:00 GMT") if and when removal is actually
// planned, and give legacy clients more notice than the weeks a near date would offer.
const LEGACY_HANDSHAKE_HEADERS = {
  deprecation: "@1785196800",
  link: '<https://modelcontextprotocol.io/specification/2026-07-28>; rel="deprecation"',
};

// The transport pins two statuses to two JSON-RPC error codes. Everything else stays 200 with the
// error in the body, which is what both eras expect.
function httpStatusFor(res) {
  const code = res.error && res.error.code;
  if (code === UNSUPPORTED_PROTOCOL_VERSION) return 400; // modern clients detect a modern server by this
  if (code === -32601) return 404; // "MUST respond with 404 Not Found" for an unimplemented method
  return 200;
}

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

  const res = await dispatch(msg);
  // "Was this the legacy handshake?" is a property of the REQUEST, and the request is right here —
  // so the deprecation headers are derived from msg.method rather than smuggled out of dispatch()
  // on a marker field. That keeps dispatch() a pure message-in/message-out function with one return
  // value, hands callers a response with nothing to strip, and costs no mutation.
  const legacy = msg.method === "initialize";
  return json(res, httpStatusFor(res), legacy ? LEGACY_HANDSHAKE_HEADERS : undefined);
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

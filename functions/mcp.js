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
// The Meditations answer is IMPORTED, not written here: searchMeditations() lives in
// meditations/tool-result.js and is the same function the WebMCP tool on the Meditations page runs,
// over matching logic from meditations/search.js — the module the page's own search box runs. One
// definition of the answer, for two surfaces that advertise one tool name.
// Cloudflare Pages compiles functions/ with esbuild and inlines relative imports, including ones
// reaching above functions/, so this resolves at deploy time; see tools/mcp/README.md. search.js's
// trailing mountSearch(document) is guarded on `typeof document`, so it bundles in as a no-op here.
import { searchMeditations } from "../meditations/tool-result.js";
import { withLower } from "../meditations/search.js";

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
// schema.ts: HeaderMismatchError, raised when a mirrored header contradicts the body.
const HEADER_MISMATCH = -32020;

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

// Caching hints, required on every result with resultType "complete" that comes back from a
// cacheable operation — server/discover and tools/list here. Nothing this endpoint returns is
// user-specific or authenticated and the tool list is static, so a shared proxy may cache it for
// anyone; an hour matches the edge cache _headers already puts on the corpus.
const CACHEABLE_TTL_MS = 3600000;
const CACHE_HINTS = { ttlMs: CACHEABLE_TTL_MS, cacheScope: "public" };

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
        // Every example here is run against this tool by tools/mcp/test/dispatch.test.mjs: an agent
        // copies one verbatim, and 'seneca death' matched nothing (CATALOG is a substring match over
        // one string, so two words only hit if they are adjacent in it).
        description: "Search terms, e.g. 'utm', 'measurement protocol', 'cro', 'seneca', 'epictetus', 'meditations'.",
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

// --- JSON-RPC helpers ----------------------------------------------------
// 2026-07-28 requires `resultType` on every result ("Servers implementing this protocol version
// MUST include this field"). Clients on earlier revisions must treat an absent one as "complete"
// and ignore unknown fields, so emitting it unconditionally is correct for both eras.
// serverInfo is a SHOULD on EVERY response, not just discovery, and every result in this file goes
// through here. The spread order matters: a caller's own _meta keys are merged over the default, so
// adding one later cannot silently drop serverInfo.
const ok = (id, result) => ({
  jsonrpc: "2.0",
  id,
  result: {
    resultType: "complete",
    ...result,
    _meta: { [SERVER_INFO_META]: SERVER_INFO, ...result._meta },
  },
});
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
      // `supported` names legacy revisions a modern client cannot use, which looks odd but is what
      // the spec's own example does: the list is what the SERVER supports, and the client picks the
      // newest it shares. Not a bug; do not "fix" it by filtering.
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
        ...CACHE_HINTS,
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
    // ListToolsResult extends CacheableResult as well: the caching hints are required here, not
    // only on server/discover.
    case "tools/list":
      return ok(id, { tools: [SEARCH_TOOL, MEDITATIONS_TOOL], ...CACHE_HINTS });
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
// Scope caveat: RFC 9745 §2.2 scopes Deprecation to "the resource identified with the response it
// occurred within", so a strict consumer reads this as /mcp being deprecated rather than the
// `initialize` METHOD. There is no header that says "this method". The Link is the RFC-sanctioned
// way to say what is actually meant, so it points at the backward-compatibility section rather than
// the revision index, and the header is sent only on a handshake response.
//
// There is deliberately NO `Sunset`. RFC 8594 defines Sunset as the time the resource "will become
// unresponsive", and RFC 9745 requires it to be no earlier than the deprecation date. We have no
// date on which we intend to stop answering `initialize` — the spec schedules no removal for
// dual-era servers — and announcing one we would not honour is worse than staying silent. Add one
// here (an IMF-fixdate, e.g. "Wed, 30 Sep 2027 00:00:00 GMT") if and when removal is actually
// planned, and give legacy clients more notice than the weeks a near date would offer.
const LEGACY_HANDSHAKE_HEADERS = {
  deprecation: "@1785196800",
  link:
    '<https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning' +
    '#backward-compatibility-with-initialization-based-versions>; rel="deprecation"',
};

// The 2026-07-28 transport pins two statuses to two JSON-RPC error codes. Everything else stays 200
// with the error in the body, which is what both eras expect.
function httpStatusFor(res, modern) {
  const code = res.error && res.error.code;
  // Unconditional: -32022 can only be produced by a request that declared a version, so a client
  // that can see it is modern by construction. A 400 carrying a recognised modern error is also how
  // a dual-era client tells a modern server from a legacy one.
  if (code === UNSUPPORTED_PROTOCOL_VERSION) return 400;
  // Gated, because the MUST lives in the 2026-07-28 binding and governs requests speaking it. A
  // legacy client probing resources/list has always had a 200 with -32601 from this endpoint, and
  // an SDK transport that checks response.ok before parsing would turn a clean "Method not found"
  // into a transport throw. It has no reason to read the body, because its own revision never
  // returned 404 here.
  if (code === -32601 && modern) return 404;
  return 200;
}

// "=?base64?<value>?=" is the sentinel clients must use for a header value that is not plain-ASCII
// safe, and servers MUST decode it before comparing against the body.
function decodeHeaderValue(v) {
  if (!v.startsWith("=?base64?") || !v.endsWith("?=")) return v;
  try {
    const bin = atob(v.slice(9, -2));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return v; // undecodable: compared as-is, so it mismatches and is rejected, which is correct
  }
}

// Streamable HTTP mirrors selected body fields into headers so intermediaries can route without
// parsing the body. A server that reads the body MUST reject any request where the two disagree —
// otherwise a proxy routes on one value while this function answers another. Cloudflare is exactly
// such an intermediary, which is why a read-only anonymous server still owes this check.
//
// DELIBERATELY only the mismatch half. "A required standard header is missing" is also a listed
// validation failure, but those headers are required only from 2026-07-28: enforcing their presence
// would reject every legacy client, which is the opposite of what a dual-era endpoint is for. A
// header that is present and wrong is a broken or hostile client under any revision. For the same
// reason the protocol-version check needs a version in the body to compare against — a legacy
// client sends MCP-Protocol-Version but carries nothing in _meta.
function headerMismatch(request, msg) {
  const header = (n) => request.headers.get(n);
  const params = msg.params || {};
  const declared = (params._meta || {})[PROTOCOL_VERSION_META];
  const version = header("mcp-protocol-version");
  if (version !== null && declared !== undefined && version !== declared) {
    return `MCP-Protocol-Version header value '${version}' does not match body value '${declared}'`;
  }
  const method = header("mcp-method");
  if (method !== null && method !== msg.method) {
    return `Mcp-Method header value '${method}' does not match body value '${msg.method}'`;
  }
  // Mcp-Name mirrors params.name, and only these requests have one to mirror.
  if (msg.method === "tools/call") {
    const name = header("mcp-name");
    if (name !== null) {
      const decoded = decodeHeaderValue(name);
      if (decoded !== params.name) {
        return `Mcp-Name header value '${decoded}' does not match body value '${params.name}'`;
      }
    }
  }
  return null;
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

  const mismatch = headerMismatch(context.request, msg);
  if (mismatch) {
    return json(err(msg.id !== undefined ? msg.id : null, HEADER_MISMATCH, `Header mismatch: ${mismatch}`), 400);
  }

  const res = await dispatch(msg);
  // "Was this the legacy handshake?" is a property of the REQUEST, and the request is right here —
  // so the deprecation headers are derived from msg.method rather than smuggled out of dispatch()
  // on a marker field. That keeps dispatch() a pure message-in/message-out function with one return
  // value, hands callers a response with nothing to strip, and costs no mutation.
  const legacy = msg.method === "initialize";
  const modern = ((msg.params || {})._meta || {})[PROTOCOL_VERSION_META] !== undefined;
  return json(res, httpStatusFor(res, modern), legacy ? LEGACY_HANDSHAKE_HEADERS : undefined);
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

// MCP server for vreeman.com — Cloudflare Pages Function serving https://vreeman.com/mcp
// Stateless JSON-RPC 2.0 over the MCP Streamable HTTP transport (application/json only;
// no SSE, no sessions, no auth — read-only). Spec: https://modelcontextprotocol.io/specification/2025-06-18
//
// Exposes one tool, `search_content`, mirroring the WebMCP tool on the homepage.

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

// --- JSON-RPC helpers ----------------------------------------------------
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

function dispatch(msg) {
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
        instructions: "Use search_content to find pages on vreeman.com — Simon Vreeman's marketing tools and Stoic philosophy library.",
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: [SEARCH_TOOL] });
    case "tools/call": {
      const name = params.name;
      const args = params.arguments || {};
      if (name !== SEARCH_TOOL.name) return err(id, -32602, `Unknown tool: ${name}`);
      const query = args.query;
      if (typeof query !== "string" || query.trim() === "") {
        return ok(id, {
          content: [{ type: "text", text: "The 'query' argument is required (a non-empty search string)." }],
          isError: true,
        });
      }
      return ok(id, { content: [{ type: "text", text: searchContent(query) }], isError: false });
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
  return json(dispatch(msg));
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

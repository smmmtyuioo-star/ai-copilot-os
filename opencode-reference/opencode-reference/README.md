# Upgrading your copilot with OpenCode's architecture

Source: your `opencode-dev.zip` (MIT licensed — safe to reuse). Reference files pulled
into `opencode-reference/` alongside this doc, organized by topic. This covers your
three asks: (1) real shell/code execution that can build and fix a whole SaaS app,
(2) MCP + AI-provider connection via Authorization, (3) why answers might look
"fake" or short and how OpenCode avoids that.

---

## 1. Full agentic shell execution + code editing

**Files:** `shell-and-edit/shell.ts`, `edit.ts`, `write.ts`, `read.ts`, `tool.ts`, `registry.ts`

This is the loop that lets an agent actually build something, not just talk:

- **`registry.ts` / `tool.ts`** — every capability (shell, edit, write, read, glob, grep, lsp,
  webfetch...) is a `Tool` with a JSON-schema input, a `permission` requirement, and an
  `execute()`. The LLM picks tools by name; your copilot's job is just: get a tool call from
  the model → look it up in the registry → run it → feed the result back in the next turn.
- **`shell.ts`** is the interesting one. Before running anything, it parses the command with
  a real bash grammar (**tree-sitter**, not regex) to figure out *which files/paths it touches*
  and *whether it's a pure filesystem op* — that's what feeds a permission check (allow / ask
  the user / deny) instead of blindly executing. This is your natural hook point for something
  like the `command-guard-ts` module from earlier in this conversation — run it here, before
  the shell actually spawns.
- **`edit.ts`** does search-and-replace style patches against real files on disk, then reports
  a diff back to the model so it can see whether its fix worked — that feedback loop (edit →
  re-run tests/build → read errors → edit again) is what makes it capable of actually fixing
  bugs and shipping a working app, not just guessing once.

**Minimum to port:** a tool-call loop (call model → get tool_use → execute → tool_result →
call model again, repeat until no more tool calls) + a `shell` tool that runs in a real
sandboxed subprocess with a working directory + a `edit`/`write` tool for files. Everything
else (tree-sitter parsing, LSP, permission prompts) is polish you can add incrementally.

---

## 2. MCP servers + AI provider connections via Authorization

This is genuinely two separate systems in OpenCode, both worth copying:

### a) MCP server auth — `mcp-auth/`

**Files:** `auth.ts`, `oauth-provider.ts`, `oauth-callback.ts`, `catalog.ts`, `index.ts`

Standard **OAuth 2.0 Authorization Code + PKCE** flow, using the official
`@modelcontextprotocol/sdk`'s `OAuthClientProvider` interface:

1. `oauth-provider.ts` implements 4 methods the MCP SDK calls automatically:
   `clientInformation()` (do we already have a client_id?), `saveClientInformation()`
   (store it after **dynamic client registration**, RFC 7591 — most MCP servers don't need
   you to pre-register an app), `tokens()` (read stored access/refresh tokens),
   `saveTokens()`.
2. `oauth-callback.ts` spins up a tiny local HTTP server on a fixed port
   (`127.0.0.1:19876/mcp/oauth/callback`) to catch the redirect after the user approves
   access in their browser.
3. `auth.ts` is just a per-MCP-server-name JSON store (`mcp-auth.json`, `0o600` permissions)
   holding `{ accessToken, refreshToken, expiresAt, scope }` plus the dynamically-registered
   `clientId`/`clientSecret`.

This is exactly "connect to any MCP server without pre-configuring API keys" — the server
tells you its OAuth endpoints, you register a client dynamically, done.

### b) AI provider connections — `provider-auth/`

**Files:** `core-auth.ts`, `provider-auth.ts`

Different problem: connecting to *AI model providers themselves* (Anthropic, OpenAI, etc.),
which don't all speak MCP. OpenCode's model here:

- `core-auth.ts` stores one of 3 shapes per provider, keyed by provider ID, in `auth.json`:
  `oauth` (access/refresh/expires — e.g. "sign in with your Claude subscription"), `api`
  (a plain API key), or `wellknown` (custom token discovery for enterprise/self-hosted).
- `provider-auth.ts` is **plugin-driven**: each provider is a plugin declaring its own
  `auth.methods` (which can be `oauth` or `api`, with an ordered list of user-facing prompts),
  an `authorize(inputs)` function that returns `{ url, method: "auto"|"code", instructions }`
  to show the user, and a `callback(code)` that exchanges the code for real credentials.

**Why this matters for "connects to whole account access":** adding a new AI provider to
your copilot becomes "write one small plugin implementing 3 functions," not "hardcode a new
branch of if/else auth logic" — and the UI (prompts, auth URL, instructions) is generated
generically from whatever the plugin declares.

**Practical minimum for your copilot:** you probably don't need the full plugin system.
Start with `core-auth.ts`'s 3-shape schema (`oauth` / `api` / `wellknown`) stored in one
JSON file with `0o600` perms, and a `connect(providerId)` function per provider that does
standard OAuth-with-PKCE (same shape as the MCP flow above) or just prompts for an API key.

---

## 3. Why your copilot might be giving "fake"/short answers instead of the real model output

**Files:** `provider-auth/transform.ts`, `truncation/truncate.ts`

Two separate, very common causes — check both:

### a) Response length capped below the model's real limit
`transform.ts`:
```ts
export function maxOutputTokens(model: Provider.Model, outputTokenMax = OUTPUT_TOKEN_MAX): number {
  return Math.min(model.limit.output, outputTokenMax) || outputTokenMax
}
```
OpenCode keeps a **model registry** with each model's real max output tokens (`model.limit.output`,
e.g. Claude Sonnet's actual cap) and uses `min(that, a configurable ceiling)` — never a hardcoded
small number like 1024 or 4096 across every model. If your copilot hardcodes `max_tokens: 1024`
(or similar) for every provider/model, that alone will make Claude/GPT/etc. look like they're
giving short, cut-off, "fake" answers when the raw model would have said more. Fix: look up the
real per-model output limit and pass that through.

### b) Tool output truncation — but done *safely*, not by dropping data
`truncate.ts`: any tool result over `MAX_LINES = 2000` / `MAX_BYTES = 50KB` gets written **in
full** to a local temp file, and only a preview + "see full output at `<path>`" is sent back to
the model. So the model never silently loses information — it can always ask to read the file if
it needs more. If your copilot just does `output.slice(0, N)` and throws the rest away, that's a
second, different source of "it gave a worse answer than the real model would have" — the model
literally never saw the full data. Fix: same pattern — cap what goes into the LLM context, but
persist the untouched full output somewhere the agent can retrieve on demand.

Neither of these is about "faking" a response — they're about not accidentally feeding the real
model less than it should have, or capping its answer shorter than it's capable of. If you're
seeing something that looks more like literal placeholder/mock text (not just short answers),
that'd be a bug in your streaming/response-parsing code silently swallowing the real API
response — worth checking your fetch/stream handler isn't catching an error and falling back
to a canned string.

---

## Suggested build order

1. Tool-call loop + `shell`/`edit`/`write` tools (gets you "can actually build things")
2. Wire in `command-guard-ts` as a pre-execution check inside your shell tool
3. Fix `maxOutputTokens` to use real per-model limits (quick win, fixes "short fake answers")
4. Add the truncate-to-file pattern for large tool outputs
5. MCP OAuth + provider auth (bigger lift — do this once the core loop is solid)

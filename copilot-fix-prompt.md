# Fix prompt for the copilot app — hand this whole doc to your dev agent

You are fixing an AI coding-copilot product. Below are 6 concrete, verifiable problems.
For each one: implement it for real (no stubs, no hardcoded fake data), and the
"Acceptance check" must actually pass by manually testing it, not by assuming the code
compiles. Reference architecture is OpenCode (github.com/sst/opencode, MIT licensed) —
concrete file/pattern names are given where useful.

---

## 1. Show the active model name in the chat UI at all times

**Problem:** the chat never tells the user which model is answering.

**Fix:**
- Add a persistent model indicator (header badge or footer, always visible while a
  conversation is open) showing `provider/model` (e.g. `anthropic/claude-sonnet-4-6`,
  `openai/gpt-5`), sourced from the actual request that was sent, not a hardcoded label.
- When the user or an auto-router switches models mid-conversation, update the badge
  immediately and it should be clickable to open a model picker.
- Reference: OpenCode's `tui/src/util/model.ts` + `tui/src/component/dialog-model.tsx` —
  footer shows current model, clicking opens a selectable dialog of all connected
  providers/models.

**Acceptance check:** open the app, send a message, and read the model name straight off
the UI without opening dev tools or settings. Switch models and confirm the badge updates
on the next message.

---

## 2. MCP servers and plugins must be invoked automatically, not manually toggled

**Problem:** plugins/MCP tools exist but don't get used unless the user does something
special to force them; they should participate in tool selection like any built-in tool.

**Fix:**
- On every user turn, the full list of *currently connected* MCP tools + plugin tools must
  be included in the tools array passed to the model (subject to the model's tool-count
  limits — batch/prioritize if you have many). Don't require the user to "activate" a
  plugin per message.
- If a plugin/MCP server is configured but its OAuth/API key isn't connected yet, don't
  silently drop it — surface a one-time "connect X to use this" prompt the first time the
  model would have wanted it (this requires the model to actually attempt/request it, or
  you infer intent from the user's message and offer the connector — same UX pattern this
  chat uses for MCP Apps: search intent → suggest connector → user picks → call tool).
- Verify each connected MCP server responds correctly to `tools/list` at connection time
  and periodically — if a server returns 0 tools or errors, mark it "unhealthy" in the UI
  instead of pretending it's available.

**Acceptance check:** connect a real MCP server (e.g. a GitHub or filesystem MCP), then in
a fresh chat ask a question that clearly needs that tool ("what are my open GitHub issues")
without mentioning the tool by name — confirm the model calls it without you manually
enabling anything first.

---

## 3. Plugins/MCP are shallow stubs — implement the real protocol, not a fake subset

**Problem:** "it give plugin it have very small plugins directly and waste not real
plugins" / "mcp also looks fake" — this means the current MCP client only implements a
sliver of the spec (probably just a hardcoded tool or two) instead of being a real client.

**Fix — implement a real MCP client:**
- Full JSON-RPC 2.0 transport over both `stdio` and `streamable-http`/`SSE` (most MCP
  servers today are HTTP-based, not just local stdio processes).
- Full handshake: `initialize` → capability negotiation → `tools/list`, `resources/list`,
  `prompts/list` (not just tools — most MCP clients undersell servers by ignoring resources
  and prompts).
- Real OAuth 2.0 + PKCE + dynamic client registration for HTTP MCP servers that require
  auth (see the `mcp-auth/` reference bundle from earlier in this conversation —
  `oauth-provider.ts` implements the exact 4-method interface the official
  `@modelcontextprotocol/sdk` expects: `clientInformation()`, `saveClientInformation()`,
  `tokens()`, `saveTokens()`).
- Actually forward tool call results (including images/resources, not just text) back to
  the model, and handle tool errors as real errors the model sees, not swallowed exceptions.
- Do NOT maintain a hardcoded allowlist of "supported" MCP servers — any spec-compliant MCP
  server URL the user adds should work, because you're speaking the real protocol.

**Acceptance check:** connect three different unrelated MCP servers from different vendors
(no special-casing per-server in your code) and confirm all three list correct tools and
execute correctly.

---

## 4. Live preview when building an app (Bolt/Lovable-style)

**Problem:** when the copilot generates a web app, there's no visual preview — user can't
see what got built.

**Fix:**
- When the project has a runnable dev server (`npm run dev`, `vite`, `next dev`, etc.),
  start it in the sandbox after file changes, capture its port, and reverse-proxy that port
  into an iframe inside the chat UI.
- Auto-detect framework from `package.json` (Next.js, Vite, CRA, etc.) to pick the right
  start command; fall back to asking the user or having the model figure it out from
  `package.json` scripts if detection fails.
- Hot-reload: the iframe should reflect file edits without the user manually refreshing —
  either rely on the framework's own HMR (most have it) or poll for a rebuilt-file signal
  and reload the iframe.
- Show build/runtime errors from the dev server process directly in the UI (not just in a
  hidden log) so both the user and the model (fed back as tool output) can see them.
- This is a genuinely separate system from MCP/tool-calling — it's "run a long-lived
  process, expose its port, embed it." OpenCode doesn't have this (it's a terminal tool,
  not a webapp builder) so there's no reference file to copy; this needs to be built as
  its own service: sandbox process manager → port forwarding → iframe.

**Acceptance check:** ask the copilot to build a simple app ("a todo list app"), and without
you running any command yourself, see a working, interactive preview of it appear in the UI.

---

## 5. The copilot needs an actual "how to build things" plan, not just isolated tool calls

**Problem:** "it don't have design idea how to build anything" — the model is calling
tools but not following a coherent build process (plan → scaffold → implement → run → check
output → fix → repeat).

**Fix — this is a system prompt / orchestration problem, not a tool problem:**
- Give the agent an explicit build loop in its system prompt: understand the request → make
  a short plan (what files, what stack) → scaffold the project → implement → **run it** →
  read the actual output/errors from the run → fix → re-run → only report done once it
  actually ran without errors.
- The model must never claim something works without having executed it in this turn. If a
  build/run step fails, that failure must be fed back as a real tool result and the model
  must react to it before claiming success.
- Give the model a "todo list" tool (mirrors what most of these agents including this one
  use — OpenCode's `tool/todo.ts`) so multi-step builds don't lose track of what's done vs.
  pending, and the user can see progress instead of a black box.

**Acceptance check:** ask for a small full-stack feature (e.g. "add a login form that
posts to `/api/login`"). Confirm the model: plans it, writes the files, actually runs the
app, and if there's a runtime error, you can see it caught and fixed in the same turn rather
than the model just declaring success.

---

## 6. Full MCP tool access should be reachable through one natural-language instruction

**Problem:** "how in opencode it use access run total by one prompt, it needs to understand
all things" — i.e., a single user message like "deploy this to my server and update the
database" should result in the agent chaining multiple tools (shell + MCP + file edits)
on its own, without the user manually invoking each one.

**Fix:** this falls out of #2 and #5 done correctly — if all connected tools are always
available to the model (no manual activation) and the model is running a real
plan → act → observe → repeat loop, then a single instruction naturally results in
multiple chained tool calls. There's no separate "one prompt does everything" feature to
build beyond getting the tool-availability and orchestration loop right.

**Acceptance check:** a single message like "commit my changes and open a PR" should
result in the agent calling `git` (shell) and a GitHub MCP tool, in the correct order, from
one user turn — with no manual tool-enabling step in between.

---

## Priority order
1. Fix #3 (real MCP protocol) — everything else depends on tools actually working
2. Fix #2 (auto-invocation) — useless to have real tools if they're not offered to the model
3. Fix #5 (build/run/fix loop in the system prompt) — this is what makes it feel like a real
   coding agent instead of a chatbot that edits files
4. Fix #1 (model badge) — quick, low-risk UI win
5. Fix #4 (live preview) — biggest net-new engineering effort, do once the core loop is solid
6. #6 falls out of #2 + #5, verify it as a final integration test

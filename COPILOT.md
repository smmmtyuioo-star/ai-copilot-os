# AI Coding Copilot — Master Spec

## 1. Identity & Purpose
You are an AI coding copilot that reads, edits, and runs code on the user's behalf, working from a structured plan through to a verified result — not just generating code blindly. You operate across a backend (execution/reasoning engine) and a frontend (however the user interacts with you: CLI, IDE panel, desktop app, or chat).

## 2. Backend Behavior (Execution Engine)
- **Session & memory**: Persist session state (conversation, file changes, decisions) in local storage (e.g. SQLite) so work can resume across sessions.
- **Tool execution**: Execute file edits, shell commands, and tests through a controlled tool-execution layer — never freeform, unsandboxed shell access.
- **Sandboxing**: Constrain all commands to an OS-level sandboxed process. Isolation should be enforced by the system, not by the model "being careful."
- **Process isolation**: Run inference/execution in a separate process from the core server, so a crash during a task doesn't take down the whole session.
- **Scheduler**: If multiple models or tasks are in flight, manage loading/unloading intelligently — keep "hot" resources warm briefly, evict idle ones.
- **Code understanding**: Integrate LSP (Language Server Protocol) so edits are informed by real types, references, and diagnostics — not just pattern-matching on text.
- **Skill creation**: Support generating new reusable skills/scripts from what's learned mid-task, in addition to manually authored ones.
- **Multi-session / multi-agent**: Allow multiple parallel sessions or agents to work on the same project (or across multiple repos) simultaneously, without stepping on each other.

## 3. Frontend Behavior (User Interaction)
- **Multi-surface**: Decouple the frontend from the backend so the same engine can be reached via CLI, IDE extension, desktop app, or chat interface.
- **Streaming responses**: Stream output as it's generated (word-by-word / diff-by-diff) rather than waiting for the full result.
- **Editor-native feel**: If embedded in an IDE, preserve normal editing muscle memory — file tree, tabs, terminal panel — and add an agent sidebar rather than replacing the environment.

## 4. Workflow — Request to Completion
Follow this staged flow for any non-trivial task, and make each stage visible/reviewable to the user:

1. **Task List** — Break the request into a structured, reviewable plan before writing any code.
2. **Implementation Plan** — State which files will change and the technical approach. This is the main checkpoint for user review before edits happen.
3. **Verification Before Apply** — Before writing any change, verify the plan against the actual codebase: read the files to confirm the plan is correct, check for edge cases, and validate that the approach won't break existing functionality. Do not skip to writing code until this step passes.
4. **Code Diffs** — Make file-by-file changes, shown as diffs, not silent overwrites.
5. **Post-Change Verification** — After each change, re-check: does the code compile? Do tests pass? Is the change actually correct, not just syntactically valid?
6. **Walkthrough** — Summarize what was done after completion.
7. **Combined Re-Test** — Run a full integrated re-test across all changed areas to confirm nothing regressed.

## 5. Permission Model
Support two modes, and let the user choose:
- **Upfront rules mode (default preferred)**: user sets standing permissions once — e.g. "run git freely, ask before touching anything outside /src."
- **Per-action approval mode**: ask before every individual action. Useful for high-stakes or unfamiliar codebases.
- **Autonomy dial**: offer a spectrum from full autopilot → agent-assisted (default, recommended) → review-everything, so the user can adjust risk tolerance per task.

## 6. Safety Net
- **Instant undo/redo**: Every AI-made edit should be revertible/reapplyable immediately, independent of Git.
- **No destructive default**: Never run irreversible commands (force-push, delete, drop) without explicit confirmation, regardless of permission mode.
- **Verify before destructive**: Any command that could cause data loss (delete, drop, force-push, reset) must have a pre-flight verification step that confirms the exact impact before execution.

## 7. Project Context
Read a persistent project-instructions file (e.g. COPILOT.md) at the root of the project for standing rules, conventions, and context — the same pattern as CLAUDE.md / OpenCode.md. Select different underlying prompting/behavior depending on which model provider is configured, so behavior stays consistent even if the backend model changes.

## 8. Model Flexibility
- Allow switching the underlying model mid-session without losing context or restarting the task.
- Support multiple providers/models rather than locking to one.

## 9. Reach
Where relevant, allow the copilot to be reachable from chat platforms (Slack, Discord, etc.), not just the terminal/IDE — useful for status checks and lightweight requests on the go.

## 10. Comprehensive Pre-Apply Verification (Added by User)
Before any change is written to disk:
- Read the target file(s) to confirm the plan matches reality.
- Trace the dependency chain: will this change break anything that imports or depends on the modified code?
- Check for type errors, lint errors, and contract violations before writing, not after.
- If the change involves an API route, verify the route path matches the intended HTTP method and params.
- If the change involves a database query, verify the table/column names exist.
- Only proceed to writing code when all pre-flight checks pass.

## 11. Implementation Status

| # | Feature | File(s) | Status |
|---|---|---|---|
| 1 | Staged workflow pipeline | `src/services/workflow.ts`, `src/components/workflow-bar.tsx` | ✅ Done |
| 2 | Undo/redo safety net | `src/services/undo-redo.ts`, `src/components/undo-redo-toolbar.tsx` | ✅ Done |
| 3 | Permission model (3 modes) | `src/services/permissions.ts`, page.tsx header | ✅ Done |
| 4 | Model flexibility (24 models, 7 providers) | MODEL_TO_PROVIDER in chat route, model dropdown | ✅ Done |
| 5 | URL fetching | `/api/browser/fetch/route.ts` | ✅ Done |
| 6 | API key security | `.env.local`, provider-health map | ✅ Done |
| 7 | Auth callback + reset-password | `/auth/callback`, `/auth/reset-password` | ✅ Done |
| 8 | **Multi-agent orchestration** | `src/services/orchestrator.ts` | ✅ Done — dep graph, parallel sessions, aggregation, auto-skills |
| 9 | **Skill creation (auto-generate mid-task)** | `src/services/skill-registry.ts` | ✅ Done — auto-generate from output, manual create, search, tag inference |
| 10 | **Session persistence (IndexedDB)** | `src/services/session-persistence.ts` | ✅ Done — snapshots, sessions, messages, cross-session resume |
| 11 | **Model scheduler (hot/cold)** | `src/services/model-scheduler.ts` | ✅ Done — TTL eviction, latency tracking, keep-warm API |
| 12 | **Sandboxed OS-level execution** | `src/services/sandbox.ts`, `code-execution.ts` | ✅ Done — command allow/deny rules, path restrictions, dangerous arg detection, timeout enforcement |
| 13 | **LSP-aware editing** | `src/services/lsp.ts`, `src/workers/lsp.worker.ts` | ✅ Done — diagnostics, completions, hover, references, dependency tracing, pre-edit safety check |
| 14 | **Process isolation (Web Workers)** | `src/services/process-isolation.ts`, `public/workers/generic.js` | ✅ Done — worker-per-type, heartbeat monitoring, crash detection + auto-recovery, task queuing |
| 15 | **Multi-platform chat reach** | `src/services/webhook-handler.ts`, `/api/webhook`, `/webhooks` page | ✅ Done — Slack/Discord/generic webhooks, rate limiting, status checks, lightweight queries |
| 16 | **Editor-native shell** | `src/components/editor-shell.tsx`, `/editor` page | ✅ Done — file tree, tabs with modified tracking, embedded terminal, split editor/explorer view |
| 17 | **Multi-surface frontend** | `src/services/api-bridge.ts`, `/api/bridge` | ✅ Done — unified REST API for CLI/IDE/desktop/chat/web, session auth, 4 built-in actions, CLI + VS Code snippets |

# command-guard-ts

A TypeScript port of [destructive_command_guard](https://github.com/) (dcg)'s **pattern database** — no API key, no network calls, works in serverless (Vercel functions, Cloudflare Workers, etc.) or any Node/Bun/Deno runtime.

## What this is

dcg itself is a Rust CLI binary meant for local dev machines — it can't run inside a
serverless function. What *is* portable is its data: ~1,700 regex patterns across 91
packs (git, filesystem, kubernetes, terraform, database, cloud CLIs, package managers,
etc.) that flag destructive shell commands, plus ~835 "safe" patterns that explicitly
allowlist known-safe variants (e.g. `git checkout -b` is safe, `git checkout -- <path>`
is not).

That pattern database was mechanically extracted from dcg's Rust source
(`src/packs/**/*.rs`, via the `destructive_pattern!`/`safe_pattern!` macros) into
[`data/patterns.json`](./data/patterns.json), and JS-regex-incompatible syntax
(Rust's `(?i)`/`(?is:...)` inline flags, POSIX `[:alnum:]` classes) was translated so
every pattern compiles as a native `RegExp`. All 1,689 patterns were verified to compile.

## Usage

```ts
import { evaluateCommand } from "command-guard-ts";

const result = evaluateCommand("git reset --hard origin/main");
// {
//   allowed: false,
//   severity: "Critical",
//   matches: [{ packId: "core.git", patternName: "reset-hard", severity: "Critical", reason: "..." }],
//   ...
// }

if (!result.allowed) {
  // block execution, show result.matches[0].reason to the user/agent
}
```

Restrict to specific packs (e.g. only git + filesystem checks):

```ts
evaluateCommand(cmd, { enabledPackIds: ["core.git", "core.filesystem"] });
```

Run the demo:

```sh
npm install
npm run demo
```

## Where to use it in a copilot

Call `evaluateCommand()` right before you execute any shell command an agent/tool-call
generated (e.g. in your `execute_command` tool handler), and block or ask-for-confirmation
when `result.allowed === false`.

## Known limitations vs. the real dcg engine

dcg's actual Rust engine (`evaluator.rs`, ~thousands of lines) does considerably more
than pattern matching, none of which is reproduced here:

- **Command normalization** — unwraps `sh -c "..."`, `env FOO=bar cmd`, `sudo`, quoting/escaping, etc. before matching.
- **Heredoc / here-string parsing** — inspects `<<EOF ... EOF` bodies.
- **AST-based matching** for some packs (not just regex).
- **Confidence scoring** to reduce false positives.
- **Allowlists** (project/user/system layered config).
- A handful (~11 of 1,700) of patterns had inline source comments that our extractor
  had to strip out of the `reason` text — matching regex itself is unaffected, but a
  couple of `reason` strings may read slightly tersely. Worth a manual glance if you
  rely on exact wording.

For a command like `rm -rf $(cat malicious_file)` piped through several layers of
indirection, this simplified port may miss what the real Rust engine would catch. If
you need that level of rigor, consider running the actual `dcg` binary as a subprocess
on your local dev machine / CI runner (where Rust binaries *can* run) rather than in
a serverless function, and use this TS port only where dcg itself can't run.

## Regenerating patterns.json

If dcg's upstream source changes, re-run `extract_patterns.py` (included in the
conversation this was built from) against a fresh checkout of dcg's `src/packs/`
directory to refresh `data/patterns.json`.

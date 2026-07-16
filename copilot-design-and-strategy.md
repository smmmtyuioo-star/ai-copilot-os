# Designing a copilot interface that feels real, reliable, and worth paying for

Three layers, in the order they actually matter: **(1) does it work without breaking,
(2) does it behave like a thoughtful helper, (3) does it look distinctive.** Most
"looks fake" complaints are actually #1 or #2 wearing a #3 costume — polish can't cover
for a broken tool call or a robotic response. Fix in this order.

---

## 1. Reliability first — "no single error, everything runs smoothly"

This isn't a design task, it's an engineering checklist. Before touching visuals:

- **Every async action has 3 visible states**: loading, success, error. Never a silent
  hang, never a console-only error. If a tool call fails, the chat shows *what* failed and
  *what happens next* (retry / fallback / ask user) — not a spinner that never resolves.
- **Streaming must be resilient to disconnects.** If the network drops mid-response, the
  UI should say so and offer to resume/retry, not leave a half-sentence on screen forever.
- **No dead buttons.** Every clickable thing does something observable within ~200ms
  (even if that's just a loading state). Test this by clicking everything in the app once.
- **Empty states are designed, not blank.** A fresh chat, an empty file tree, zero
  connected plugins — each needs a specific "here's what to do" message, not a blank div.
- **Error messages are specific and actionable**, in the product's voice, never a stack
  trace or "Something went wrong." Say what happened and what the user can do about it.
- **Test the unhappy paths as much as the happy path**: no internet, an MCP server that's
  down, a model that times out, a tool call that returns malformed data. If your only
  testing is "ask it something easy and see if it answers," you will ship a demo, not a
  product.

---

## 2. The interaction philosophy — how to actually help with *any* task

This is the part that's hard to fake with UI polish. Here's the operating model worth
building into your system prompt and orchestration logic:

**Understand before acting, but don't stall.** If a request is ambiguous, pick the most
reasonable interpretation, say what you assumed in one line, and do the work — don't
volley clarifying questions back for things you could reasonably guess. Only actually stop
and ask when guessing wrong would waste real effort or send the whole task in the wrong
direction, and even then, do whatever part you can first.

**Use tools instead of guessing.** If the answer depends on something checkable — current
state of a file, current data, current time, a fact that might have changed — check it. An
agent that answers from stale memory when it could have looked something up erodes trust
fast. This is the single biggest gap between a "chatbot with a nice UI" and a real copilot.

**Be concrete, not generic.** "Here are some ideas for how you might improve this" is
weak. "I changed X to Y because Z, here's the diff" is strong. Prefer doing the work over
describing how the work could be done.

**Finish the loop.** Don't declare something done until it's been verified — run the
tests, load the page, check the output. Half of feeling "worthful" is trustworthiness: if
the copilot says "done," it needs to actually be done.

**Match effort to the task.** A one-line question gets a one-line answer. A "build me an
app" gets a plan, then execution, then a working result. Don't pad simple answers with
unnecessary structure, and don't under-deliver on genuinely complex asks.

**Own mistakes plainly.** When something breaks or a fix doesn't work, say so directly and
move to fixing it — no over-apologizing, no silently pretending it worked.

**Respect the user's time and intelligence.** No filler ("Great question!"), no restating
the request back at them, no explaining things they clearly already know. Lead with the
answer or the action.

If you want this encoded literally: write these as explicit rules in your system prompt,
not vibes. Vague instructions like "be helpful" produce inconsistent behavior; concrete
rules like "never claim a fix worked without re-running the failing check" produce
consistent behavior.

---

## 3. Visual and interaction design

You already have two design-skill toolkits extracted in this conversation
(`ui-ux-skills-bundle.zip`, specifically `ui-ux-pro-max` and `ui-styling`) — use them for
the actual token generation. Key things specific to a **copilot/chat product** on top of
general UI advice:

### Show your work, don't hide it
The single biggest thing that separates a "real" copilot from a toy is **tool-call
transparency**. When the agent runs a shell command, edits a file, or calls an MCP tool,
show it — a collapsed, expandable line like `Ran: npm test — 3 passed` — not just a final
answer that appeared from nowhere. This is also what makes errors debuggable instead of
mysterious, and it's a big part of why tools like this one and OpenCode feel trustworthy:
the user can see the actual command, the actual output, not a paraphrase.

### Model + tool state should always be visible (from the earlier ask)
- Persistent model badge (provider/model name)
- Connected-tools indicator — which MCP servers/plugins are live right now, with a
  healthy/unhealthy state, not just "installed"

### Streaming feels alive, not laggy
- Stream text token-by-token, not paragraph-by-paragraph
- Tool calls interrupt the stream visibly (a distinct block type), then text resumes after
- Use skeleton loaders that match final content shape, not generic spinners, for anything
  that takes >500ms

### Design token process (from the `ui-ux-pro-max` skill)
Run its design-system generator before hand-picking colors:
```
python ui-ux-pro-max/scripts/search.py "AI coding copilot, developer tool" --design-system -p "YourApp"
```
This gives you a reasoned palette/type/layout starting point instead of defaulting to the
generic "cream background + terracotta accent" or "dark + neon" look that immediately
reads as AI-generated. Then apply the `frontend-design` principles: pick **one** signature
visual element (maybe it's the tool-call transcript styling, maybe it's how diffs render)
and keep everything else disciplined around it — don't spread the "distinctive" budget
across five different flourishes.

### Copy is part of the design
- Buttons say what they do: "Run tests," not "Execute"
- Errors explain what happened and what to do, in the product's voice
- The action name stays consistent end-to-end: a button that says "Deploy" should produce
  a status that says "Deployed," not "Published successfully"

---

## Practical next step

Take this doc plus `copilot-fix-prompt.md` from earlier and turn them into your system
prompt + a design brief. The system prompt encodes section 2 (behavior); the design brief
(fed to your dev agent alongside the `ui-ux-pro-max` skill) encodes section 3 (visuals).
Section 1 isn't a prompt problem — it's a "write tests for your unhappy paths" problem, and
no amount of prompting fixes that.

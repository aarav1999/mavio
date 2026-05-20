# Workflow Writeup — Building Mavio with Claude Code

## Methodology: Specs → Skeleton → Slice → Polish

Every feature flowed through four stages, with the AI pair-programmer (Cascade / Claude Code) acting as an executor and reviewer, never the author of intent.

1. **Specs** — Write a short markdown spec first. `docs/CLAUDE.md` for the whole project, `docs/architecture.md` for the system, inline route comments for individual endpoints. The AI loads these on every session so context is durable.
2. **Skeleton** — Stub routes, types, and components. Commit a navigable file structure the AI can reason about. Skeleton commits go in green even if they only `return NextResponse.json({ todo: true })`.
3. **Slice** — Implement one vertical slice end-to-end. Example: "send an email" from button click → optimistic UI → `POST /api/emails/send` → `GmailPlugin.sendEmail` → Gmail API. Verify in the browser with a real account before moving on.
4. **Polish** — Loading states, error toasts, optimistic UI, edge cases. The AI is most useful here because it surfaces states the human forgot.

## Specs-first artifacts

| File | Purpose |
|---|---|
| `docs/CLAUDE.md` | Always-loaded project context (tech stack, scope, working agreement). |
| `docs/architecture.md` | One-page system + data flow + lifecycle. |
| `docs/AGENTS_SKILLS_HOOKS_PLUGINS.md` | The required deliverable — every component listed with its file path and contract. |
| Inline route comments | Each `app/api/.../route.ts` opens with a JSDoc block stating purpose + request/response shape. |

## Multi-agent design — pragmatic, not theatrical

The brief asked for "multi-agent workflow." I treated agents as **specialized prompt-functions** that share a Groq Llama-3 client, not as separate processes with message passing. This is documented as a deliberate tradeoff in `docs/CLAUDE.md` ("Why no LangGraph?").

| Agent | Inputs | Output |
|---|---|---|
| `SummarizerAgent` | subject + body | 2–3 sentence summary |
| `PrioritizerAgent` | subject + from + snippet | score 0–100, label, factors, why-it-matters, urgency |
| `ClassifierAgent` | subject + from + body | one of 6 categories |
| `DrafterAgent` | subject + thread body + optional intent | 3 tone-varied drafts |
| `ValidationAgent` | any AI output | errors + warnings |
| `PatternDetectorAgent` | array of recent emails | cross-email signals |
| `FolderSuggestionAgent` | array of classified emails | bulk-organize actions |

The orchestrator (`lib/orchestrator.ts`) runs Classifier, Summarizer, and Drafter in parallel via Promise.all, then Prioritizer and Validation sequentially, and is wired to `POST /api/ai/analyze`. The lighter `/api/ai/summary` and `/api/ai/reply` routes call agents directly so user-facing latency stays low.

## Skills, hooks, plugins

- **Skills** are pure functions (`extractActions`, `parseEmail`, `detectUrgency`, `generateSummary`, `generateReply`). Anything an agent reuses lives here.
- **Hooks** (`onEmailReceived`, `onAnalysisComplete`, `onReplyGenerated`, `useKeyboardShortcuts`) are instrumentation seams — lifecycle hooks are `console.log` today, the integration point for future side-effects (push notifications, webhooks, audit log). `useKeyboardShortcuts` is a React hook for keyboard navigation. Documenting them as instrumentation is honest; calling them an event bus would not be.
- **Plugins** are `EmailProvider` implementations: `GmailPlugin` (googleapis), `OutlookPlugin` (Microsoft Graph), `ImapPlugin` (imapflow + nodemailer + mailparser). All three are real and in production use; the plugin classes wrap the concrete providers in `lib/providers/` and add metadata for the Agent OS registry.

## Test discipline

- **Unit tests** mock `groq-sdk` at the module level — tests never hit the network. 15 test files across multiple suites: `agents/__tests__/`, `skills/__tests__/`, `lib/__tests__/`, `lib/providers/__tests__/`.
- **Encryption** is tested for round-trip, IV tampering, tag tampering, empty strings, and special characters.
- **Orchestrator** is covered by a fully-mocked test that asserts every agent gets called once and every hook fires the right number of times.
- **CI** runs lint + `tsc --noEmit` + `npm test` on every push and PR — see `.github/workflows/ci.yml`.

## Claude Code discipline applied

1. **Specs before code.** No code lands without a one-paragraph "why" somewhere it'll be loaded next session.
2. **Tight feedback loops.** Each slice is verified in a real browser with a real provider before moving on.
3. **Single source of truth per concern.** AI prompts live in `agents/` or `lib/ai/gemini.ts`. Provider I/O lives in `lib/providers/`. There is one orchestrator. Don't fork.
4. **No premature abstraction.** No event bus, no message queue, no state machine, no LangGraph, no microservices. When those things become justified (multi-step research, distributed teams), the architecture has clean seams to add them.
5. **Honest documentation.** If something is "DB-side because IMAP folder semantics vary," that goes in the source and in `docs/`. No aspirational claims. Semantic search has graceful fallback to keyword search when embeddings unavailable (aiEmbedding column disabled).

## What I'd do next

- Streaming AI responses through Server-Sent Events end-to-end (the `streamSummary` skeleton exists in `lib/ai/groq.ts`).
- Real conversation threading (group emails by `threadId` in the inbox view).
- Full IndexedDB offline sync for the PWA.
- A skill registry the LLM can call as tools, instead of fixed orchestrator chains.
- Push notifications via Web Push for high-priority messages.

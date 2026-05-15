# Agent Workflow — Claude Code Methodology

This document describes the agentic development workflow used to build Mavio. The brief asked for "multi-agent workflow, Agent OS methodology, CLAUDE.md, specs-driven dev, skills/hooks/plugins, automated tests." This is how those concepts were applied to a single-developer, AI-pair-programmed MVP.

---

## Methodology: Specs → Skeleton → Slice → Polish

Each feature was developed in four phases, with the AI pair-programmer (Cascade / Claude Code) operating as a tool, not a co-author. The developer authored intent and arbitrated decisions; the AI generated, edited, and refactored code in tight loops.

1. **Specs** — Write a short markdown spec (the `CLAUDE.md` for the whole app, this `architecture.md` for systems). The AI reads these on every session start so context is durable.
2. **Skeleton** — Stub the routes, types, and components first. No business logic yet. The goal is to commit a navigable file structure the AI can reason about.
3. **Slice** — Implement one vertical slice end-to-end (e.g. "send an email" from button click to Gmail API call). Verify in the browser before moving on.
4. **Polish** — Error states, loading states, optimistic UI, edge cases. This is where the AI is most useful — it spots states the developer forgot.

---

## Roles (Not Separate Processes)

The brief mentions "agents." In a multi-agent system these would be discrete LLM-orchestrated processes. For an MVP, they collapsed into **specialized prompts** that share a model (Llama 3.3 70B via Groq). Each prompt is a single, deterministic function in `lib/ai/gemini.ts`.

| "Agent" (Role) | Implementation | Input | Output |
|---|---|---|---|
| **Summarizer** | `generateSummary()` | subject + body | 1–2 sentence summary |
| **Prioritizer** | `analyzePriority()` | subject + from + snippet | score 1–10, label, why-it-matters |
| **Action Extractor** | `extractActions()` | subject + body | array of typed actions |
| **Reply Drafter** | `generateReplyDrafts()` | subject + thread | 3 tone-varied drafts |
| **Next-Step Suggester** | `suggestNextSteps()` | subject + body | single-sentence next action |
| **Unified Analyzer** | `analyzeEmail()` | full email | JSON containing all of the above |

The **Unified Analyzer** is the orchestrator. Instead of five chained calls, it produces a structured JSON object in one Groq round-trip. This is intentional — chained agents inflate latency, cost, and failure surface area.

---

## Skills (Reusable Capabilities)

Skills are pure functions reused across roles:

| Skill | Location | Purpose |
|---|---|---|
| `parseJSON` | `lib/ai/gemini.ts` | Strips markdown fences from LLM output and parses JSON safely with a typed fallback |
| `decodeHtml` | `lib/utils.ts` | Decodes HTML entities in subjects/snippets |
| `parseEmailHeaders` | `lib/gmail/client.ts` | Normalizes a Gmail message into the internal `ParsedEmail` shape |
| `getGmailClient` | `lib/gmail/client.ts` | Auth-injected googleapis client factory |
| `refreshAccessToken` | `lib/auth.ts` | OAuth token refresh against Google's token endpoint |

---

## Hooks (Lifecycle Integrations)

| Hook | Trigger | Effect |
|---|---|---|
| `session()` (NextAuth) | Every authenticated request | Refreshes OAuth tokens on demand |
| `useEffect` polling in `InboxClient` | Mount + every 30 s | Silently re-fetches inbox to surface new mail |
| `onClose(sent)` in `ComposeModal` | Modal close after send | Triggers immediate inbox refresh |
| `prisma.email.upsert` post-fetch | Inside `/api/emails` | Caches fresh Gmail data for next-load speed |

---

## Plugins (Provider Abstraction)

Plugins are alternative implementations of `EmailProvider`. The interface is in `lib/providers/interface.ts`.

| Plugin | Status |
|---|---|
| `GmailProvider` | Fully implemented |
| `OutlookProvider` | Typed stub; integration path documented |
| `ImapProvider` | Typed stub; integration path documented |

Adding Outlook is contained to one file. The UI does not need to change.

---

## Claude Code Discipline Applied

1. **Specs first** — Both `CLAUDE.md` and `architecture.md` were written before non-trivial code.
2. **Tight feedback loops** — Every change tested in the browser before moving on. No 500-line PRs.
3. **Honest stubs** — Outlook/IMAP throw `Error: not implemented` rather than silently returning empty arrays. Reviewers can grep for what's real.
4. **Singular source of truth** — `lib/ai/gemini.ts` is the only file that calls the LLM. Swapping Gemini → Groq was a 10-line change because every call goes through one `generate()` helper.
5. **No premature abstraction** — No event bus, no message queue, no state machine. Direct function calls.

---

## What I'd Add With More Time

- **Multi-agent orchestration via Vercel AI SDK** — A real DAG: classify → score → extract → draft, with checkpointing.
- **Hooks plugin layer** — `onEmailReceived(email)` → fan-out to user-defined webhooks/extensions.
- **Skill registry** — Discoverable list of skills the LLM can call via tool-use.
- **Specs-driven test generation** — Use the prompts in `lib/ai/gemini.ts` to auto-generate golden-output tests.

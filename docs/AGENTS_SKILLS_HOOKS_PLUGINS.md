# Agents, Skills, Hooks, and Plugins

The required deliverable: every Agent OS component with its file path, inputs/outputs, and current status.

All seven agents share a single `Groq` client via `getGroqClient()` from `lib/ai/groq.ts` and live in `agents/`. All paths below are relative to the repo root.

---

## Agents (7)

### 1. `SummarizerAgent` — `agents/summarizer-agent.ts`
- **Purpose:** 2–3 sentence executive-style summary.
- **Input:** `subject: string`, `body: string`.
- **Output:** `string`.
- **Notes:** Short-circuits corrupted/empty content (`< 50 chars`, `[REDACTED]`, etc.) with a fixed fallback message — no Groq call.
- **Tests:** `agents/__tests__/summarizer-agent.test.ts`.

### 2. `PrioritizerAgent` — `agents/prioritizer-agent.ts`
- **Purpose:** Weighted-signal priority scoring with explainable factors.
- **Input:** `subject`, `fromEmail`, `snippet`.
- **Output:**
  ```ts
  { score: 0-100; label: 'urgent'|'important'|'normal'|'low';
    whyItMatters: string; urgency: string; factors: string[]; }
  ```
- **Notes:** Score thresholds are enforced server-side (`>=90 urgent`, `>=60 important`, `>=30 normal`, else `low`) so the label can never disagree with the score even if the model says otherwise. Also exposes `assessConfidence(subject, body)` returning `'high'|'medium'|'low'` based on heuristics.
- **Tests:** `agents/__tests__/prioritizer-agent.test.ts` (covers label override + JSON fallback).

### 3. `ClassifierAgent` — `agents/classifier-agent.ts`
- **Purpose:** Single-word category.
- **Input:** `subject`, `fromEmail`, `body`.
- **Output:** `'work'|'personal'|'promotions'|'social'|'spam'|'system'`.
- **Notes:** Falls back to `'work'` if the model returns garbage. Corrupted/technical emails are explicitly classified as `'system'` rather than `'spam'`.
- **Tests:** `agents/__tests__/classifier-agent.test.ts`.

### 4. `DrafterAgent` — `agents/drafter-agent.ts`
- **Purpose:** 3 tone-varied reply drafts in one Groq call.
- **Input:** `subject`, `threadBody`, optional `userIntent`.
- **Output:** `[{tone, subject, body}]` × 3 (professional / friendly / concise).
- **Notes:** JSON parse is wrapped in a try/catch with three fallback canned drafts.
- **Tests:** `agents/__tests__/drafter-agent.test.ts` (covers both happy path and malformed-JSON fallback).

### 5. `ValidationAgent` — `agents/validation-agent.ts`
- **Purpose:** Lightweight validator for AI output. No Groq call.
- **Input:** Any object with optional `subject`, `body`, `priorityScore`.
- **Output:** `{ isValid, errors, warnings }`.
- **Checks:** Type checks, placeholder text (`[Company Name]`, `[Job Title]`), suspiciously short body, priority score range.
- **Tests:** `agents/__tests__/validation-agent.test.ts`.

### 6. `PatternDetectorAgent` — `agents/pattern-detector-agent.ts`
- **Purpose:** Cross-email signals across the recent inbox.
- **Input:** `Array<{subject, fromEmail, body, receivedAt}>`.
- **Output:** `Pattern[]` with `type` ∈ `{customer_mentions, unreplied_urgent, team_volume, recurring_topic, deadline_cluster}`, `description`, `count`, `severity`.
- **Endpoint:** `POST /api/ai/patterns`.

### 7. `FolderSuggestionAgent` — `agents/folder-suggestion-agent.ts`
- **Purpose:** Bulk-organize suggestions.
- **Input:** Array of classified emails.
- **Output:** `FolderSuggestion[]` with `action` ∈ `{move_to_folder, label_as, archive, mark_read}`, `target`, `emailIds`, `reason`, `count`.
- **Endpoint:** `POST /api/ai/folder-suggestions`.

---

## Skills (5)

Skills are pure functions reused across agents and routes. They live in `skills/`.

| Skill | File | Purpose |
|---|---|---|
| `extractActions` | `skills/extract-actions.ts` | Typed action items from a single email body. |
| `parseEmail` | `skills/parse-email.ts` | Gmail message → internal `ParsedEmail` shape (subject, from name/email, body HTML/plain, labels, read/star flags, receivedAt). |
| `detectUrgency` + `calculateUrgencyScore` | `skills/detect-urgency.ts` | 18 regex-based urgency signals with weights; tested. |
| `generateSummary` | `skills/generate-summary.ts` | Thin wrapper around the SummarizerAgent prompt; handy for places that want raw skill access without agent metadata. |
| `generateReply` | `skills/generate-reply.ts` | Same idea for DrafterAgent. |

Tests: `skills/__tests__/detect-urgency.test.ts`. The other skills are exercised through agent tests and route tests.

---

## Hooks (4)

Hooks are simple async functions in `hooks/`. Today lifecycle hooks implement **instrumentation** (console log + optional callback). They are deliberately not an event bus — that would be over-engineering at MVP scope. Their value is providing a stable seam for future integrations (push notifications, audit log, webhooks).

| Hook | File | Trigger | Today | Future seam |
|---|---|---|---|---|
| `onEmailReceived` | `hooks/on-email-received.ts` | Inside the orchestrator before agents run | `console.log` + callback | Webhook fan-out, anti-spam pre-filter |
| `onAnalysisComplete` | `hooks/on-analysis-complete.ts` | After all agents finish in `processEmail` | `console.log` + callback | Push notification on `urgent` label, audit log |
| `onReplyGenerated` | `hooks/on-reply-generated.ts` | Once per drafted reply | `console.log` + callback | Reply analytics, learning loop |

Plus one UI hook: `lib/hooks/useKeyboardShortcuts.ts` — registers j/k navigation, `e` archive, `r` reply, `c` compose, `?` help, `s` star, `del` delete. Wired in `components/inbox/InboxClient.tsx`.

---

## Plugins (3)

All three plugins are **real, working, and used in production routes**. They live in `plugins/` and `implements EmailProvider` (interface in `lib/providers/interface.ts`). The plugin classes wrap concrete provider implementations in `lib/providers/` and add metadata for uniform listing.

### `GmailPlugin` — `plugins/gmail-plugin.ts`
- **Auth:** Google OAuth (refresh tokens stored in `Account` row).
- **API:** `googleapis` (Gmail v1).
- **Capabilities:** `listThreads`, `getThread`, `sendEmail`, `archive`, `markRead/Unread`, `star/unstar`, `trash`, `searchEmails`, plus a `parseEmailHeaders` helper.
- **Used by:** `app/api/emails/route.ts`, `app/api/emails/[id]/route.ts`, `app/api/emails/send/route.ts`, `app/api/emails/search/route.ts`.

### `OutlookPlugin` — `plugins/outlook-plugin.ts`
- **Implementation:** Wraps `OutlookProvider` from `lib/providers/outlook.ts`.
- **Auth:** Azure AD OAuth (refresh tokens stored in `Account` row, custom adapter strips `ext_expires_in`).
- **API:** Microsoft Graph v1 — `/me/mailFolders/inbox/messages`, `/me/sendMail`, `$search=`, flag/move/PATCH endpoints.
- **Capabilities:** Same `EmailProvider` contract as Gmail. Star/unstar use Graph's `flag.flagStatus`; archive resolves the user's Archive folder ID first.
- **Used by:** Same routes as Gmail (provider switch on `Account.provider === 'azure-ad'`).

### `ImapPlugin` — `plugins/imap-plugin.ts`
- **Implementation:** Wraps `ImapProvider` from `lib/providers/imap.ts`.
- **Auth:** Username + password. Passwords are encrypted at rest with AES-256-GCM (`lib/encryption.ts`); ciphertext + IV + tag stored on `Account`.
- **Library stack:** `imapflow` for IMAP, `nodemailer` for SMTP send, `mailparser` for body parsing.
- **Capabilities:**
  - `listThreads` returns envelope-only data for fast initial sync.
  - `getThread` fetches full source on demand and parses with `mailparser`.
  - `sendEmail` uses SMTP via `nodemailer`.
  - `markRead`/`markUnread` flip the `\Seen` flag.
  - **`archive`, `trash`, `star`, `searchEmails` throw at the IMAP layer by design.** IMAP folder semantics vary too widely across servers (Yahoo "Archive" vs. Gmail "[Gmail]/All Mail" vs. custom). For MVP these are handled DB-side: archive/trash flip a boolean on the `Email` row; search runs against the normalized DB; starring is DB-side only. This tradeoff is documented inline at `lib/providers/imap.ts:296-318`.
- **Convenience constructors:** `ImapPlugin.fromPreset('yahoo'|'aol'|'icloud'|'gmail'|'zoho', user, password)` and `ImapPlugin.fromCustom(config)`.
- **Used by:** `app/api/accounts/imap/route.ts` (onboarding), `app/api/emails/route.ts` (DB-first read).

---

## Orchestrator

`lib/orchestrator.ts`

```ts
processEmail(email) →
  onEmailReceived → [ClassifierAgent, SummarizerAgent, DrafterAgent] (parallel)
                  → PrioritizerAgent → assessConfidence → ValidationAgent
                  → onAnalysisComplete → onReplyGenerated × 3
```

`processEmailPartial(email, options)` runs only the agents listed in `options`. Both functions are covered by `lib/__tests__/orchestrator.test.ts` with all agents + all hooks mocked.

Wired to **`POST /api/ai/analyze`**. The narrower routes `/api/ai/summary` and `/api/ai/reply` call individual agents directly to keep on-demand UX latency low.

The `/api/ai/analyze` route is rate-limited via `lib/quota-guard.ts` (per-user, per-day cap, default 200; tested at `lib/__tests__/quota-guard.test.ts`). Hitting the cap returns `429` with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers.

---

## How everything fits together

```
GET /api/emails              →  Plugin.listThreads + Plugin.getThread → upsert Email rows
POST /api/ai/summary          →  Summarizer + Prioritizer + Classifier + actions → cache to Email.ai*
POST /api/ai/reply            →  DrafterAgent
POST /api/ai/analyze          →  Orchestrator (full pipeline) → cache to Email.ai*
POST /api/ai/patterns         →  PatternDetectorAgent
POST /api/ai/folder-suggestions →  FolderSuggestionAgent
POST /api/emails/send         →  Plugin.sendEmail
POST /api/emails/semantic-search →  pgvector cosine sim against Email embeddings (graceful fallback to keyword search when column unavailable)
```

## Counts

- Agents: **7**
- Skills: **5**
- Hooks: **4** (3 lifecycle + 1 UI keyboard hook)
- Plugins: **3**, all `implements EmailProvider`, all in production use

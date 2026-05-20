# CLAUDE.md — Mavio AI Email Client

> Persistent context for the AI pair-programmer working on this repo. Keep this short, accurate, and free of aspirational claims.

## What this project is

Mavio is an **AI-first email client** built as a mobile-ready PWA. Single Next.js 15 fullstack deployment to Vercel. Email only — no contacts, tasks, notes, or calendar.

The repo was built in a Claude Code / Cascade pair-programming workflow with explicit **specs-first** documentation, multi-agent AI design, and reusable skills/hooks/plugins.

## Repo layout (single source of truth)

```
.
├── README.md                       — top-level summary + live URL
├── docs/                           — design + reviewer-facing docs
│   ├── CLAUDE.md                   — this file
│   ├── architecture.md             — one-page architecture
│   ├── agent-workflow.md           — short workflow writeup
│   └── AGENTS_SKILLS_HOOKS_PLUGINS.md — list of agents/skills/hooks/plugins
├── .github/workflows/ci.yml        — lint + typecheck + unit tests
├── app/                            — App Router pages and route handlers
│   └── api/
│       ├── auth/                   — OAuth callbacks, login, session
│       ├── emails/                 — list / get / send / search / semantic-search
│       ├── ai/                     — summary / reply / analyze / patterns / folder-suggestions
│       └── accounts/               — IMAP CRUD + validation
├── agents/                         — 7 AI agents (one Groq prompt each)
├── skills/                         — 5 reusable pure functions
├── hooks/                          — lifecycle hooks (instrumentation today)
├── plugins/                        — 3 EmailProvider plugins (Gmail / Outlook / IMAP)
├── components/                     — React UI (inbox, ai panel, compose, layout)
├── lib/
│   ├── ai/                         — groq.ts (singleton client + AI helpers) + embeddings.ts
│   ├── providers/                  — concrete EmailProvider implementations
│   ├── orchestrator.ts             — multi-agent runner used by /api/ai/analyze
│   ├── oauth.ts, encryption.ts, db.ts, …
└── prisma/schema.prisma            — Postgres + pgvector
```

This is a single Next.js 15 fullstack deployment. No FastAPI backend, no microservices.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Fullstack in one repo, Vercel-native |
| Language | TypeScript (strict) | Type safety end-to-end |
| Auth | Custom JWT session in `lib/oauth.ts` + Google OAuth + Azure AD | Refresh-token rotation in DB |
| DB | Postgres on Neon + Prisma + pgvector | Generous free tier, vector search |
| AI | Groq SDK → `llama-3.3-70b-versatile` | 14,400 free req/day, <500 ms |
| Embeddings | Hugging Face Inference API (`all-MiniLM-L6-v2`) | Free tier, 384-dim vectors |
| Email APIs | googleapis (Gmail), Microsoft Graph (Outlook), imapflow + nodemailer + mailparser (IMAP) | All three real |
| UI | Tailwind + Radix UI + Lucide icons | Accessible primitives, no CSS bloat |
| PWA | next-pwa + manifest | Installable on mobile |
| Deployment | Vercel | Zero-config |

## Provider matrix — what is *actually* implemented

| Provider | OAuth / Auth | Read | Send | Archive / Star / Trash / Read-flag | Search | Status |
|---|---|---|---|---|---|---|
| **Gmail** | Google OAuth, refresh-token rotation | yes | yes | yes (Gmail labels) | server-side `q=` | full |
| **Outlook / Office 365** | Azure AD OAuth, refresh-token rotation | yes | yes | yes (Graph folders) | `$search=` | full |
| **IMAP (Yahoo, AOL, iCloud, custom)** | Encrypted password (AES-256-GCM) | yes (envelope-fast + body on demand) | yes (SMTP via nodemailer) | read/unread via `\Seen`; archive/star/trash handled DB-side | DB-side full-text | full enough for MVP — see `lib/providers/imap.ts:296-318` for the documented limitations |

The plugin classes in `plugins/` are thin wrappers over the implementations in `lib/providers/` and exist so the Agent OS plugin registry can list/describe them uniformly.

## Agent OS components

This is **pragmatic Agent OS**, not chained-LLM multi-agent. Agents are specialized functions that share the same Groq client; they're called sequentially by `lib/orchestrator.ts` from `POST /api/ai/analyze`.

**Agents (7)** in `agents/`:
1. `SummarizerAgent` — 2-3 sentence executive summary
2. `PrioritizerAgent` — weighted-signal score (0-100) + label + factors + confidence
3. `ClassifierAgent` — work / personal / promotions / social / spam / system
4. `DrafterAgent` — 3 reply drafts (professional / friendly / concise)
5. `ValidationAgent` — checks AI output for hallucinations / placeholder text
6. `PatternDetectorAgent` — cross-email signals (recurring senders, deadline clusters, etc.)
7. `FolderSuggestionAgent` — bulk-organize suggestions (move, label, archive, mark read)

**Skills (5)** in `skills/`:
- `extractActions` — typed action items from a single email
- `parseEmail` — Gmail message → internal `ParsedEmail` shape
- `detectUrgency` — regex-based urgency signals + `calculateUrgencyScore`
- `generateSummary`, `generateReply` — wrappers used by their respective agents

**Hooks (4)** in `hooks/`:
- `onEmailReceived`, `onAnalysisComplete`, `onReplyGenerated` — lifecycle hooks
- `useKeyboardShortcuts` — UI keyboard hook for j/k navigation, e archive, r reply, c compose, s star, ? help
- Today lifecycle hooks are **instrumentation hooks** (console logging + optional callback). Documented as the integration seam for future side-effects (notifications, webhooks).

**Plugins (3)** in `plugins/`:
- `GmailPlugin`, `OutlookPlugin`, `ImapPlugin` — all `implements EmailProvider`

**Orchestrator** in `lib/orchestrator.ts`:
- `processEmail()` runs Classifier, Summarizer, and Drafter in parallel (no inter-dependencies), then runs Prioritizer and Validation sequentially.
- Wired to `POST /api/ai/analyze`. Lighter routes (`/api/ai/summary`, `/api/ai/reply`) call individual agents directly.

## Architectural decisions, with rationale

| Decision | Rationale |
|---|---|
| **Monolithic Next.js** instead of microservices | Single dev, fast iteration, no service mesh. Everything in one repo. |
| **Sequential agents** instead of LangGraph | All operations are single-pass; chained agents would inflate latency and cost without value. |
| **On-demand AI** instead of background analysis | Free Groq quota (14.4k/day) burns out in minutes if every inbox email auto-analyzes. Users click "Generate"; results cache to `Email.aiSummary` etc. |
| **Cache-first DB** | Gmail / Graph / IMAP fetch → upsert into `Email` rows → UI reads from DB. Polling refreshes silently every 30 s. |
| **DB-side IMAP triage** | IMAP folder semantics vary by server (Gmail vs Yahoo vs custom). Archive/trash flips a boolean in the DB instead of moving messages. Documented in `lib/providers/imap.ts`. |
| **AES-256-GCM for IMAP passwords** | `lib/encryption.ts` with 12-byte IV + 16-byte auth tag. Tested for tag/IV tampering. |
| **Semantic search with fallback** | pgvector extension enabled, but `aiEmbedding` column commented out. Search route attempts pgvector first, falls back to case-insensitive keyword search if unavailable. Response includes `method` field indicating which path executed. Defensive engineering for MVP. |

## Performance & quotas

- **Groq Llama 3.3 70B** — 30 RPM, 14,400 RPD. Mitigated by on-demand AI + DB cache + per-user daily quota guard (`lib/quota-guard.ts`, default 200/user/day, returns `429` with `Retry-After`).
- **Hugging Face inference** — free tier; embeddings API exists but not wired to email ingestion. Search route falls back to keyword search when embeddings unavailable.
- **Gmail API** — 10,000 quota units/day. Mitigated by cache-first.
- **Microsoft Graph** — generous personal-account tier; cache-first.
- **Inbox polling** — 30 s background poll; immediate refresh after compose.

## Security

- OAuth tokens stored only in the DB `Account` row, refreshed in the session middleware in `lib/oauth.ts`.
- IMAP passwords encrypted with AES-256-GCM (`lib/encryption.ts`); ciphertext + IV + tag persisted, key from `ENCRYPTION_KEY` env (64 hex chars).
- Every API route guards on `getSessionFromRequest`.
- Prisma parameterized queries; React auto-escapes JSX.
- TLS to Neon enforced (`sslmode=require`).

## Test posture

- **Jest unit tests** — agents (mocked Groq), skills, encryption (incl. tag/IV tamper tests), orchestrator (full mock), provider factory, IMAP, utils. **15 test files across multiple suites.**
- **Type-check** — `npx tsc --noEmit` passes.
- **CI** — `.github/workflows/ci.yml` runs `prisma generate`, `npm run lint`, `tsc --noEmit`, `npm test` on push and PR.

## Scope honestly stated

**In scope and working:**
Unified inbox across Gmail/Outlook/IMAP, account switching, compose / reply / forward / search, archive / delete / star / mark read, AI summary, AI priority with explainable factors, 3-tone reply drafts, classification, pattern detection, folder suggestions, keyboard shortcuts, onboarding flow, encrypted IMAP credentials, PWA manifest, mobile-responsive UI with navigation drawer.

**Partially implemented / MVP tradeoffs:**
- Semantic search has graceful fallback to keyword search when embeddings column unavailable (pgvector extension enabled, but `aiEmbedding` column commented out in schema)
- IMAP archive/trash/star are DB-side only (not at IMAP protocol layer — see `lib/providers/imap.ts`)

**Deferred / out of scope:**
- Conversation threading (each thread renders as the first message)
- Message-level offline sync (PWA shell only)
- Push notifications (30 s polling instead)
- Advanced label management
- Analytics dashboard

## How to run

```bash
npm install
cp .env.example .env.local
npx prisma generate
npx prisma db push
npm run dev          # http://localhost:3000
```

Required env vars: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `AZURE_AD_CLIENT_ID`/`AZURE_AD_CLIENT_SECRET`/`AZURE_AD_TENANT_ID`, `GROQ_API_KEY`, `HF_API_KEY`, `DATABASE_URL`/`DIRECT_URL`, `ENCRYPTION_KEY`. Full list in `.env.example`.

## Working agreement for the AI pair-programmer

1. **No aspirational docs.** If a feature isn't implemented, do not claim it is.
2. **Specs first.** Update this file when architecture changes.
3. **Single source of truth.** AI calls go through `lib/ai/groq.ts` or one of the seven agents. Don't fork prompts elsewhere.
4. **Provider abstraction.** New email providers implement `EmailProvider` from `lib/providers/interface.ts`.
5. **Test discipline.** Mock Groq in unit tests; never let tests hit the network. Don't pin tests to exact prompt strings.
6. **Hooks are instrumentation.** They log today; they're the seam for future side-effects.

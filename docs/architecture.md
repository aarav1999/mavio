# Architecture — Mavio (one page)

```
                          Browser / installable PWA
                                    │
                                    │ HTTPS
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │                Next.js 15 on Vercel                     │
        │                                                         │
        │  React UI (App Router)                                  │
        │   InboxClient · EmailDetail · AIPanel · ComposeModal    │
        │   AccountSwitcher · PatternPanel · FolderSuggestions    │
        │                          │                              │
        │                          ▼  fetch('/api/...')           │
        │  Route Handlers (server)                                │
        │   /api/auth/[...nextauth]                               │
        │   /api/emails  /api/emails/[id]  /api/emails/send       │
        │   /api/emails/search    /api/emails/semantic-search     │
        │   /api/ai/summary  /api/ai/reply  /api/ai/analyze       │
        │   /api/ai/patterns  /api/ai/folder-suggestions          │
        │   /api/accounts  /api/accounts/imap                     │
        │                          │                              │
        │                          ▼                              │
        │   Agent OS layer                                        │
        │   ┌──────────┐  ┌──────────┐  ┌──────────┐ ┌─────────┐  │
        │   │ agents/  │  │ skills/  │  │  hooks/  │ │ plugins/│  │
        │   │ 7 agents │  │ 5 utils  │  │ 3 hooks  │ │ 3 plugs │  │
        │   └────┬─────┘  └────┬─────┘  └────┬─────┘ └────┬────┘  │
        │        │             │             │            │        │
        │        ▼             ▼             ▼            ▼        │
        │   lib/orchestrator.ts ─── lib/providers/{gmail,outlook,imap}.ts │
        │        │             │                                   │
        │        ▼             ▼                                   │
        │   lib/ai/gemini.ts   lib/ai/embeddings.ts                │
        │        │             │                                   │
        └────────┼─────────────┼───────────────────────────────────┘
                 │             │
                 ▼             ▼               (parallel external APIs)
            ┌─────────┐   ┌──────────┐   ┌──────────┐  ┌──────────┐  ┌──────┐
            │  Groq   │   │  HF      │   │  Gmail   │  │   MS     │  │ IMAP │
            │ Llama-3 │   │ Inference│   │  v1 API  │  │  Graph   │  │/SMTP │
            └─────────┘   └──────────┘   └──────────┘  └──────────┘  └──────┘

                                    │
                                    ▼
                          ┌──────────────────┐
                          │  Neon Postgres   │
                          │  + pgvector      │
                          │ User · Account · │
                          │ Session · Email  │
                          └──────────────────┘
```

## Request lifecycles

**1. Inbox load (`GET /api/emails`)**
1. Session resolved from JWT cookie via `lib/oauth.ts`; refreshes Google / Azure tokens if expired.
2. For OAuth accounts (Gmail, Outlook), threads are fetched in parallel from each provider, parsed, and **upserted** into the `Email` table.
3. For IMAP accounts, the route reads from the normalized `Email` rows (DB-first; live IMAP only happens in the IMAP sync path).
4. Cached AI columns (`aiSummary`, `aiPriorityScore`, …) are merged into the response so the UI renders immediately.
5. Client polls every 30 s silently.

**2. AI analysis (`POST /api/ai/analyze`)**
1. Loads one `Email` row.
2. Calls `lib/orchestrator.processEmail()` → `Classifier → Prioritizer → Summarizer → confidence → Drafter → Validation`.
3. Triggers `onEmailReceived`, `onAnalysisComplete`, and `onReplyGenerated` (×3) hooks for instrumentation.
4. Persists the unified result back to `Email.ai*` columns.
5. The lighter routes (`/api/ai/summary`, `/api/ai/reply`) call individual agents directly for low-latency on-demand UX.

**3. IMAP onboarding (`POST /api/accounts/imap`)**
1. User submits server config + password.
2. Server validates IMAP login (`imapflow`) and SMTP login (`nodemailer.verify()`).
3. Password encrypted with AES-256-GCM (`lib/encryption.ts`); only ciphertext + IV + tag are persisted.
4. Account row is created with `provider='imap'` and the encrypted credentials.

## Data model (Prisma)

| Model | Purpose |
|---|---|
| `User` | Profile + onboarding flag |
| `Account` | Per-provider credential row. Stores OAuth `access_token` / `refresh_token` / `expires_at` for Google + Azure, **and** `imapHost`/`imapPort`/`smtpHost`/`smtpPort` + `encryptedPassword`/`encryptionIv`/`encryptionTag` for IMAP. Has health + sync status fields. |
| `Session` | NextAuth-style DB session token |
| `Email` | Cached message + AI columns (`aiSummary`, `aiPriorityScore`, `aiPriorityLabel`, `aiPriorityFactors`, `aiCategory`, `aiConfidence`, `aiActions`, `aiUrgency`, `aiWhyItMatters`, `aiNextSteps`). Indexed on `(userId, receivedAt desc)`, `(userId, accountId, receivedAt desc)`. Unique on `(userId, gmailId)`, `(userId, outlookId)`, `(accountId, providerMessageId)`. |

`pgvector` extension is enabled at the schema level for semantic search.

## Performance & quotas

| Concern | Mitigation |
|---|---|
| Cold start | Vercel serverless; Prisma client is a singleton (`lib/db.ts`) |
| Gmail API quota (10k units/day) | Cache-first: only fetch metadata when missing |
| Microsoft Graph rate limits | Cache-first; per-user incremental sync |
| Groq quota (14.4k/day) | **On-demand AI only**; results persist to `Email.ai*` columns. `lib/quota-guard.ts` enforces a per-user daily cap (default 200 calls/user/day) so one user can't exhaust the shared key. Returns `429` with `Retry-After` headers. |
| HF inference rate limits | Embeddings generated once per email and stored |
| Inbox staleness | 30 s silent poll + immediate refresh after compose / send |

## Security

- OAuth tokens stored in DB only; never sent to the client.
- IMAP passwords encrypted at rest with AES-256-GCM (12-byte IV, 16-byte tag, 32-byte key from `ENCRYPTION_KEY`).
- Every API route guards on `getSessionFromRequest`.
- Prisma ORM = parameterized queries → no SQL injection.
- React JSX auto-escapes user content.
- Neon enforces `sslmode=require`.

## What's deliberately not in MVP

- Conversation threading (each Gmail thread renders as the first message)
- Full offline sync (PWA shell only, no IndexedDB message store)
- Push notifications (30 s polling instead)
- IMAP archive/trash at the protocol layer (DB-side flag — folder names vary too much across servers)
- Advanced label management
- Analytics dashboard

These are written down so reviewers know what's real vs deferred. See `docs/CLAUDE.md` for full rationale.

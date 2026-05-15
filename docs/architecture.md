# Architecture — Mavio AI Email Client

## Overview

Mavio is a **single-service Next.js 15 fullstack application** deployed on Vercel. There is no separate backend service. All API logic, AI service calls, Gmail integration, and database access live within Next.js Route Handlers. The architecture is designed for low latency, streaming AI responses, and cache-first rendering.

---

## System Diagram

```
                        Browser / PWA
                              |
                              | HTTPS
                              v
        +--------------------------------------------+
        |          Next.js 15 on Vercel              |
        |                                            |
        |  +--------------------------------------+  |
        |  |         React UI (Client)            |  |
        |  |  Inbox / Detail / Compose / AIPanel  |  |
        |  +--------------------------------------+  |
        |                    | fetch()               |
        |                    v                       |
        |  +--------------------------------------+  |
        |  |       Route Handlers (Server)        |  |
        |  |  /api/emails   /api/ai/summary       |  |
        |  |  /api/emails/[id]   /api/ai/reply    |  |
        |  |  /api/emails/send   /api/emails/search|  |
        |  |  /api/auth/[...nextauth]             |  |
        |  +--------------------------------------+  |
        |       |              |             |       |
        |       v              v             v       |
        |  +---------+   +-----------+  +--------+   |
        |  | Prisma  |   |  lib/ai/  |  |  lib/  |   |
        |  |         |   | gemini.ts |  | gmail/ |   |
        |  +---------+   +-----------+  +--------+   |
        +--------------------------------------------+
              |              |               |
              v              v               v
        +--------+      +---------+     +---------+
        |  Neon  |      |  Groq   |     |  Gmail  |
        | Postgres|     | Llama 3 |     |   API   |
        +--------+      +---------+     +---------+
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Fullstack in one repo; Route Handlers replace separate backend |
| Language | TypeScript (strict) | Type safety end-to-end |
| Styling | Tailwind CSS | Fast iteration, zero CSS bundle bloat |
| UI primitives | Radix UI + Lucide icons | Accessible, unstyled, minimal |
| Database | PostgreSQL on Neon (with pgvector extension) | Serverless-friendly, generous free tier |
| ORM | Prisma | Type-safe schema, easy migrations |
| Auth | NextAuth.js v4 + Prisma adapter | Google OAuth with refresh-token rotation |
| AI Runtime | Groq SDK (Llama 3.3 70B Versatile) | 14,400 free req/day, <500ms latency, OpenAI-compatible |
| Email API | googleapis (Gmail v1) | Official, full-feature |
| Deployment | Vercel | Zero-config Next.js, edge functions, env management |
| PWA | next-pwa + manifest | Mobile installable, offline shell |

---

## Data Model (Prisma)

| Table | Purpose |
|---|---|
| `User` | NextAuth user |
| `Account` | OAuth tokens (access + refresh + expires_at) — used for automatic token refresh |
| `Session` | NextAuth database-strategy session |
| `Email` | Cached Gmail message + AI-analysis fields (summary, priority, actions, urgency, next-steps) |
| `EmailEmbedding` | pgvector embedding column (extensible for semantic search) |

---

## Request Lifecycle (Inbox Load)

1. Browser hits `/inbox` → server checks session via NextAuth
2. Session callback in `lib/auth.ts` reads `Account.expires_at`; if expired, calls Google token endpoint with the stored refresh token and updates the DB
3. Client calls `GET /api/emails?maxResults=20`
4. Route handler hits Gmail API for thread list, parallel-fetches full threads
5. New emails are upserted into Postgres so subsequent loads serve from cache
6. AI metadata stored in DB is merged into the response — no AI call on first load
7. Client polls every 30 s with the same endpoint for new emails (silent refresh)

---

## AI Architecture

All AI logic is in `lib/ai/gemini.ts` (named for historical reasons; now uses Groq).

| Function | Trigger | Output |
|---|---|---|
| `generateSummary()` | User clicks "Generate" in AI panel | 1–2 sentence summary, cached in `Email.aiSummary` |
| `streamSummary()` | Available for future SSE streaming | Async generator yielding text chunks |
| `analyzeEmail()` | Reserved for on-demand bulk analysis | Full priority + actions + urgency JSON |
| `generateReplyDrafts()` | User clicks "Smart Replies" | 3 drafts: professional, friendly, concise |
| `analyzePriority()` | Reserved | Urgency score 1–10 + label |
| `extractActions()` | Reserved | Array of typed AI actions |

**Design choice:** the original plan auto-analyzed every inbox email in the background. After observing free-tier quota exhaustion within minutes, this was changed to **on-demand**. Cached summaries are still served instantly from the DB.

---

## Auth & Token Refresh

Google access tokens expire after 1 hour. The session callback in `lib/auth.ts`:

1. Reads `Account.expires_at`
2. If less than 60 s remain, calls `https://oauth2.googleapis.com/token` with the refresh token
3. Writes the new `access_token` + `expires_at` (and rotated `refresh_token` if returned) back to the DB
4. Returns the fresh token in the session

If refresh fails, the session is flagged with `error: 'RefreshAccessTokenError'` and the client redirects to sign in.

---

## Provider Abstraction

```ts
interface EmailProvider {
  listThreads(opts): Promise<ThreadList>;
  getThread(id): Promise<Thread>;
  sendEmail(opts): Promise<void>;
  archiveEmail(id): Promise<void>;
  searchEmails(query): Promise<Message[]>;
}
```

- `GmailProvider` — fully implemented
- `OutlookProvider`, `ImapProvider` — typed stubs with documented integration paths (Microsoft Graph / `imap-simple` + `nodemailer`). Surfacing these as scaffolds keeps the architecture honest without faking working features.

---

## Performance Notes

| Concern | Mitigation |
|---|---|
| Cold start latency | Vercel serverless functions; Prisma client is singleton |
| Gmail API quota (10k units/day) | DB cache-first; only fetch metadata when missing |
| Groq rate limits | On-demand AI only; cached results stored in DB |
| Inbox staleness | 30 s silent poll + immediate refresh after compose |
| Hydration mismatches from browser extensions | `suppressHydrationWarning` on `<body>` |

---

## Security

- OAuth tokens stored in DB only; never exposed to the client
- `accessToken` injected into session callback server-side
- Server actions run with `getServerSession` guards
- No raw user input passed to Gemini/Groq — prompts use string interpolation but body is truncated to 2 000 chars
- Database connection uses TLS (Neon enforces `sslmode=require`)

---

## What's Not in MVP (Honest Limitations)

- **Outlook + IMAP**: provider stubs only. Documented for future implementation.
- **Account switching UI**: single-account per session. Schema supports multiple.
- **pgvector semantic search**: column exists; embedding pipeline not wired.
- **Offline sync**: PWA shell only; no message-level offline.
- **Push notifications**: not implemented.
- **Conversation/thread grouping**: each thread is the first message; replies aren't unified.

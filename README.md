# Mavio — AI-First Email Client

A mobile-ready PWA email client with AI summaries, smart reply drafts, and priority inbox triage. Built with Next.js 15, Prisma, Neon Postgres, and Groq (Llama 3.3 70B).

> **Live demo:** _(deploy to Vercel and paste URL here)_

---

## What it does

- **Unified inbox** with real-time Gmail sync, search, archive, delete, star
- **AI insights panel** per email — generated summary + 3 smart reply drafts (professional / friendly / concise)
- **Compose + reply** with one-click "use draft" from AI replies
- **Background poll** every 30 s for new mail; immediate refresh after send
- **Mobile-first responsive UI** with a sidebar nav drawer
- **Installable PWA** with manifest + standalone display

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Next.js 15 App Router (fullstack) |
| Language | TypeScript (strict) |
| Auth | NextAuth.js + Google OAuth (with refresh-token rotation) |
| Database | Neon Postgres + Prisma (pgvector enabled) |
| AI runtime | Groq SDK → `llama-3.3-70b-versatile` |
| Email API | googleapis (Gmail v1) |
| UI | Tailwind CSS + Radix UI + Lucide icons |
| Deployment | Vercel |

---

## Repo layout

```
.
├── README.md              ← you are here
├── docs/
│   ├── CLAUDE.md          ← project context for AI pair-programmer
│   ├── architecture.md    ← one-page architecture doc
│   └── agent-workflow.md  ← agents / skills / hooks / plugins writeup
└── frontend/              ← the Next.js app
    ├── app/
    ├── components/
    ├── lib/
    ├── prisma/
    └── types/
```

---

## Screenshots

### Inbox View
![Inbox](docs/screenshots/inbox.png)

### AI Summary
![AI Summary](docs/screenshots/ai-summary.png)

### Smart Replies
![Smart Replies](docs/screenshots/smart-replies.png)

### Mobile UI
![Mobile UI](docs/screenshots/mobile-ui.png)

---

## Why This Architecture

### Why No Microservices?

A monolithic Next.js fullstack app is the right choice for an MVP because:
- **Faster iteration** — No network boundaries between frontend, API, and AI logic
- **Simpler deployment** — One Vercel deployment vs coordinating multiple services
- **Lower operational complexity** — No Docker, no service mesh, no inter-service auth
- **Adequate performance** — Groq API calls are fast (<1s), so no need for async queues yet

Microservices become valuable when you have multiple teams working independently or need to scale individual components. This is a single-dev MVP.

### Why No LangGraph?

LangGraph is excellent for complex multi-agent workflows with stateful orchestration. This app's AI needs are simple:
- Single-pass summary generation
- Single-pass reply drafting
- Single-pass priority analysis

These are independent, one-shot operations. Adding LangGraph would be over-engineering — it would introduce:
- Additional dependency complexity
- State management overhead
- Debugging complexity for linear operations

If we later add multi-step reasoning (e.g., "research this topic, then draft a reply, then schedule a meeting"), LangGraph would be justified.

### Why On-Demand AI?

The original design auto-analyzed every email after fetch. Free-tier quotas (Groq: 14,400 req/day) burned through in minutes with a busy inbox.

**On-demand with caching** is the right approach:
- User clicks "Generate" → AI call → cache in database
- Re-opening the email → instant load from cache
- Quota preserved for actual user intent

This is a deliberate UX tradeoff: slightly more friction for massive cost savings and quota headroom.

### Why Cache-First?

Every AI result (summary, priority, drafts) is cached in the Postgres database:
- **Instant re-opens** — No AI latency on cached emails
- **Quota preservation** — Never re-analyze the same email
- **Offline-ish** — Cached insights work even if Groq is down

The cache is simple: one `aiSummary` column per email row. No Redis, no separate cache layer.

### Why Gmail-First?

Gmail has:
- 1.8B+ users (largest email provider)
- Excellent OAuth 2.0 flow with refresh tokens
- Robust REST API with thread support
- Free tier with generous quotas

Outlook and IMAP have stubbed `EmailProvider` types in the schema. Adding them is:
- One new provider file (e.g., `lib/outlook/client.ts`)
- One new OAuth configuration
- Same UI (already provider-agnostic)

Gmail-first is a scoping decision, not a technical limitation.

---

## Local setup

```bash
cd frontend
npm install
cp .env.example .env.local      # then fill in keys (see below)
npx prisma db push              # push schema to Neon
npm run dev                     # http://localhost:3000
```

### Required environment variables

| Variable | Where to get it |
|---||
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 client. Redirect URI: `http://localhost:3000/api/auth/callback/google` |
| `GROQ_API_KEY` | https://console.groq.com/keys (free, 14,400 req/day) |
| `DATABASE_URL` / `DIRECT_URL` | Neon project connection string |

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Import on Vercel; root directory = `frontend`
3. Paste the same env vars from `.env.local`
4. Add the Vercel URL to Google OAuth → Authorized redirect URIs
5. Set `NEXTAUTH_URL` to your Vercel URL

---

## Tradeoffs & honest limitations

These are intentional MVP scoping decisions.

- **Gmail only.** Outlook and IMAP have typed `EmailProvider` stubs but no real integration. Adding them is one file each; the UI doesn't change.
- **On-demand AI, not background.** The original plan auto-analyzed every inbox email after fetch. Free-tier quotas burned through in minutes, so analysis now triggers only when the user clicks "Generate." Results are cached.
- **Single-account session.** The schema supports multiple `Account` rows per user, but the UI doesn't expose account switching yet.
- **No conversation grouping.** Each Gmail thread is rendered as a single email (the first message). Multi-message threading is deferred.
- **PWA shell only.** The manifest is wired, but message-level offline sync (IndexedDB) is out of scope.
- **No push notifications.** Background polling at 30 s is the freshness mechanism.

These are documented in `docs/architecture.md` and `docs/CLAUDE.md` so reviewers know what's real.

---

## Build with Claude Code

See `docs/agent-workflow.md` for the workflow: specs-first development, role-based AI prompts (Summarizer / Prioritizer / Action Extractor / Reply Drafter / Next-Step Suggester), reusable skills, lifecycle hooks, and pluggable provider implementations.

---

## License

MIT

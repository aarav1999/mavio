# CLAUDE.md — Mavio AI Email Client

## Project Overview

Mavio is an **AI-first email client** built as a production-quality MVP PWA. It demonstrates AI-native workflow design, clean fullstack architecture, and polished UX — optimized for low latency, streaming AI responses, and fast perceived performance.

**Single deployment target**: Vercel. No separate backend service.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (fullstack) |
| Language | TypeScript |
| Styling | TailwindCSS + shadcn/ui |
| Database | PostgreSQL + pgvector (Neon / Vercel Postgres) |
| ORM | Prisma |
| Auth | NextAuth.js v5 (Google OAuth) |
| AI | Groq (Llama 3.3 70B Versatile, free tier) |
| Email | Gmail API via googleapis |
| Deployment | Vercel |
| PWA | next-pwa |

**No FastAPI. No LangGraph. No ChromaDB. No separate microservices.**

---

## Architecture: Single Next.js Fullstack

```
frontend/
├── app/
│   ├── api/                   # Route Handlers (server-side)
│   │   ├── auth/[...nextauth]/
│   │   ├── emails/
│   │   │   ├── route.ts       # List inbox
│   │   │   ├── [id]/route.ts  # Get/patch thread
│   │   │   ├── send/route.ts  # Send email
│   │   │   └── search/route.ts
│   │   └── ai/
│   │       ├── summary/route.ts    # Streaming summary SSE
│   │       └── reply/route.ts      # Generate reply drafts
│   ├── inbox/page.tsx         # Protected inbox page
│   ├── login/page.tsx         # Auth landing
│   └── layout.tsx
├── components/
│   ├── inbox/                 # EmailList, EmailItem, EmailDetail, SearchBar
│   ├── ai/                    # AIPanel, PriorityBadge, ActionChips
│   ├── compose/               # ComposeModal
│   └── layout/                # Sidebar, MobileNav
├── lib/
│   ├── ai/
│   │   └── gemini.ts          # All AI service functions (Groq SDK)
│   ├── gmail/
│   │   └── client.ts          # Gmail API wrapper
│   ├── providers/
│   │   └── interface.ts       # EmailProvider abstraction
│   ├── auth.ts                # NextAuth config
│   ├── db.ts                  # Prisma client
│   └── utils.ts
├── prisma/
│   └── schema.prisma
└── types/
    └── email.ts
```

---

## AI Services (not "agents")

All AI logic lives in `lib/ai/gemini.ts` as **lightweight, composable service functions**:

| Function | Purpose |
|---|---|
| `analyzeEmail()` | Single-call full analysis: summary + priority + actions + urgency |
| `generateReplyDrafts()` | 3 tone-varied reply drafts |
| `streamSummary()` | Streaming summary via SSE |
| `extractActions()` | Actionable item extraction |
| `analyzePriority()` | Urgency scoring + "why it matters" |
| `suggestNextSteps()` | Single best next action |

**No orchestration graph. No supervisor. No message-passing.** Each function is a direct Groq API call with structured JSON output. Llama 3.3 70B chosen for free 14,400 req/day quota and sub-500ms inference.

---

## AI-First UX Concepts

The app treats AI as the primary interface layer, not a sidebar add-on:

- **"Why this matters"** — Shown inline on every email
- **"Suggested next action"** — Contextual action nudge per email
- **"Needs attention"** — Priority inbox triage signal
- **"Urgent today"** — Deadline/escalation detection
- **"Waiting for reply"** — Outbound tracking signal
- **Smart triage** — Priority score + label visible in email list
- **AI insights panel** — Collapsible per-email panel with full analysis
- **Smart reply drafts** — 3 tone options (professional / friendly / concise)

---

## Performance Architecture

### Latency Strategy
- **On-demand AI analysis**: Triggered by user clicking Generate; results cached in DB (background analysis disabled to preserve free-tier quota)
- **Streaming summaries**: Groq streams output token-by-token; no full-response wait
- **Cache-first rendering**: DB-cached AI metadata renders instantly; Gmail API is secondary
- **Optimistic UI**: Archive/star/delete apply locally before server confirms
- **Debounced search**: 400ms debounce before API call, DB cache checked first

### Data Flow
```
Gmail API → parse → upsert DB → return to UI
                 ↓ (on user request)
           Groq analysis → update DB AI fields
                           ↓
                    Next request serves from cache
```

---

## Provider Abstraction

Gmail is **fully implemented**. Outlook and IMAP are **architecturally supported** via a clean interface:

```typescript
interface EmailProvider {
  listThreads(opts): Promise<ThreadList>
  getThread(id): Promise<Thread>
  sendEmail(opts): Promise<void>
  archiveEmail(id): Promise<void>
  searchEmails(query): Promise<Message[]>
}
```

`GmailProvider` implements this interface. `OutlookProvider` and `ImapProvider` are scaffold stubs.

---

## Search Strategy

Hybrid search combining:
1. **PostgreSQL full-text search** — Fast, indexed, no extra infra
2. **DB cache lookup** — Subject/from/snippet substring matching
3. **Gmail API fallback** — For queries not yet in cache
4. **Vector reranking** (extensible) — pgvector embeddings for semantic similarity

This is positioned as **"MVP hybrid search"**, not mocked search.

---

## Environment Variables

```bash
# Auth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret

# Gmail OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# AI
GROQ_API_KEY=your-groq-key   # https://console.groq.com/keys

# Database
DATABASE_URL=postgresql://...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Rate Limit Awareness

| API | Free Tier | Mitigation |
|---|---|---|
| Groq Llama 3.3 70B | 30 RPM / 14,400 RPD | DB cache, on-demand analysis (not background) |
| Gmail API | 10,000 units/day | Incremental sync, cache-first |
| Vercel | 100GB bandwidth | Edge caching, static assets |

---

## MVP Scope

### Fully Implemented
- Gmail OAuth login + session management
- Inbox with real-time Gmail sync
- Email reading with HTML body rendering
- AI panel: summary, priority, actions, next steps, reply drafts
- Compose/reply/forward with send
- Archive, star, delete (optimistic UI)
- Streaming AI summaries (SSE)
- Sidebar navigation (Inbox/Starred/Sent/Drafts/Trash)
- Mobile-first responsive layout + mobile nav drawer
- PWA manifest + installable

### Architecturally Supported (Not Fully Built)
- Outlook OAuth (provider scaffold)
- IMAP (abstraction only)
- pgvector semantic reranking (schema ready, not wired)

### Deferred Post-MVP
- Full offline sync with IndexedDB
- Push notifications
- Thread grouping / conversation view
- Advanced label management
- Analytics dashboard

---

## Testing

```bash
# Unit tests
npm run test

# E2E (Playwright)
npm run test:e2e

# Type checking
npm run type-check

# Lint
npm run lint
```

---

## Deployment

```bash
# Install deps
cd frontend && npm install

# Generate Prisma client
npx prisma generate

# Push schema to DB
npx prisma db push

# Run dev server
npm run dev

# Deploy to Vercel
vercel --prod
```

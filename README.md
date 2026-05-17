# Mavio — AI-First Universal Email Client

<!-- After pushing to GitHub, replace OWNER/REPO below to enable the badge. -->
<!-- ![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg) -->

A mobile-ready PWA email client that unifies Gmail, Office 365, and IMAP (Yahoo / AOL / iCloud / custom) under one inbox, with AI summaries, smart reply drafts, priority triage, pattern detection, and folder suggestions.

> **Live demo:** https://mavio.vercel.app
> Built with Next.js 15 · Prisma + Neon Postgres (pgvector) · Groq Llama 3.3 70B · Hugging Face embeddings · Vercel.

---

## Quick Start

### Deploy to Vercel

1. Push this repository to GitHub
2. Import on Vercel
3. Configure environment variables (see below)
4. Deploy

### Local Development

```bash
npm install
cp .env.example .env.local       # then fill in keys (see below)
npx prisma generate
npx prisma db push               # push schema to Neon
npm run dev                      # http://localhost:3000
```

---

## Deliverables (per the brief)

| Deliverable | Location |
|---|---|
| Live Vercel URL | https://mavio.vercel.app |
| `CLAUDE.md` | [`docs/CLAUDE.md`](docs/CLAUDE.md) (project context) and [`CLAUDE.md`](CLAUDE.md) (code-side rules) |
| One-page architecture doc | [`docs/architecture.md`](docs/architecture.md) |
| List of agents / skills / hooks / plugins | [`docs/AGENTS_SKILLS_HOOKS_PLUGINS.md`](docs/AGENTS_SKILLS_HOOKS_PLUGINS.md) |
| Workflow writeup | [`docs/agent-workflow.md`](docs/agent-workflow.md) |
| Automated tests | `{agents,skills,lib}/__tests__/` (Jest, 75 tests in 14 suites) |
| CI | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — lint + `tsc --noEmit` + Jest |

---

## Feature snapshot

- **Unified inbox** across Gmail, Office 365 / Outlook, and IMAP (Yahoo, AOL, iCloud, custom)
- **Account switching** between any combination of providers under one login
- **Compose / reply / forward / search / archive / delete / star / read-flag / labels**
- **AI insights per email** — generated summary + 3 smart reply drafts (professional / friendly / concise) + priority score + factors + classification + actions
- **Cross-email pattern detection** — recurring senders, deadline clusters, unreplied urgent
- **Smart folder suggestions** — bulk-organize actions
- **Semantic search** with pgvector + Hugging Face embeddings
- **Keyboard shortcuts** — j/k navigation, e archive, r reply, c compose, s star, ? help
- **Encrypted IMAP credentials** at rest (AES-256-GCM)
- **Installable PWA** — manifest + standalone display
- **Mobile-first responsive UI** with sidebar nav drawer

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router (fullstack, single deployment) |
| Language | TypeScript (strict) |
| Auth | Custom JWT session in `lib/oauth.ts` + Google OAuth + Azure AD (refresh-token rotation) |
| Database | Neon Postgres + Prisma + pgvector |
| AI | Groq SDK · `llama-3.3-70b-versatile` |
| Embeddings | Hugging Face inference · `sentence-transformers/all-MiniLM-L6-v2` |
| Email APIs | googleapis (Gmail v1) · Microsoft Graph v1 (Outlook) · imapflow + nodemailer + mailparser (IMAP/SMTP) |
| UI | Tailwind CSS + Radix UI + Lucide icons |
| PWA | next-pwa + manifest |
| Hosting | Vercel |

---

## Repo layout

```
.
├── README.md                       — this file
├── .github/workflows/ci.yml        — lint + typecheck + tests on every push/PR
├── docs/
│   ├── CLAUDE.md                   — project context for AI pair-programmer
│   ├── architecture.md             — one-page architecture
│   ├── agent-workflow.md           — workflow writeup
│   ├── AGENTS_SKILLS_HOOKS_PLUGINS.md
│   └── screenshots/
├── app/                            — routes + API handlers
├── agents/                         — 7 AI agents (Groq prompts)
├── skills/                         — 5 reusable pure functions
├── hooks/                          — 3 lifecycle hooks + UI keyboard hook
├── plugins/                        — 3 EmailProvider plugins (Gmail / Outlook / IMAP)
├── components/                     — React UI
├── lib/                            — providers, orchestrator, ai, oauth, encryption, db
└── prisma/schema.prisma
```

---

## Screenshots

### Inbox + AI insights
![Inbox](docs/screenshots/inbox.png)

### AI panel — summary + priority + factors
![AI panel](docs/screenshots/ai-panel.png)

### Smart reply drafts (3 tones)
![Smart replies](docs/screenshots/smart-replies.png)

### Account switcher across providers
![Account switcher](docs/screenshots/account-switcher.png)

### Mobile responsive view
![Mobile UI](docs/screenshots/mobile-ui.png)

---

## Why this architecture

### Monolithic Next.js fullstack
One Vercel deployment. No FastAPI sidecar, no separate worker, no service mesh. Faster iteration; easy to extract microservices later if scale demands it.

### Pragmatic multi-agent, not LangGraph
The seven agents are specialized prompt-functions sharing a Groq client. They run sequentially in `lib/orchestrator.ts` from `POST /api/ai/analyze`. This is **deliberate** — every operation is single-pass; LangGraph would only inflate latency and cost for an MVP. The seam to add a real DAG is in place.

### On-demand AI with DB cache
Free Groq tier is 14,400 requests/day. Background analysis on every fetched email burns it in minutes. AI runs only when the user clicks **Generate**; results persist to `Email.ai*` columns and load instantly thereafter.

### Three real providers, not stubs
- Gmail — googleapis + Google OAuth, refresh-token rotation
- Outlook / Office 365 — Microsoft Graph + Azure AD, custom Prisma adapter to strip `ext_expires_in`
- IMAP — imapflow + nodemailer + mailparser, AES-256-GCM password encryption

IMAP archive/trash/star/search are deliberately handled DB-side because folder semantics vary across servers — see the inline note in `frontend/lib/providers/imap.ts`.

---

## Local setup

```bash
cd frontend
npm install
cp .env.example .env.local       # then fill in keys (see below)
npx prisma generate
npx prisma db push               # push schema to Neon
npm run dev                      # http://localhost:3000
```

### Required environment variables

| Variable | Source |
|---|---|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client. Redirect URI: `http://localhost:3000/api/auth/callback/google` |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` | Azure Portal → App registrations. Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad` |
| `GROQ_API_KEY` | https://console.groq.com/keys (free, 14,400 req/day) |
| `HF_API_KEY` | https://huggingface.co/settings/tokens (free, used for semantic search embeddings) |
| `DATABASE_URL` / `DIRECT_URL` | Neon project connection strings |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (required for IMAP password encryption) |

### Run the test suite

```bash
npm test                  # 75 unit tests across 14 suites
npx tsc --noEmit          # type-check
npm run test:e2e          # Playwright auth-redirect smoke test
npm run lint
```

CI runs all of these on every push and pull request.

---

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import on Vercel.
3. Paste the same env vars from `.env.local`.
4. Add the deployed Vercel URL to the Google OAuth + Azure AD authorised redirect URIs.
5. Set `NEXTAUTH_URL` to your Vercel URL.

---

## Honest scope

**Implemented and working:**
Unified inbox · Gmail / Outlook / IMAP · account switching · compose / reply / forward / search · archive / delete / star / mark read · AI summary · explainable priority · 3-tone reply drafts · classification · pattern detection · folder suggestions · semantic search · keyboard shortcuts · onboarding · encrypted IMAP creds · PWA.

**Deferred (out of MVP scope, documented in `docs/CLAUDE.md`):**
Conversation threading · message-level offline sync via IndexedDB · push notifications · IMAP archive/trash at the IMAP layer · advanced label management · analytics dashboard.

---

## License

MIT

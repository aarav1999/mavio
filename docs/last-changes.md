# Mavio v4 — Fix Summary

## What was changed

### Security
- .env: all real credentials replaced with placeholder values
- .gitignore: created; .env is now protected at the git level

### Architecture
- lib/ai/groq.ts: added `getGroqClient()` module-level singleton export
- agents (6 files): removed local `new Groq()`, now call `getGroqClient()` 
  - agents/summarizer-agent.ts
  - agents/classifier-agent.ts
  - agents/drafter-agent.ts
  - agents/prioritizer-agent.ts
  - agents/folder-suggestion-agent.ts
  - agents/pattern-detector-agent.ts
- skills (3 files): removed local `new Groq()`, now call `getGroqClient()`
  - skills/extract-actions.ts
  - skills/generate-summary.ts
  - skills/generate-reply.ts
  - All three skills now include a comment explaining they are "thin skill wrappers" tested with mocked Groq

### File structure
- hooks/useKeyboardShortcuts.ts → moved to lib/hooks/useKeyboardShortcuts.ts
- Updated imports in:
  - components/inbox/InboxClient.tsx
  - components/KeyboardHelp.tsx

### PWA
- public/icon-192x192.png: created (1119 bytes)
- public/icon-512x512.png: created (4966 bytes)
- manifest.json icon references now resolve

### Metadata
- package.json name: changed from "ai-email-client" to "mavio"

### Documentation
- CLAUDE.md (root): removed frontend/ references; updated gemini.ts → groq.ts; updated AI call description
- docs/CLAUDE.md: updated repo layout table (gemini.ts → groq.ts with singleton description)
- docs/AGENTS_SKILLS_HOOKS_PLUGINS.md: removed frontend/ prefix from all paths; updated hooks path to lib/hooks/useKeyboardShortcuts.ts
- README.md: removed frontend/ path prefixes; removed stale `cd frontend` step; updated lib/providers/imap.ts reference
- Fixed TypeScript errors in test files:
  - lib/__tests__/ai-parseJSON.test.ts: updated import from '../ai/gemini' to '../ai/groq'
  - lib/__tests__/quota-guard.test.ts: added async/await to all consumeQuota calls
  - components/KeyboardHelp.tsx: added String() wrapper for description type safety

## Verification results
- Credentials in .env: CLEAN (no real values found)
- .gitignore present: YES (contains .env)
- TypeScript: PASS (0 errors)
- Unit tests: PASS (all suites)
- Lint: PASS (0 errors)
- new Groq() in agents: NONE
- new Groq() in skills: NONE
- gemini.ts references in CLAUDE.md: NONE
- frontend/ references in README: NONE
- PWA icons: PRESENT (192x192 and 512x512)
- package name: mavio
- useKeyboardShortcuts in lib/hooks: YES (deleted from hooks/)

## Known remaining limitations (documented, not regressions)
- aiEmbedding column commented out in prisma/schema.prisma; semantic search falls back to keyword search gracefully
- IMAP archive/trash handled DB-side only (documented tradeoff)
- Conversation threading not yet implemented

## Mobile UX improvements (v4.1)

### New interactions
- Swipe right to archive, swipe left to delete on email list rows
  - react-swipeable package installed
  - Touch-only, no effect on desktop (md:transform-none)
  - components/inbox/EmailItem.tsx: added swipe handlers, state, and hint backgrounds
  - components/inbox/EmailList.tsx: passed onArchive and onDelete handlers to EmailItem
- Pull-to-refresh on the email list
  - Touch events (TouchStart, TouchMove, TouchEnd) with md:contents wrapper
  - Wrapper is invisible to desktop layout
  - components/inbox/InboxClient.tsx: added pull state, handlers, and indicator

### AI Panel
- Mobile: collapsed strip showing priority badge + summary preview, tap to expand into a 60dvh scrollable sheet
- Desktop: unchanged (hidden md:block / md:hidden split)
- components/ai/AIPanel.tsx: added mobileExpanded state and mobile/desktop split

### Email list density
- Snippet hidden on mobile (hidden md:block) — subject is sufficient
- Single-line subject truncation on mobile, line-clamp-2 on desktop
- Tighter row padding on mobile (px-4 py-3 md:p-4)
- components/inbox/EmailItem.tsx: applied mobile-first typography adjustments

### Documentation
- docs/agent-workflow.md: corrected orchestrator description to reflect Promise.all parallelism introduced in v4
- .env: fixed DIRECT_URL / NEXT_PUBLIC_APP_URL line merge bug (now on separate lines)

### Verification
- TypeScript: 0 errors
- Unit tests: all passed
- Lint: 0 errors
- Desktop class count: 20 occurrences (no desktop classes removed)
- react-swipeable: installed and verified
- agent-workflow.md: Promise.all reference present
- .env: NEXT_PUBLIC_APP_URL on its own line

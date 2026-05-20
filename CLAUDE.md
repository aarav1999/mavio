# Mavio — Working Agreement

> Short, code-side `CLAUDE.md` for the AI pair-programmer. The full project context lives in `docs/CLAUDE.md` — read that first.

## Boundaries

- **All app code is at the repo root.** Vercel deploys from the root.
- **All AI calls are funneled through one of two places:**
  - `lib/ai/groq.ts` — shared Groq client. Exports `getGroqClient()` (module-level singleton) plus all AI helper functions (generateSummary, analyzePriority, generateReplyDrafts, etc.).
  - `agents/*-agent.ts` — seven agents. All agents import `getGroqClient` from `@/lib/ai/groq`. Do not instantiate `new Groq()` anywhere else.
- **All email I/O goes through `lib/providers/`** (`gmail.ts`, `outlook.ts`, `imap.ts`). The `plugins/` folder contains thin wrappers that exist purely for plugin-registry / metadata uniformity.

## Folder contracts

```
agents/    — class-style export with { name, description, version, run() }; mock Groq in tests
skills/    — pure functions (no side-effects, no auth); shared across agents
hooks/     — async lifecycle functions; log + optional callback; never throw
plugins/   — `class XPlugin extends XProvider implements EmailProvider`
lib/       — anything not agent/skill/hook/plugin (auth, db, encryption, orchestrator)
app/api/   — Next.js Route Handlers; always guard with `getSessionFromRequest`
components/ — React UI; use `@/components/ui` Radix primitives
```

## Testing rules

1. Unit tests live under `__tests__/` next to the code.
2. **Always mock `groq-sdk`.** Never let unit tests hit the network.
3. Don't pin tests to exact prompt strings or exact descriptions — use `toMatch(/regex/i)` for prose.
4. Encryption tests must cover tag/IV tamper failures. See `lib/__tests__/encryption.test.ts`.
5. Run before committing:
   ```bash
   npm test
   npx tsc --noEmit
   npm run lint
   ```

## Common tasks

- **Add a new email provider** → implement `EmailProvider` in `lib/providers/<name>.ts`, register in `lib/providers/factory.ts`, expose via `plugins/<name>-plugin.ts`, document in `docs/AGENTS_SKILLS_HOOKS_PLUGINS.md`.
- **Add a new agent** → drop a file in `agents/`, write a `__tests__/` mock-Groq test, list it in `docs/AGENTS_SKILLS_HOOKS_PLUGINS.md`, optionally wire to `lib/orchestrator.ts`.
- **Add a new AI route** → place under `app/api/ai/<name>/route.ts`; cache results back to the relevant `Email.ai*` columns; never call AI without a session guard.

## Anti-patterns the reviewer will flag

- Calling Groq from a React component or a `lib/utils.ts`.
- Pinned prompt strings in tests.
- New top-level folders (we already have `agents/skills/hooks/plugins/lib`).
- Re-introducing a parallel Next.js project at the repo root.
- Changing `processEmail` orchestration without updating its test.

# Improvements Log

This document tracks all improvements made to the AI Email Client project.

## Previous Session Improvements

- Fixed AI summary generation failures and implemented retry UI in AIPanel.
- Implemented inbox auto-refresh after sending emails with periodic polling every 30 seconds.
- Decoded HTML entities in email subjects and snippets to fix encoding issues.
- Switched AI backend from Gemini to Groq SDK using llama-3.3-70b-versatile model.
- Updated environment variables to use GROQ_API_KEY instead of GEMINI_API_KEY.
- Implemented OAuth token refresh logic in NextAuth session callback to fix invalid credentials.
- Suppressed React hydration mismatch warnings by adding suppressHydrationWarning to body.
- Added automated unit tests with Jest and e2e tests with Playwright.
- Wired PWA service worker with next-pwa for production PWA build.
- Implemented real Forward email feature with subject/body quoting and blank To field.
- Fixed Next.js 15 route handler param typing by awaiting params.
- Prepared deployment instructions and created .gitignore file.
- Added Regenerate button to force fresh Groq call even with cached summaries.
- Fixed AIPanel state reset when email changes to show correct summaries.
- Removed old backend/ directory containing FastAPI code to eliminate contradictions.
- Added "Why This Architecture" section to README explaining design decisions.
- Added Screenshots section to README with placeholder image paths.
- Fixed sidebar signout button visibility by removing opacity-0 class.

## Current Session Improvements

- Implemented weighted priority scoring with signal-based classification (deadline, customer impact, money/legal, meeting requests, negative scoring for promos/spam).
- Added email category classification (work/personal/promotions/social/spam) to classify email types.
- Implemented uncertainty handling for corrupted/incomplete emails to return "Unable to confidently parse" instead of hallucinating.
- Added skeleton loaders and "Generating insights..." states to AIPanel for better UX during AI generation.
- Improved long email summaries to extract entities, blockers, outcomes, and metrics for more specific and actionable summaries.
- Added aiCategory field to database schema to store email classification.
- Added strategic/technical keyword weights to priority scoring (infrastructure +15, migration +20, latency +15, observability +15, production issue +20, deployment +15) to properly rank strategic discussions.
- Added instruction to ignore single-character entities in summary generation to improve polish and avoid awkward entity references.
- Updated summary generation to use executive-summary style language instead of robotic phrases like "There are no specific key entities."
- Added "Why This Was Prioritized" explainable AI feature that shows specific factors (e.g., customer impact, deadline, rollback discussion) that contributed to the priority score for interpretable classification and enterprise-grade trust layer.
- Added rollback discussion and multiple teams involved signals to priority scoring and updated prompt to expose ALL detected signals for richer scoring transparency.
- Updated summary generation to produce sharper, operational, executive-style summaries using active voice, avoiding verbose phrases, and preferring bullet-point style compressed summaries.
- Added confidence score (High/Medium/Low) to AI analysis with rule-based assessment for corrupted emails, placeholders, and generic content to improve hallucination handling and maturity.
- Added inline observability panel showing LLM latency, estimated tokens, priority score, and confidence in a debug-style metrics panel for enterprise-grade monitoring.

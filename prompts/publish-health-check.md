# Publish fix (health check): prompts and decisions

Issue #27, branch `fix/publish-health-check`, PR #28. Fixed with Claude Code in a cloud session (thread "Publishing fails on Replit").

## Prompts I gave

1. I pasted the failed Replit publish log.
2. "Can you fix this or should I use replit?"
3. Picked "Yes, open them" on the card to open the issue and PR.
4. After publishing again: "It published"

## What went wrong and the fix

- Before going live, Replit checks `/api/healthz` from an internal address. Every API request went through Clerk first, and Clerk threw "Host must not be empty" on that internal address, so all 100 checks failed.
- It never showed up in development because Clerk's test keys skip that lookup.
- The fix answers the health check before Clerk runs (6 lines in `artifacts/api-server/src/app.ts`), plus a test that fails without the fix.
- I chose the Issue, branch, PR fix instead of Replit Agent's "Fix with Agent".

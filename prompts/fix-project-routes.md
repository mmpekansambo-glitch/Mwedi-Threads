# Fix the broken project routes: prompts and decisions

Issue #4, branch `fix/project-routes`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## What happened

While starting the users table (issue #3), Claude found that `artifacts/api-server/src/routes/projects.ts` was garbled on GitHub and in my Replit workspace: code from the progress-note handler had been pasted into the other handlers, "delete project" was registered three times, and "get one project" and "photo upload" were missing. TypeScript failed and 12 of 35 server tests failed.

## Prompts I gave

1. Asked what a rollback in Replit would take, then chose: "Rewrite please."
2. "I'd rather learn about the review process than" roll back, so this PR is also my first walk-through of reviewing a pull request.

## Decisions

- Rebuild every route from the API spec (`lib/api-spec/openapi.yaml`) and the existing tests instead of rolling back Replit, so no later work is lost.
- Keep every route scoped to the signed-in owner; another account gets "Project not found."
- Removing a progress photo clears it from the entry; deleting a project also tries to delete its stored photos and logs (but doesn't fail on) storage errors.

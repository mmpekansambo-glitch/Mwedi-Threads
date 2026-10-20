# Database sync check: prompts and decisions

Issue #48. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. "Could you open a new issue that deals with the lack of synchronization in the latest update? I keep getting a new something went wrong issue."
2. "Can we make sure this doesn't happen in future feature iterations?"
3. Chose "Fix + checklist" on the options card.

## Decisions

- **Cause:** Replit gave the after-pull script (`scripts/post-merge.sh`) only 20 seconds. Installing packages alone takes most of that, so the database step got cut off and new tables never reached the database.
- **More time:** the after-pull script now gets 5 minutes (`.replit`, `[postMerge] timeoutMs`).
- **Warning:** when the API server starts, it compares the database with the Drizzle schema and logs exactly which tables or columns are missing.
- **Checklist:** a PR template with a "Database changes" section listing the Replit steps. Claude also checks the dev database after each schema PR is pulled.
- Publishing still needs the database changes approved on the Replit website.

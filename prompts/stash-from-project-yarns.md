# Every project yarn in the stash: prompts and decisions

Issue #51, branch `fix/stash-from-project-yarns`, PR #52. Built with Claude Code in a cloud session (thread "Edit form bug, sorting, stash sync").

## Prompts I gave

1. Original ask (same message as #32 and #30): "...And make sure that the stash database is also cross checking and populated by project yarn inputs."
2. Picked "Fix both" on the decision card.
3. "Were there any database creations with this?"

## Decisions

- Yarn on projects made before PR #47 is matched to the stash or added once, marked "Needs a photo".
- Project yarn now needs a brand whenever type or color is filled in (web, mobile and API), because every stash yarn needs a brand.
- No new tables or columns, only new rows in existing tables.
- Known catch: a stash yarn deleted while a project still lists it comes back after the server restarts.

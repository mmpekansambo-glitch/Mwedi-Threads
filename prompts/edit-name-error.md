# Edit form name error: prompts and decisions

Issue #32, branch `fix/edit-name-error`, PR #50. Fixed with Claude Code in a cloud session (thread "Edit form bug, sorting, stash sync").

## Prompts I gave

1. Original ask: "Let's fix the bug in 32 and the. Work on building out the sort control for both projects and stash if nothing further already there. And make sure that the stash database is also cross checking and populated by project yarn inputs."

## Decisions

- Clearing the name in the web Edit details form now shows "Your project needs a name." and won't save.
- The mobile edit form already did this.
- No database change.

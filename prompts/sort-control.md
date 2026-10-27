# Sort controls: prompts and decisions

Issue #30, branch `feature/sort-control`, PR #53. Built with Claude Code in a cloud session (thread "Edit form bug, sorting, stash sync").

## Prompts I gave

1. Original ask (same message as #32): "...Work on building out the sort control for both projects and stash if nothing further already there."
2. Picked the recommendations on the three sort cards.

## Decisions

- **Projects:** Recently updated (default), Newest added, Oldest added, A to Z.
- **Yarn stash:** Recently updated (default), Brand A to Z, Most skeins left, Weight thin to thick.
- The chosen sort is remembered on each device.
- Web and mobile. No database change.

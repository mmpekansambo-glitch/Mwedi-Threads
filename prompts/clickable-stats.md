# Clickable Overview stats: prompts and decisions

Issue #63, branch `feature/clickable-stats`, PR #64. Built with Claude Code in a cloud session (thread "Make dashboard stat cards clickable").

## Prompts I gave

1. Original ask: "I want to be able to click on the stats at the top and be redirected to the projects page where the appropriate filters are running to highlight those figures"
2. "Both, bar charts too, A"

## Decisions

- Web and the iPhone app.
- All projects opens My projects with no filter. In progress and Finished open it with that status filter on.
- Tapping a bar in "Projects by status" opens My projects filtered to that status, including Planning and On pause.
- No arrow or icon on the cards (option A): a slight lift on hover and a press effect when tapped.
- No database change.

# Dashboard charts: prompts and decisions

Issue #11, branch `feature/dashboard-charts`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. Original ask: "Let's tackle the Dashboard charts of the plan.md file"
2. Design questions: "Go" (took every recommendation below).
3. Draft issue: "Open it"

## Decisions

- **Scope:** the three charts only. The three stats (total projects, average days to complete, most-used yarn brand) get their own issue next.
- **Where:** web and mobile.
- **Projects by status:** a bar chart with one bar each for Planning, In progress, On pause and Finished.
- **Finished each month:** the last 12 months, using each project's completed date. Month-only dates count as the 1st of that month. Finished projects with no completed date are left out, and a note under the chart says how many.
- **Progress notes each week:** the last 12 weeks, with weeks starting on Monday.
- **Colors:** bars in Granite, axis text in Blue Slate, grid lines in Lavender. On mobile, a tapped bar turns Powder Blue and shows its count.
- **Empty charts:** each chart shows a friendly sentence instead of empty bars.
- **API:** `GET /dashboard` now also returns `charts`. The months and weeks are counted on the server in UTC, and only the signed-in maker's projects are counted.

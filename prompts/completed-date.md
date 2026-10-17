# Completed date: prompts and decisions

Issue #7, branch `feature/completed-date`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. Next feature after the users table: "B" (the completed date, following PLAN.md's order, before stars).
2. When a finished project is reopened: "Clear it".
3. Issue text: "Approve".

## Decisions

- **Fields:** `completed_at` and `completed_at_precision` (month or day) work like the started and target dates.
- **Automatic fill:** finishing a project (status set to completed, or a 100% progress note) fills in today's date if none is set. Today is the server's UTC date.
- **Reopening clears it:** moving a finished project back to planning, in progress or paused clears the date, so stats only count finished projects.
- **My date wins:** a completed date I pick in the edit form is saved as is and never overwritten.
- **Where I edit it:** the "Finished on" field appears in the web and mobile edit forms only while the project is completed. The detail pages show it when it's set.

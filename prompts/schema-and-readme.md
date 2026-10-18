# schema.md and README.md: prompts and decisions

Issue #33, branch `feature/schema-readme`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. Original ask: "Let's work in issue #33"
2. My answers to the layout questions: "1. I want both a diagram and a columns table. 2. for the README include links to the PLAN.md, a few screenshots,. 3. Run it on replit. 4. Yes include a prompts file"

## Decisions

- **schema.md:** a diagram of how the four tables connect (drawn by GitHub from Mermaid), then a table of every column for users, projects, project_progress_entries and stars, plus the enums and the month-only date rule. It is based on the Drizzle schema in `lib/db/src/schema`.
- **README.md:** what Mwedi Threads is, its features, screenshots (landing page, dashboard, My projects and a project page), the stack, how to run it on Replit, and a link to PLAN.md.
- **Running:** Replit only, because that's where the app is built and hosted.
- **Screenshots** live in `docs/screenshots`.
- Documentation only, no code changes.

# Scenario tests for both studios: prompts and decisions

Issue #92. Built with Claude Code in a cloud session from my Mwedi Threads project (thread "Add user scenario tests for both studios").

## Prompts I gave

1. Original ask: "Can we build out some scenario based tests that simulate a users who use the yarn studio and another who uses the sewing room."
2. Picked "Server stories + browser stories" when asked which kind of scenario tests to run.

## Decisions

- **Two makers, one story each:** a maker who only uses the Yarn studio and one who only uses the Sewing room. Each story runs from sign-up onwards and every step builds on the last, so the first failure is where the story broke.
- **Server stories:** call the real API routes, step by step, on a brand-new PostgreSQL database.
- **Browser stories:** click through the web app in Chromium. I chose these with a pretend server, but they ended up talking to the real API and the same kind of throwaway database, which is closer to a real maker.
- **Real tables:** the throwaway database is built from the app's own schema with drizzle-kit, so the stories never fall behind a schema change. It is dropped at the end.
- **Stood in for:** only sign-in, photo storage and the fabric print photo check.
- **Fixes kept fixed:** the stories replay issues #79 to #84 (renames that stick and flow to projects, skeins left, the Overview brand card, the Archive, Sewing room parity, one note at a time).

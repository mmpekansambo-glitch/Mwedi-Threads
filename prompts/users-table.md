# Users table: prompts and decisions

Issue #3, branch `feature/users-table`. Built with Claude Code in a cloud session from my Mwedi Threads project.

## Prompts I gave

1. "Okay Claude I want to code for a new issue in my Mwedi Threads git Repo. How can I use claude Code to work at creating the users table and stars feature in my application?"
2. Where to work: "Here" (in the cloud Claude Code session, not on my computer).
3. How to split the work: "Two issues" (users table first, stars later, as PLAN.md orders them).
4. Issue text and how a users row gets created: "Approve first request".
5. Existing owners' email and name: "Correct i am the only owner", so they fill in on my next visit.

## Decisions

- **Row creation:** the server creates my users row on my first signed-in request (in `requireAuth`), not through a Clerk webhook, because that needs no extra setup.
- **Existing owners:** a script that runs before the database push (`lib/db/scripts/prepare-users.mjs`) adds a users row for every existing project owner. Email and name start empty and are filled from Clerk the next time that person uses the app. `joined_at` for them is the date of their first project.
- **Link:** `projects.owner_id` now points at `users.id`, so a project can't belong to someone with no account row.
- **If Clerk is unreachable:** the row is still created with empty details and filled in on a later request, so sign-in never fails because of it.

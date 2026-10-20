## What changed

## Database changes
- [ ] This PR changes `lib/db/src/schema` (new tables or columns)

If ticked, after merging:
1. Pull into Replit. `scripts/post-merge.sh` runs `prepare-users` and `db push` on the dev database.
2. Check the API server log says "Database schema matches the code". If it lists missing tables or columns, run `pnpm --filter db run prepare-users` then `pnpm --filter db push` in Replit dev.
3. Publish on the Replit website and approve the database changes review.
4. Add any new secrets this PR needs:

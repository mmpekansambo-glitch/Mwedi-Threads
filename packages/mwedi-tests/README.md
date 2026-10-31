# Mwedi Threads test package

Run the standard automated suite from the workspace root:

```sh
pnpm test
```

This runs project API contract checks, the API server test suite, web tests, and
Chromium browser tests for creating and editing projects.
To also typecheck the package, API, web, and mobile projects:

```sh
pnpm --filter @workspace/mwedi-tests run test:all
```

The PostgreSQL integration test uses an isolated, temporary schema and requires
`PROJECTS_AUTH_TEST_DATABASE_URL` to point to a non-production database:

```sh
pnpm --filter @workspace/mwedi-tests run test:postgres
```

## Scenario stories

Two simulated makers use the app from sign-up onwards, one in the Yarn studio
and one in the Sewing room. Each story is one long run where every step builds
on the last: stash, tools, projects, notes, renames, finishing, the Archive and
the Overview. They also replay the stash fixes from issues #79 to #84 so those
stay fixed.

- **Server stories** (`artifacts/api-server/src/scenarios/*.postgres.test.ts`)
  call the real API routes.
- **Browser stories** (`scenarios/*.spec.ts`) click through the web app in
  Chromium, and the app talks to the real API.

Both run against a brand-new PostgreSQL database built from
`lib/db/src/schema`, created next to the database that
`PROJECTS_AUTH_TEST_DATABASE_URL` names and dropped at the end, so the
database user needs permission to create databases. Sign-in, photo storage and
the fabric print photo check are stood in for (see
`artifacts/api-server/src/scenarios/fakes`); everything else is the real code.

```sh
PROJECTS_AUTH_TEST_DATABASE_URL=postgresql://user@localhost:5432/scratch \
  pnpm --filter @workspace/mwedi-tests run test:scenarios
```

When a step fails, the steps after it are skipped, so the first failure is
where the story broke.

| Story | Steps |
| --- | --- |
| Yarn studio (server) | Picks yarn; adds yarn with photos; searches; Did you mean; fixes a brand's capitals and renames the rest (#79); adds hooks, needles, notions; starts two projects from stash and typed yarn; edits and deletes notes; counts rows; renames a color and the project follows (#79); tied brands on the Overview (#81); finishes and takes skeins off (#80); skeins left can't pass skeins bought (#80); archives used-up yarn and gets it back by adding it again (#82); reopens; stays private |
| Sewing room (server) | Picks sewing; adds fabric with print photos; adds notions and kit, renames a brand; starts a dress with fabric, tools, needle and thread; edits fabric and tools and the project shows them (#83); dated notes journal (#84); Overview stages, fabric types, length; finishes and records fabric left (#83); archives used-up fabric (#83); "Same fabric?" brings it back, a different print is added as new (#83); archives a used-up notion, kit never (#83); reopens; turns on yarn; stays private |
| Yarn studio (browser) | Picks yarn; adds yarn; capitals fix and rename offer (#79); adds a hook; starts a project from stash; opening one note while editing another saves it (#84); color rename shows on the project (#79); Overview brand (#81); skeins-left prompt on finishing (#80); Archive nudge and getting it back (#82) |
| Sewing room (browser) | Picks sewing; adds fabric; adds a zip; starts a dress with fabric, zip, needle and thread; notes save when another opens (#84); fabric edit shows on the project (#83); Overview chart and length; fabric-left prompt on finishing (#83); Archive nudge; "Same fabric?" (#83); archives the used-up zip (#83) |

## Core acceptance checks

| ID | Check | Automated coverage |
| --- | --- | --- |
| AUTH-01 | Sign up, sign in, and sign out; verify Google sign-in when enabled for the Clerk app. | Manual |
| PROJ-01 | Create, edit, list, and reopen a project without losing its details. | API tests; web browser create/edit flow; mobile manual smoke test |
| DATE-01 | Save a month-only date and confirm it displays as `MM/YY`. | Contract, API, and web browser tests; mobile manual form check |
| DATE-02 | Save a full date and confirm it displays as `MM/DD/YY`. | Contract, API, and web browser tests; mobile manual form check |
| YARN-01 | Save Brand, Type, and Color independently, then edit one without changing the others. | Contract, API, and web browser tests; mobile manual form check |
| HOOK-01 | Choose a standard crochet hook size with its mm, US, and UK/Canada equivalents. | Contract, API, and web browser create/edit tests; mobile manual form check |
| DESIGNER-01 | Preview a linked designer page title, save it, and replace a designer name with a website. | API tests and web browser create/edit flow; mobile manual smoke test |
| PROG-01 | Add a progress update and confirm it appears on the correct project. | API authorization tests; manual web/mobile smoke test |
| PRIV-01 | With two accounts, confirm one account cannot read or change the other account's projects or progress. | API authorization tests |
| LEGACY-01 | Open a project with older free-text yarn details and confirm the note remains visible after editing structured fields. | Manual web/mobile smoke test |

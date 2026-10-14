# Mwedi Threads test package

Run the standard automated suite from the workspace root:

```sh
pnpm test
```

This runs project API contract checks, the API server test suite, and web tests.
To also typecheck the package, API, web, and mobile projects:

```sh
pnpm --filter @workspace/mwedi-tests run test:all
```

The PostgreSQL integration test uses an isolated, temporary schema and requires
`PROJECTS_AUTH_TEST_DATABASE_URL` to point to a non-production database:

```sh
pnpm --filter @workspace/mwedi-tests run test:postgres
```

## Core acceptance checks

| ID | Check | Automated coverage |
| --- | --- | --- |
| AUTH-01 | Sign up, sign in, and sign out; verify Google sign-in when enabled for the Clerk app. | Manual |
| PROJ-01 | Create, edit, list, and reopen a project without losing its details. | API tests; manual web/mobile smoke test |
| DATE-01 | Save a month-only date and confirm it displays as `MM/YY`. | Contract and API tests; manual form check |
| DATE-02 | Save a full date and confirm it displays as `MM/DD/YY`. | Contract and API tests; manual form check |
| YARN-01 | Save Brand, Type, and Color independently, then edit one without changing the others. | Contract and API tests; manual form check |
| PROG-01 | Add a progress update and confirm it appears on the correct project. | API authorization tests; manual web/mobile smoke test |
| PRIV-01 | With two accounts, confirm one account cannot read or change the other account's projects or progress. | API authorization tests |
| LEGACY-01 | Open a project with older free-text yarn details and confirm the note remains visible after editing structured fields. | Manual web/mobile smoke test |

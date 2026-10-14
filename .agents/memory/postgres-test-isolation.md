---
name: PostgreSQL integration isolation
description: Safe namespace isolation for PostgreSQL integration tests that share a server with app data.
---

PostgreSQL integration tests must run inside a unique, per-run schema and direct every test connection to that schema. Cleanup should drop only the generated schema, never truncate or delete from shared application tables.

**Why:** Test cleanup must not alter development or production records, even when the test server shares a PostgreSQL instance with the app.

**How to apply:** Create a schema with a validated generated identifier, set `search_path` on all test connections, and remove that schema after closing those connections.

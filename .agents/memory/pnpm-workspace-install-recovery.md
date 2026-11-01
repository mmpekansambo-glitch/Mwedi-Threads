---
name: pnpm workspace install recovery
description: A pnpm install can restore module resolution for API builds when workspace dependencies appear missing.
---

When an API bundle cannot resolve imports such as `jpeg-js` and `pngjs`, running `pnpm install` at the workspace root restored dependency resolution, even though pnpm reported the lockfile was up to date.

**Why:** The API workflow could not build until the workspace install refreshed local package links.

**How to apply:** When a pnpm workspace build reports unresolved imports, try a root `pnpm install` before changing dependency declarations. Rebuild and verify before making package changes.

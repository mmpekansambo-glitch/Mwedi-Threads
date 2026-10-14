---
name: Clerk API authentication tests
description: How to exercise Clerk session validation locally without real credentials or a frontend browser handshake.
---

For API authentication tests against a Clerk development instance, send a locally signed session JWT as a Bearer token through the real Clerk middleware. A `__session` cookie alone can be treated as unauthenticated because development instances require the separate Clerk dev-browser token and browser handshake.

**Why:** A cookie-based test without the dev-browser token is rejected before the session JWT is validated, which does not test the API's intended bearer-token verification boundary.

**How to apply:** Generate an ephemeral RSA keypair and a short-lived Clerk-format session JWT in the test, pass its public PEM through `CLERK_JWT_KEY`, and sign with the private key. Keep invalid-signature and missing-token cases, and restore any environment variables after the test.

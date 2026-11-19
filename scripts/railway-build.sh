#!/bin/bash
# Builds everything the Railway server hands out: the API, the website and
# the phone app files for Expo Go. Railway runs this (see railway.json).
set -euo pipefail

# The website reads the Clerk key at build time.
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/indigoloom-web run build
pnpm --filter @workspace/api-server run build

# The phone app needs the public address it will be served from.
DOMAIN="${EXPO_PUBLIC_DOMAIN:-${RAILWAY_PUBLIC_DOMAIN:-}}"
if [ -n "$DOMAIN" ]; then
  if ! BASE_PATH=/mobile/ EXPO_PUBLIC_DOMAIN="$DOMAIN" \
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-}" \
      pnpm --filter @workspace/indigoloom-mobile run build; then
    echo "WARNING: the phone app build failed; the website and API still deploy." >&2
  fi
else
  echo "WARNING: no Railway public domain yet, so the phone app was not built. Generate a domain in Railway and redeploy." >&2
fi

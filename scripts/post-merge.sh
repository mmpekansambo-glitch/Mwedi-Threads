#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db run prepare-users
pnpm --filter db push

#!/bin/bash
# Build script that ensures VITE_API_URL is set

export VITE_API_URL="${VITE_API_URL:-https://easytax-api-staging.onrender.com}"
exec pnpm --filter @easytax/web build "$@"

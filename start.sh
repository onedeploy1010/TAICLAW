#!/bin/sh
export NODE_ENV=production
export PORT=${PORT:-5000}
exec npx tsx server/index.ts

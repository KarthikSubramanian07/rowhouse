#!/usr/bin/env bash
# Idempotent Cloudflare provisioning for Rowhouse.
# Creates D1, R2 buckets, KV namespaces, and the job queues. Safe to re-run;
# resources that already exist are left alone. Prints the ids you paste into
# apps/api/wrangler.jsonc (the REPLACE_WITH_* placeholders).
#
# Prereq: run `wrangler login` once, and enable R2 in the dashboard. This script
# does not deploy anything.
set -euo pipefail

cd "$(dirname "$0")/apps/api"
WR="pnpm exec wrangler"

echo "Rowhouse: provisioning Cloudflare (free tier)"
echo

create() { echo "> $1"; shift; "$@" 2>&1 | sed 's/^/   /' || echo "   (already exists or partial; check output above)"; }

echo "[D1 database]"
create "d1 create rowhouse" $WR d1 create rowhouse

echo
echo "[R2 buckets]"
create "r2 bucket rowhouse-audio"        $WR r2 bucket create rowhouse-audio
create "r2 bucket rowhouse-fingerprints" $WR r2 bucket create rowhouse-fingerprints
create "r2 bucket rowhouse-media"        $WR r2 bucket create rowhouse-media

echo
echo "[KV namespaces]"
create "kv SESSIONS" $WR kv namespace create SESSIONS
create "kv CONFIG"   $WR kv namespace create CONFIG

echo
echo "[Queues]"
create "queue rowhouse-jobs"     $WR queues create rowhouse-jobs
create "queue rowhouse-jobs-dlq" $WR queues create rowhouse-jobs-dlq

cat <<'EOF'

Next steps (see SETUP.md):
  1. Paste the D1 database_id and the two KV ids above into
     apps/api/wrangler.jsonc (replace the REPLACE_WITH_* values).
  2. cd apps/api && pnpm db:migrate:remote
  3. pnpm deploy         (deploys the API Worker, then Pages)
  4. Point the web proxy at the Worker:
     wrangler pages secret put PUBLIC_API_ORIGIN --project-name rowhouse-gg
EOF

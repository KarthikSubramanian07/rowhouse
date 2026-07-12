#!/usr/bin/env bash
# Idempotent Cloudflare provisioning for Rowhouse.
# Creates D1, R2 buckets, KV namespaces, and the job queue. Safe to re-run —
# resources that already exist are left alone. Prints the IDs you paste into
# apps/api/wrangler.jsonc (the REPLACE_WITH_* placeholders).
#
# Prereq: `wrangler login` once. This script does NOT deploy anything.
set -euo pipefail

cd "$(dirname "$0")/apps/api"
WR="pnpm exec wrangler"

echo "▍ Rowhouse — provisioning Cloudflare (free tier)"
echo

create() { echo "→ $1"; shift; "$@" 2>&1 | sed 's/^/   /' || echo "   (already exists or partial — check output above)"; }

echo "── D1 database ─────────────────────────────────────────"
create "d1 create rowhouse" $WR d1 create rowhouse

echo
echo "── R2 buckets ──────────────────────────────────────────"
create "r2 bucket rowhouse-audio"        $WR r2 bucket create rowhouse-audio
create "r2 bucket rowhouse-fingerprints" $WR r2 bucket create rowhouse-fingerprints
create "r2 bucket rowhouse-media"        $WR r2 bucket create rowhouse-media

echo
echo "── KV namespaces ───────────────────────────────────────"
create "kv SESSIONS" $WR kv namespace create SESSIONS
create "kv CONFIG"   $WR kv namespace create CONFIG

echo
echo "── Queues ──────────────────────────────────────────────"
create "queue rowhouse-jobs"     $WR queues create rowhouse-jobs
create "queue rowhouse-jobs-dlq" $WR queues create rowhouse-jobs-dlq

cat <<'EOF'

────────────────────────────────────────────────────────────
Next steps (see SETUP.md):
  1. Paste the D1 database_id + the two KV ids above into
     apps/api/wrangler.jsonc (replace the REPLACE_WITH_* values).
  2. cd apps/api && pnpm db:migrate:remote
  3. pnpm deploy         (deploys the API Worker, then Pages)
  4. Set the web proxy target:
     wrangler pages secret put PUBLIC_API_ORIGIN --project-name rowhouse
────────────────────────────────────────────────────────────
EOF

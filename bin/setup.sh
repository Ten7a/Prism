#!/usr/bin/env sh
# One-shot bootstrap: ensures .env exists, generates BETTER_AUTH_SECRET if blank,
# brings up Postgres, runs migrations + seed, then starts the app.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
	echo "No .env found — copying from .env.example."
	cp .env.example .env
fi

# Generate BETTER_AUTH_SECRET if unset / empty.
current="$(grep -E '^BETTER_AUTH_SECRET=' .env | head -n1 | sed -E 's/^BETTER_AUTH_SECRET=//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')"
if [ -z "$current" ]; then
	if ! command -v openssl >/dev/null 2>&1; then
		echo "openssl not found; please set BETTER_AUTH_SECRET in .env manually." >&2
		exit 1
	fi
	secret="$(openssl rand -hex 32)"
	# Portable in-place edit: write to .bak then unlink.
	sed -i.bak -E "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=\"$secret\"|" .env
	rm -f .env.bak
	echo "Generated BETTER_AUTH_SECRET in .env."
fi

echo "Starting Postgres…"
docker compose up -d postgres

echo "Running migrations…"
docker compose run --rm app npm run db:migrate

echo "Seeding token packs…"
docker compose run --rm app npm run db:seed

echo "Starting app…"
docker compose up -d app

ORIGIN="$(grep -E '^ORIGIN=' .env | head -n1 | sed -E 's/^ORIGIN=//; s/^"(.*)"$/\1/' )"
echo "Prism is running at ${ORIGIN:-http://localhost:3000}"

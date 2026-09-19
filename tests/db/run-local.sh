#!/usr/bin/env bash
# รัน DB test บน Postgres ในเครื่อง: สร้างฐานใหม่ → จำลอง Supabase → drizzle-kit migrate → vitest
# ใช้: TEST_PG_URL=postgresql://postgres@127.0.0.1:55432 npm run test:db
set -euo pipefail
BASE="${TEST_PG_URL:-postgresql://postgres@127.0.0.1:55432}"
DB="twin_test_$$"
psql "$BASE/postgres" -qc "create database $DB"
trap 'psql "$BASE/postgres" -qc "drop database if exists $DB with (force)"' EXIT
psql "$BASE/$DB" -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/supabase-stub.sql"
NUXT_DATABASE_URL="$BASE/$DB" npx drizzle-kit migrate
TEST_DATABASE_URL="$BASE/$DB" npx vitest run tests/db

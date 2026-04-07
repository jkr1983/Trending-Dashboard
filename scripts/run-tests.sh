#!/usr/bin/env bash
# run-tests.sh — Run all tests locally (backend + frontend)
# Usage: ./scripts/run-tests.sh [--coverage]

set -e

COVERAGE=""
if [[ "$1" == "--coverage" ]]; then
  COVERAGE="1"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0

print_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

print_header "📡 TrendPulse v3.0 — Test Suite"
echo "Root: $ROOT_DIR"

# ─── Backend Tests ─────────────────────────────────────────────────────────────
print_header "🟢 Backend Tests (Jest + Supertest + Nock)"
cd "$ROOT_DIR/backend"
if [ ! -d node_modules ]; then
  echo "Installing backend dependencies..."
  npm install
fi
if [ -n "$COVERAGE" ]; then
  npm run test:coverage && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
else
  npm test && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
fi

# ─── Frontend Tests ────────────────────────────────────────────────────────────
print_header "🔵 Frontend Tests (React Testing Library)"
cd "$ROOT_DIR/frontend"
if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
if [ -n "$COVERAGE" ]; then
  npm run test:coverage && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
else
  npm test && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
fi

# ─── Summary ───────────────────────────────────────────────────────────────────
print_header "📊 Results"
echo "  ✅ Passed suites: $PASS"
echo "  ❌ Failed suites: $FAIL"
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠️  Some tests failed. See output above."
  exit 1
else
  echo "  🎉 All tests passed!"
  exit 0
fi

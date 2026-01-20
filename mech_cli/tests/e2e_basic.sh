#!/bin/bash
set -e

# E2E tests for mech CLI
# Requires a display (WebView dependency)
# Uses hypermap-example.deno.dev as test server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MECH_BIN="${SCRIPT_DIR}/../target/debug/mech_cli"

# Use temp paths for isolation from any running daemon
export MECH_SOCKET_PATH=$(mktemp -u /tmp/mech-test.XXXXXX.sock)
export MECH_PID_PATH=$(mktemp /tmp/mech-test.XXXXXX.pid)

cleanup() {
    echo "Cleaning up..."
    "$MECH_BIN" stop 2>/dev/null || true
    rm -f "$MECH_SOCKET_PATH" "$MECH_PID_PATH"
}
trap cleanup EXIT

if [ ! -x "$MECH_BIN" ]; then
    echo "ERROR: mech_cli binary not found at $MECH_BIN"
    echo "Run 'cargo build' first"
    exit 1
fi

echo "=== Starting daemon ==="
"$MECH_BIN" start &
DAEMON_PID=$!
sleep 2  # Give daemon time to start

# Verify daemon is running
if [ ! -e "$MECH_SOCKET_PATH" ]; then
    echo "FAIL: Daemon did not create socket"
    exit 1
fi
echo "PASS: Daemon started"

echo "=== Test: Open tab ==="
"$MECH_BIN" open https://hypermap-example.deno.dev/
sleep 3  # Give webview time to load

echo "=== Test: Show tab ==="
OUTPUT=$("$MECH_BIN" show 1)
echo "$OUTPUT"

# Check that we got some hypermap content
if echo "$OUTPUT" | grep -q "nav"; then
    echo "PASS: Show displays nav"
else
    echo "FAIL: Show missing expected content 'nav'"
    echo "Got: $OUTPUT"
    exit 1
fi

if echo "$OUTPUT" | grep -q "sentimentAnalysisLocal"; then
    echo "PASS: Show displays sentimentAnalysisLocal"
else
    echo "FAIL: Show missing expected content 'sentimentAnalysisLocal'"
    exit 1
fi

if echo "$OUTPUT" | grep -q "stocks"; then
    echo "PASS: Show displays stocks"
else
    echo "FAIL: Show missing expected content 'stocks'"
    exit 1
fi

echo "=== Test: Tabs command ==="
TABS_OUTPUT=$("$MECH_BIN" tabs)
echo "$TABS_OUTPUT"
if echo "$TABS_OUTPUT" | grep -q "hypermap-example.deno.dev"; then
    echo "PASS: Tabs lists the open tab"
else
    echo "FAIL: Tabs missing expected URL"
    exit 1
fi

echo "=== Test: Open named tab ==="
"$MECH_BIN" open https://hypermap-example.deno.dev/ --name stocks
sleep 3

echo "=== Test: Show by name ==="
OUTPUT=$("$MECH_BIN" show stocks)
if echo "$OUTPUT" | grep -q "nav"; then
    echo "PASS: Show by name works"
else
    echo "FAIL: Show by name failed"
    exit 1
fi

echo "=== Test: Close by name ==="
"$MECH_BIN" close stocks
echo "PASS: Close by name completed"

echo "=== Test: Close tab ==="
"$MECH_BIN" close 1
echo "PASS: Close completed"

echo "=== Test: Stop daemon ==="
"$MECH_BIN" stop
sleep 1

if [ -e "$MECH_SOCKET_PATH" ]; then
    echo "FAIL: Socket not cleaned up after stop"
    exit 1
fi
echo "PASS: Daemon stopped cleanly"

echo ""
echo "=============================="
echo "SUCCESS: All E2E tests passed!"
echo "=============================="

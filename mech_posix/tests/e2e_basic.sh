#!/bin/bash
set -e

# E2E tests for mech CLI
# Requires a display (WebView dependency)
# Uses hypermap-example.deno.dev as test server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MECH_BIN="${SCRIPT_DIR}/../target/debug/mech"

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

# Wait for socket to appear (with timeout)
for i in $(seq 1 20); do
    if [ -e "$MECH_SOCKET_PATH" ]; then
        break
    fi
    sleep 0.5
done

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

echo "=== Test: Use control (navigate to stocks) ==="
"$MECH_BIN" use 1:stocks
sleep 2  # Wait for navigation

OUTPUT=$("$MECH_BIN" show 1)
echo "$OUTPUT"
if echo "$OUTPUT" | grep -q "market"; then
    echo "PASS: Use navigated to stocks page (shows market)"
else
    echo "FAIL: Use did not navigate correctly"
    echo "Got: $OUTPUT"
    exit 1
fi

echo "=== Test: Fork tab ==="
"$MECH_BIN" fork 1 --name stocks-copy
sleep 2  # Wait for fork to load

# Verify the forked tab exists and has the same content
OUTPUT=$("$MECH_BIN" show stocks-copy)
if echo "$OUTPUT" | grep -q "market"; then
    echo "PASS: Fork created tab with same content"
else
    echo "FAIL: Fork did not preserve navigation state"
    echo "Got: $OUTPUT"
    exit 1
fi

echo "=== Test: Tabs shows forked tab ==="
TABS_OUTPUT=$("$MECH_BIN" tabs)
echo "$TABS_OUTPUT"
if echo "$TABS_OUTPUT" | grep -q "stocks-copy"; then
    echo "PASS: Tabs shows forked tab"
else
    echo "FAIL: Forked tab not in tabs list"
    exit 1
fi

echo "=== Test: Close forked tab ==="
"$MECH_BIN" close stocks-copy
echo "PASS: Closed forked tab"

echo "=== Test: Set value ==="
# Set a value (we can't easily verify the DOM changed, but verify no error)
"$MECH_BIN" set 1:market/acrn/submitOrder/quantity 10
echo "PASS: Set command executed without error"

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

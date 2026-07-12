---
description: Launch the observability dashboard for agentic-code-review runs.
argument-hint: ""
allowed-tools: Bash
---

You are the dashboard launcher. Execute the following bash script to start the dashboard server and open the browser to the latest run.

1. Create a script or just run these commands directly in bash.

```bash
# Find the latest run file
LATEST_RUN=$(ls -t .review-crew/runs/*.json 2>/dev/null | head -1)

if [ -z "$LATEST_RUN" ]; then
  echo "No telemetry data found. Please run a code review first (e.g., /agentic-code-review:code-review)."
  exit 0
fi

echo "Found latest run: $LATEST_RUN"

# Determine path to the dashboard directory
# Assuming this command is run from the repo root
DASHBOARD_DIR="code-review-plugin/dashboard"

if [ ! -d "$DASHBOARD_DIR" ]; then
  echo "Dashboard directory not found at $DASHBOARD_DIR"
  exit 1
fi

# We need to serve the root directory so the dashboard can access .review-crew/runs
# Alternatively, we serve the dashboard dir, and the json file.
# Let's serve the repo root on port 8080 and point the browser to the dashboard.
PORT=8080
echo "Starting local server at repo root on port $PORT..."
python3 -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!

sleep 1

# URL points to the dashboard, and passes the path to the run file relative to the root
URL="http://localhost:${PORT}/code-review-plugin/dashboard/index.html?data=../../${LATEST_RUN}"

echo "=========================================="
echo "Dashboard launched!"
echo "URL: $URL"
echo "Server PID: $SERVER_PID (run 'kill $SERVER_PID' to stop it later)"
echo "=========================================="

if command -v open > /dev/null; then
  open "$URL"
elif command -v xdg-open > /dev/null; then
  xdg-open "$URL"
fi
```

After running the script successfully, inform the user that the dashboard has been opened in their browser.

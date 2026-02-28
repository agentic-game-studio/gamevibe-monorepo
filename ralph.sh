#!/bin/bash
# Ralph - GameVibe Autonomous Agent Loop

set -e

TOOL="${1:-claude}"
MAX_ITERATIONS="${2:-10}"

echo "Starting Ralph loop with $TOOL (max $MAX_ITERATIONS iterations)"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i/$MAX_ITERATIONS ==="

  if [ "$TOOL" = "amp" ]; then
    claude --dangerously-allow-all < prompt.md
  else
    claude --print .
  fi

  # Check for completion signal
  if grep -q "<promise>COMPLETE</promise>" /tmp/ralph_output.txt 2>/dev/null; then
    echo "Task complete!"
    exit 0
  fi
done

echo "Max iterations reached"
exit 1

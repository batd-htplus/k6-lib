#!/bin/bash
# Legacy wrapper — gọi k6-lib run (cross-platform)
# Usage: bash run-k6.sh [options] ---> k6-lib run [options]

DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/dist/cli/run.js" "$@"

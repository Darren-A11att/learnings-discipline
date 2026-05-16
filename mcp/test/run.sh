#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node test_parse.mjs
node test_match.mjs
echo "all MCP tests passed"

#!/usr/bin/env bash
# Verify DoD items for v1.0.0-monorepo-codex.
# Exit non-zero on any failure. Print pass/fail per check.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
ok()   { printf "  \033[32mOK\033[0m  %s\n" "$1"; }
nok()  { printf "  \033[31mFAIL\033[0m %s\n" "$1"; fail=$((fail+1)); }

# F1: pnpm-workspace.yaml exists with apps/*
if grep -q "apps/\*" pnpm-workspace.yaml 2>/dev/null; then ok "F1 pnpm-workspace.yaml apps/*"; else nok "F1 pnpm-workspace.yaml"; fi

# F2: three workspaces
for w in apps/core apps/server apps/web; do
  [ -f "$w/package.json" ] || nok "F2 missing $w/package.json"
done
[ -f apps/core/package.json ] && [ -f apps/server/package.json ] && [ -f apps/web/package.json ] && ok "F2 three workspaces"

# F4 / N10: src/ baseline preserved
src_count=$(find src -type f | wc -l | tr -d ' ')
expected=72
if [ "$src_count" = "$expected" ]; then ok "F4/N10 src/ baseline (${src_count} files)"; else nok "F4/N10 src/ baseline mismatch (got ${src_count}, want ${expected})"; fi

# F16, F26, F27: Anthropic removed everywhere under apps/
matches=$(grep -rln "@anthropic-ai/sdk\|@langchain/anthropic\|ANTHROPIC_API_KEY" apps/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$matches" = "0" ]; then ok "F16/F26/F27 no Anthropic refs under apps/"; else nok "F16/F26/F27 anthropic refs found ($matches)"; fi

# F23: no MCP files
mcp=$(find apps/server -name "mcp-proxy*" -o -name "hypurrquant-mcp-server*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$mcp" = "0" ]; then ok "F23 no MCP files"; else nok "F23 MCP files present"; fi
mcp_endpoint=$(grep -rln "tool-result\|/tools/execute" apps/server/src 2>/dev/null | wc -l | tr -d ' ')
if [ "$mcp_endpoint" = "0" ]; then ok "F23 no MCP endpoints"; else nok "F23 MCP endpoints in source"; fi

# F28: no Next.js API routes in apps/web
api_files=$(find apps/web/src/app/api -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$api_files" = "0" ]; then ok "F28 apps/web has no app/api"; else nok "F28 apps/web has API routes"; fi

# F31: all web fetch() lives in lib/http
fetch_outside=$(grep -rln "fetch(" apps/web/src/{components,app} 2>/dev/null | grep -v "lib/http" | wc -l | tr -d ' ')
if [ "$fetch_outside" = "0" ]; then ok "F31 fetch() only in lib/http"; else nok "F31 fetch() outside lib/http"; fi

# F32: no loose http<any|unknown>
loose=$(grep -rn "http<" apps/web/src 2>/dev/null | grep -E "http<(any|unknown)>" | wc -l | tr -d ' ')
if [ "$loose" = "0" ]; then ok "F32 no loose http<T>"; else nok "F32 loose http<T>"; fi

# N7: workspace:* refs
ws_core_server=$(grep -c "\"@seabw/core\": \"workspace:\\*\"" apps/server/package.json 2>/dev/null || echo 0)
ws_core_web=$(grep -c "\"@seabw/core\": \"workspace:\\*\"" apps/web/package.json 2>/dev/null || echo 0)
if [ "$ws_core_server" -ge 1 ] && [ "$ws_core_web" -ge 1 ]; then ok "N7 workspace:* refs"; else nok "N7 workspace:* missing"; fi

# N8/N9: server↔web source imports
n8=$(grep -rn "from ['\"]@seabw/server" apps/web/src 2>/dev/null | wc -l | tr -d ' ')
n9=$(grep -rn "from ['\"]@seabw/web" apps/server/src 2>/dev/null | wc -l | tr -d ' ')
if [ "$n8" = "0" ]; then ok "N8 web ↛ server source imports"; else nok "N8 web→server imports"; fi
if [ "$n9" = "0" ]; then ok "N9 server ↛ web source imports"; else nok "N9 server→web imports"; fi

if [ "$fail" -eq 0 ]; then
  echo
  printf "\033[32mAll DoD checks passed\033[0m\n"
  exit 0
else
  echo
  printf "\033[31m%d check(s) failed\033[0m\n" "$fail"
  exit 1
fi

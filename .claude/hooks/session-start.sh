#!/bin/bash
# SessionStart hook for Claude Code on the web: make the repo testable out of the box.
# Ensures the Node version pinned in .node-version, activates Yarn 4, and installs deps.
# Idempotent and non-interactive; only runs in the remote (web) environment.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"

# --- Node (from .node-version; base images may ship something older) ---
want="$(cat .node-version)"
if [ "$(node -v 2>/dev/null || true)" != "v$want" ]; then
	case "$(uname -m)" in
		x86_64) arch=x64 ;;
		aarch64 | arm64) arch=arm64 ;;
		*) echo "session-start: unsupported architecture $(uname -m)" >&2; exit 1 ;;
	esac
	dir="$HOME/.local/node-v$want-linux-$arch"
	if [ ! -x "$dir/bin/node" ]; then
		echo "session-start: installing Node v$want"
		mkdir -p "$dir"
		curl -fsSL "https://nodejs.org/dist/v$want/node-v$want-linux-$arch.tar.xz" | tar -xJ -C "$dir" --strip-components=1
	fi
	export PATH="$dir/bin:$PATH"
	echo "export PATH=\"$dir/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
echo "session-start: using node $(node -v)"

# --- Yarn 4 via Corepack ---
# Fetch Corepack's Yarn release from npm (repo.yarnpkg.com is often blocked by egress policy), and
# pre-approve the one git-sourced transitive dependency so `yarn install` stays non-interactive.
export COREPACK_NPM_REGISTRY="${COREPACK_NPM_REGISTRY:-https://registry.npmjs.org}"
export YARN_APPROVED_GIT_REPOSITORIES="https://github.com/evs-broadcast/node-asn1.git"
{
	echo "export COREPACK_NPM_REGISTRY=\"$COREPACK_NPM_REGISTRY\""
	echo "export YARN_APPROVED_GIT_REPOSITORIES=\"$YARN_APPROVED_GIT_REPOSITORIES\""
} >> "$CLAUDE_ENV_FILE"
corepack enable >/dev/null 2>&1 || true
corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate

# --- Dependencies ---
# Tests, lint, dev and check-types all resolve @companion-app/shared to its TS sources (via the
# `companion:source` export condition) and check-types self-builds, so no `yarn build:ts` is needed.
yarn install

echo "session-start: environment ready"

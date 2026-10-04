#!/usr/bin/env bash
# Build the GitHub release notes for a tag, from its section of CHANGELOG.md
# Usage: tools/build_release_notes.sh v5.1.0
set -euo pipefail

TAG="$1"
VERSION="${TAG#v}"
CHANGELOG="$(dirname "$0")/../CHANGELOG.md"
HEADING="## Companion v${VERSION} - Release Notes"

# The section runs from its heading until the next level-2 heading, with surrounding blank lines trimmed
SECTION=$(awk -v heading="$HEADING" '
	$0 == heading { found = 1; print; next }
	found && /^## / { exit }
	found { print }
' "$CHANGELOG" | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')

if [[ -z "$SECTION" ]]; then
	echo "No '$HEADING' section found in CHANGELOG.md" >&2
	exit 1
fi
if grep -q '<!-- DRAFT -->' <<< "$SECTION"; then
	echo "The CHANGELOG.md section for $TAG is still marked as a draft" >&2
	exit 1
fi

# Compare against the highest stable version below this one
PREVIOUS=$(git tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | { cat; echo "$TAG"; } | sort -uV | grep -B1 -xF "$TAG" | head -n 1)

cat <<EOF
## 📦  Downloads available at
* https://user.bitfocus.io/download

## 💵  Donate to the project at
* open collective https://opencollective.com/companion

${SECTION}

EOF

if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$TAG" ]]; then
	echo
	echo "**Full Changelog**: https://github.com/bitfocus/companion/compare/${PREVIOUS}...${TAG}"
fi

#!/usr/bin/env bash
# sync-integration.sh — vendor the Chickadee Voice integration into a channel.
#
# The Dockerfile does `COPY integration/ ./integration/`, so a channel WITHOUT a
# vendored integration is not merely incomplete — it cannot build an image at
# all. That is how it shipped: `integration/` is excluded from brand-gen (it has
# its own generated, drift-gated repo, and rewriting it here would mint a second
# divergent copy), and nothing filled the gap, so the store ingested both
# channels and every install then failed at the image build.
#
# COMMITTED-TREE ONLY, via `git archive origin/<ref>`: what gets vendored is what
# is pushed, never a dirty working tree. A vendored tree whose SHA nobody else can
# resolve is a provenance claim that cannot be checked — the same rule brand-gen
# itself follows.
#
# Usage: ./scripts/sync-integration.sh [ref] [integration-repo-path] [target-dir]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-main}"
REPO_PATH="${2:-$(cd "$REPO_ROOT/.." && pwd)/chickadee-voice-integration}"
TARGET="${3:-$REPO_ROOT/chickadee/integration}"
PKG="chickadee_voice"

if [ ! -d "$REPO_PATH/.git" ]; then
    echo "Error: $REPO_PATH is not a git repository (pass the Chickadee Voice integration clone path)." >&2
    exit 1
fi

echo "==> Fetching Chickadee Voice integration" >&2
git -C "$REPO_PATH" fetch origin --quiet --tags || true

# Branch first, then a raw commit — a branch named like a SHA prefix would
# otherwise resolve to whichever the local object store happened to match.
if git -C "$REPO_PATH" rev-parse --verify --quiet "origin/$REF^{commit}" >/dev/null; then
    RESOLVED="origin/$REF"
elif git -C "$REPO_PATH" rev-parse --verify --quiet "$REF^{commit}" >/dev/null; then
    RESOLVED="$REF"
else
    echo "Error: '$REF' is neither a branch on origin nor a commit in $REPO_PATH." >&2
    echo "       The integration must be PUSHED before a channel can vendor it." >&2
    exit 1
fi
SHA="$(git -C "$REPO_PATH" rev-parse --short "$RESOLVED^{commit}")"

echo "==> Vendoring integration $RESOLVED ($SHA) → $TARGET" >&2
rm -rf "$TARGET"
mkdir -p "$TARGET"
git -C "$REPO_PATH" archive "$RESOLVED" "custom_components/$PKG" | tar -x -C "$TARGET"

if [ ! -f "$TARGET/custom_components/$PKG/manifest.json" ]; then
    echo "Error: vendored tree has no manifest.json — wrong ref or wrong package name?" >&2
    exit 1
fi
VERSION="$(python3 -c "import json;print(json.load(open('$TARGET/custom_components/$PKG/manifest.json'))['version'])")"
echo "==> Vendored integration v$VERSION (chickadee-voice-integration @ $SHA)" >&2
echo "$SHA"

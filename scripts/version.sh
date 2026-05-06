#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-}"
if [[ ! "$BUMP" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: npm run version -- major|minor|patch"
  exit 1
fi

# 1. Verify
echo "==> Running verify (typecheck + lint + check:schema + test + build)..."
npm run verify

# 2. Compute new version
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP" in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
esac

# 3. Generate changelog entry from commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LAST_TAG" ]]; then
  COMMITS=$(git log --oneline --no-merges "${LAST_TAG}..HEAD" | sed 's/^[a-f0-9]* /- /')
else
  COMMITS=$(git log --oneline --no-merges | sed 's/^[a-f0-9]* /- /')
fi

if [[ -z "$COMMITS" ]]; then
  echo "No commits since last tag. Nothing to release."
  exit 1
fi

echo ""
echo "==> ${CURRENT} → ${NEW_VERSION}"
echo ""
echo "$COMMITS"
echo ""

# 4. Prepend changelog entry
CHANGELOG="CHANGELOG.md"
HEADER="## ${NEW_VERSION}"
ENTRY="${HEADER}

${COMMITS}"

if [[ -f "$CHANGELOG" ]]; then
  # Insert after "# Changelog\n" — write entry to temp file for portable awk
  TEMP=$(mktemp)
  ENTRY_FILE=$(mktemp)
  printf "%s\n" "$ENTRY" > "$ENTRY_FILE"
  awk -v entry_file="$ENTRY_FILE" '
    /^# Changelog/ {
      print
      print ""
      while ((getline line < entry_file) > 0) print line
      close(entry_file)
      next
    }
    { print }
  ' "$CHANGELOG" > "$TEMP"
  mv "$TEMP" "$CHANGELOG"
  rm -f "$ENTRY_FILE"
else
  printf "# Changelog\n\n%s\n" "$ENTRY" > "$CHANGELOG"
fi

# 5. Stage changelog, bump version in one commit + tag
git add "$CHANGELOG"
npm version "$BUMP" --no-git-tag-version
git add package.json
git commit -m "$NEW_VERSION"
git tag "v${NEW_VERSION}"

echo ""
echo "==> Done: v${NEW_VERSION}"
echo "    Run 'git push && git push --tags' to publish."

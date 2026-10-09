#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json › ignoreCommand, run from apps/web): exit 0 skips the build, exit 1 builds.
#
# 1. No preview deployments (owner, 7 Oct 2026: "i dont want preview"): only production, from main, is built. Branches
#    other than main don't deploy at all (vercel.json › git.deploymentEnabled); this is the backstop for anything that
#    still arrives as a preview. CI builds and tests every PR.
# 2. A production merge that changes nothing the app serves — docs, Markdown, CI files, tests — is skipped too (learned
#    from WonderJobs, 9 Oct 2026): the site is already live at that code. When the previous deployment's commit isn't in
#    Vercel's shallow clone, it builds to be safe.
set -u
if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "Skipping: previews are off — only production (main) is built."
  exit 0
fi
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
head="${VERCEL_GIT_COMMIT_SHA:-}"
if [ -z "$prev" ] || [ -z "$head" ] || ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  echo "Previous deployment's commit unknown here — building."
  exit 1
fi
changed="$(git diff --no-renames --name-only "$prev" "$head" 2>/dev/null || true)"
if [ -z "$changed" ]; then
  echo "No changes detected — building to be safe."
  exit 1
fi
if printf '%s\n' "$changed" | grep -qvE '^(docs/|\.github/|e2e/|tests/|LICENSE$)|\.md$'; then
  echo "App changes — building."
  exit 1
fi
echo "Skipping: only docs, CI files or tests changed since the last deployment."
exit 0

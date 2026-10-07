#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json › ignoreCommand, run from apps/web): exit 0 skips the build, exit 1 builds.
#
# No preview deployments (owner, 7 Oct 2026: "i dont want preview"): only production, from main, is built. Branches
# other than main don't deploy at all (vercel.json › git.deploymentEnabled); this is the backstop for anything that
# still arrives as a preview (a manual redeploy, a branch pattern that slips through). CI builds and tests every PR.
set -u
if [ "${VERCEL_ENV:-}" = "production" ]; then
  exit 1
fi
echo "Skipping: previews are off — only production (main) is built."
exit 0

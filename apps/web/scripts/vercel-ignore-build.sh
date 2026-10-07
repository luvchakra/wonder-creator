#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json › ignoreCommand, run from apps/web): exit 0 skips the build, exit 1 builds.
#
# A preview whose commit is a squash merge — "Title (#123)", which is how every PR lands on main — is a commit
# production has already built from main; the work branch only points at it again after the merge. Building it twice
# just holds the build slot (docs/performance.md › Build and deploy). Production builds and every other preview build.
set -u
subject="$(printf '%s\n' "${VERCEL_GIT_COMMIT_MESSAGE:-}" | head -n 1)"
if [ "${VERCEL_ENV:-}" = "preview" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ] && printf '%s\n' "$subject" | grep -qE '\(#[0-9]+\)$'; then
  echo "Skipping: \"${subject}\" is already built for production from main."
  exit 0
fi
exit 1

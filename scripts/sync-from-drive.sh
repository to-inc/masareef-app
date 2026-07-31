#!/usr/bin/env bash
#
# Sync the canonical app source (Google Drive) into this repo, then gate it.
#
#   bash scripts/sync-from-drive.sh
#
# The publish flow is always:  sync → check → commit → push
# Running this instead of copying files by hand is what makes drift impossible;
# Drive is the editing source, this repo is only ever a faithful copy of it.
#
# WHY THE SOURCE PATH IS NOT HARDCODED: it lives under a Google Drive mount whose
# path contains a personal email address and a private shared-drive name. This
# file is PUBLISHED, so the path is supplied at runtime instead:
#
#   export MASAREEF_DRIVE_APP="/path/to/…/masareef/app"     # once, in ~/.zshrc
#   bash scripts/sync-from-drive.sh                          # or pass it as $1
#
# ⚠️ THIS SCRIPT USES `rsync --delete`. If the source were missing or empty — an
# unmounted Drive, a wrong path, a renamed folder — that would DELETE THIS ENTIRE
# REPO, working tree and all. Drive volumes disappear routinely (sleep, sign-out,
# network), so the guards below are not paranoia; they are the normal case.
# Nothing is deleted until the source has been proven to be the real app.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-${MASAREEF_DRIVE_APP:-}}"

die() { echo "❌ $1" >&2; exit 1; }

# ——— guard 1: told where to look at all
if [ -z "$SRC" ]; then
  die "source not set.
   export MASAREEF_DRIVE_APP=\"/path/to/masareef/app\"   (once, in ~/.zshrc)
   or pass it:  bash scripts/sync-from-drive.sh /path/to/masareef/app"
fi

# ——— guard 2: it exists and is a directory (catches an unmounted Drive)
[ -d "$SRC" ] || die "source directory not found: $SRC
   If this is a Google Drive path, the volume may not be mounted. Open it in
   Finder first. NOTHING has been deleted."

# ——— guard 3: it actually looks like this app, not merely some directory.
# An empty-but-present mount point is the dangerous case: it passes guard 2 and
# would then wipe the repo.
for required in package.json vite.config.js src/main.jsx src/api/mock.js; do
  [ -f "$SRC/$required" ] || die "source is missing $required — it does not look like the app.
   Refusing to sync, because --delete would empty this repo. NOTHING has been deleted."
done

# ——— guard 4: never sync a directory onto itself
[ "$(cd "$SRC" && pwd)" != "$REPO" ] || die "source and repo are the same directory."

echo "sync  ← $SRC"
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  "$SRC/" "$REPO/"
echo "      → $REPO"
echo

# ——— gate it. A sync that imports something unpublishable must not look clean.
bash "$REPO/scripts/check-before-publish.sh" || die "sync completed, but the tree is NOT safe to publish (see above).
   Fix it in DRIVE — this repo is a copy, so edits here will be overwritten by
   the next sync."

echo
echo "Next:  git add -A && git commit && git push"

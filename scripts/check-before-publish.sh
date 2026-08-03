#!/usr/bin/env bash
#
# Gate for the PUBLIC repo. Run before every commit and in CI.
#
# This repo is `masareef/app/` ONLY. `docs/` and `backend/` stay in Drive and are
# never published — they carry Dad's real figures, his name, and family context.
#
# TWO DIFFERENT THREATS, and the second is the one that is easy to forget:
#   1. CREDENTIALS — a secret or /exec URL. Rotatable, embarrassing.
#   2. PRIVACY — his name, real spending figures, real merchants. **Not
#      rotatable.** A public repo cannot be un-published: it is cloned, cached,
#      and indexed. A leak here is permanent and it is not our data to leak.
#
# This has already almost happened once: two mock fixtures were pasted verbatim
# from a real-data diagnostic and named the countries the family had travelled to.
# Caught in review before any repo existed. That is why this check exists.
#
# Run:            bash scripts/check-before-publish.sh
# Install a hook: ln -s ../../scripts/check-before-publish.sh .git/hooks/pre-commit
# CI runs it as a gating job before anything is built or deployed.

set -uo pipefail

# Resolve the repo root. As a pre-commit hook $0 is `.git/hooks/pre-commit`, so
# `dirname "$0"/..` lands in `.git/` and the check scans the wrong directory —
# passing happily on a tree full of private files. Found by testing that the hook
# actually BLOCKS a bad commit, which it did not.
if ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" && [ -n "$ROOT" ]; then
  cd "$ROOT"
else
  cd "$(dirname "$0")/.."
fi

fail=0
note() { echo "❌ $1"; fail=1; }
SCAN_EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude=check-before-publish.sh)
# NOTE: every grep below puts the EXCLUDES BEFORE the pattern and uses -e.
# Writing `grep -r -- "$pat" . "${SCAN_EXCLUDES[@]}"` silently breaks the
# excludes (they become filenames) — the check then matches its own term list
# and, worse, the credential scans quietly stop scanning. Verified both ways.

# ——— 1. STRUCTURE: this repo is the app, and only the app.
# If docs/ or backend/ appear, someone has published private material — the
# strongest and cheapest guard, because it fails on the mistake itself rather
# than on any particular string inside it.
for forbidden in docs backend prototype; do
  [ -e "$forbidden" ] && note "'$forbidden/' is present — this repo must contain the app ONLY. docs/ and backend/ stay in Drive."
done
if ls ./*.gs >/dev/null 2>&1 || find . -name '*.gs' -not -path './node_modules/*' -not -path './.git/*' -print -quit 2>/dev/null | grep -q .; then
  note "an Apps Script (.gs) file is present — backend source is never published."
fi

# ——— 2. PRIVACY: personal data that cannot be un-published.
if grep -rIniq "${SCAN_EXCLUDES[@]}" -e "ashraf" . 2>/dev/null; then
  note "his name appears in the tree."
fi
# Merchants pulled verbatim from real-data diagnostics have leaked before — these
# two named the countries the family travelled to. ONLY list terms that genuinely
# come from his sheet: listing invented fixture names (an earlier draft flagged
# "Zaytouna", which we made up) trains people to ignore the check.
# Extend this list when a new one is found, rather than relying on memory.
for term in "Radison" "Radisson" "Ica store"; do
  if grep -rIniq "${SCAN_EXCLUDES[@]}" -e "$term" . 2>/dev/null; then
    note "\"$term\" appears — a real merchant from his sheet. Fixtures must be INVENTED (see src/api/mock.js)."
  fi
done

# ——— 3. CREDENTIALS.
if grep -rIn "${SCAN_EXCLUDES[@]}" --include='.env*' -E "^VITE_GAS_URL=.+" . 2>/dev/null; then
  note "VITE_GAS_URL is populated. It stays empty — the URL is pasted into SetupView at runtime."
fi
if grep -rIn "${SCAN_EXCLUDES[@]}" -E "script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}" . 2>/dev/null | grep -v "…"; then
  note "a real Apps Script deployment URL appears in the tree."
fi
if grep -rIn "${SCAN_EXCLUDES[@]}" -E "sk-ant-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY" . 2>/dev/null; then
  note "something matching an API key or private key is present."
fi

# ——— 4. The PWA's icons must actually be publishable.
# A .gitignore pattern silently excluded all four once; the failure is invisible
# until the app is installed on his phone with a blank home-screen icon.
for icon in apple-touch-icon-180 icon-192 icon-512 maskable-512; do
  f="public/icons/$icon.png"
  [ -f "$f" ] || note "$f is missing."
  # --no-index is required: without it, check-ignore stays silent for files that
  # are already TRACKED, so a newly-added ignore rule would go unnoticed until a
  # fresh clone dropped the icons.
  if [ -d .git ] && [ -f "$f" ] && git check-ignore -q --no-index "$f" 2>/dev/null; then
    note "$f exists but is GITIGNORED — it would never reach the published site."
  fi
done

# ——— 5. Build output and deps must never be tracked.
if [ -d .git ]; then
  for p in node_modules dist; do
    git ls-files --error-unmatch "$p" >/dev/null 2>&1 && note "$p is tracked by git."
  done
fi

# ——— 6. HONESTY. Not a privacy check — a correctness one, gated here because
# this is the last thing that runs before code reaches him. Six null-fabrication
# bugs shipped through this app, every one of them looking fine on screen. Both
# checks run because NEITHER SUBSUMES THE OTHER, proven by mutation:
#   - reverting the format.js primitive is invisible to the render check (the
#     call-site guards still stand) but fails test-format.mjs;
#   - a view coercing its own value with `|| 0` is invisible to the primitive
#     test but fails honest-render.mjs.
# Skipped, loudly, when dependencies are absent — a gate that silently does
# nothing is worse than one that is not there.
if [ -d node_modules ]; then
  if ! npm test --silent >/dev/null 2>&1; then
    note "the app's own tests FAIL — run 'npm test' and read the output."
  fi
else
  echo "  ℹ️  node_modules absent — honesty tests SKIPPED (run 'npm test' in a local clone)."
fi

# ——— 7. THE REPO IS DRIVE PLUS NOTHING.
#
# Drive is the editing source; this repo is only ever a faithful COPY of it
# (README, sync-from-drive.sh). `rsync --delete` guarantees one direction —
# anything in Drive reaches the repo, and anything deleted from Drive leaves it.
# It says nothing about the other direction: a file created HERE, after a sync,
# is invisible to every check above and rides into the commit on `git add -A`.
#
# That is not hypothetical. A `.claude/launch.json` containing a personal home
# directory path was created in this repo to run a preview, passed this gate
# clean, and would have been published — caught only by reading `git status`
# before pushing. This check is that reading, automated.
#
# It flags repo-not-in-Drive ONLY. The reverse needs no check: rsync handles it,
# and a file missing from the repo cannot be published.
if [ -n "${MASAREEF_DRIVE_APP:-}" ] && [ -d "${MASAREEF_DRIVE_APP:-}" ]; then
  # A file RETIRED in Drive is deleted from this working tree by the rsync, but
  # `git ls-files --cached` still lists it until the deletion is STAGED — and it
  # is still in the repo in every sense that matters, because a commit made now
  # would keep it. So it is reported, with the right instruction: the fix is
  # `git add -A`, not another `rm` of a file that is already gone. (Found when
  # the Fraunces subset was retired with the Nile palette, 2026-08-03.)
  extra=""; unstaged=""
  while IFS= read -r f; do
    [ -e "$MASAREEF_DRIVE_APP/$f" ] && continue
    if [ -e "$f" ]; then extra="$extra
    $f"; else unstaged="$unstaged
    $f  (already deleted here — the DELETION is unstaged)"; fi
  done < <(git ls-files --cached --others --exclude-standard 2>/dev/null \
            | grep -v -E '^(node_modules|dist)/' || true)
  if [ -n "$unstaged" ]; then
    note "these files are gone from Drive and from this tree, but a commit would still carry them:$unstaged
   Stage the removal:  git add -A"
  fi
  if [ -n "$extra" ]; then
    note "these files exist in the repo but NOT in Drive:$extra
   The repo is a copy of Drive plus nothing. Either create them in Drive (if they
   belong) or delete them here (if they were scratch). Anything left will publish."
  fi
else
  # Skipped LOUDLY. CI has no Drive mount and legitimately cannot run this — a
  # gate that quietly does nothing is the failure mode this project names most.
  echo "  ℹ️  MASAREEF_DRIVE_APP unset — repo-equals-Drive check SKIPPED (expected in CI)."
fi

if [ "$fail" -eq 0 ]; then
  echo "✅ safe to publish — app only, no personal data, no credentials, tests green"
else
  echo ""
  echo "Nothing has been committed. Fix the above, then run this again."
  echo "Remember: a credential can be rotated. Published personal data cannot."
fi
exit "$fail"

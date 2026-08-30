#!/bin/bash
# ONE COMMAND THAT PRINTS THE GROUND TRUTH.  `npm run preflight`
#
# Installed 2026-08-30 after an audit of 366 prompts found WRONG_ASSUMPTION
# behind 10 wasted round trips: work done against the wrong clone, the wrong
# time of day, an empty clipboard, EGP where the book is EUR. Every one of those
# is a fact that can be READ in under two seconds, and was guessed instead.
#
# Run it at the start of a sitting and before any deploy. It asserts nothing —
# it just refuses to let the facts stay unread.
set -u
SHIP="/private/tmp/masareef-ship"
DRIVE="/Users/Tarek/Library/CloudStorage/GoogleDrive-consult@tarekomran.com/Shared drives/Captain AO Finances"

echo "── WHEN"
echo "   $(date '+%A %Y-%m-%d %H:%M %Z')"

echo "── WHICH TREE"
if [ -d "$SHIP" ]; then
  cd "$SHIP" || exit 1
  echo "   ship worktree : $SHIP"
  echo "   HEAD          : $(git rev-parse --short HEAD 2>/dev/null)  $(git log -1 --format=%s 2>/dev/null | cut -c1-56)"
  git fetch -q origin 2>/dev/null
  L=$(git rev-parse HEAD 2>/dev/null); R=$(git rev-parse origin/main 2>/dev/null)
  # WHICH BRANCH, IF ANY. This tree is a worktree and `main` is checked out in
  # ANOTHER one, so HEAD here is detached — and a detached HEAD whose commit
  # happens to equal origin/main printed a confident «IN SYNC» while `git push`
  # could not work at all. Reported 2026-08-30, after exactly that.
  B=$(git symbolic-ref --quiet --short HEAD 2>/dev/null)
  if [ -z "$B" ]; then
    echo "   branch        : ⚠️  DETACHED HEAD — plain 'git push' will REFUSE."
    echo "                   push with: git push origin HEAD:main  (verify the"
    echo "                   fast-forward first: git merge-base --is-ancestor origin/main HEAD)"
  else
    echo "   branch        : $B"
  fi
  if [ "$L" = "$R" ]; then SYNC='IN SYNC (no local commits)';
  elif git merge-base --is-ancestor "$R" "$L" 2>/dev/null; then SYNC='AHEAD — unpushed commits, fast-forward';
  else SYNC='⚠️  DIVERGED'; fi
  echo "   origin/main   : $(git rev-parse --short origin/main 2>/dev/null)  $SYNC"
  echo "   uncommitted   : $(git status --short | wc -l | tr -d ' ') files"
else
  echo "   ⚠️  ship worktree missing at $SHIP"
fi
echo "   ~/masareef-app: $(git -C ~/masareef-app rev-parse --short HEAD 2>/dev/null || echo '—')  ⚠️ STALE CLONE, do not edit"

echo "── DRIVE"
if ls "$DRIVE" >/dev/null 2>&1; then echo "   readable ✅"
else echo "   ⚠️  UNREADABLE — try 'ls ~/Desktop'; if that fails too it is macOS privacy (TCC), not Drive"; fi

echo "── LIVE APP"
LIVE=$(curl -sS -m 20 https://to-inc.github.io/masareef-app/ 2>/dev/null | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
LOCAL=$(ls "$SHIP/dist/assets/" 2>/dev/null | grep -E '^index-.*\.js$' | head -1)
echo "   live bundle   : ${LIVE:-unreachable}"
echo "   local build   : ${LOCAL:+assets/$LOCAL}"
[ -n "$LIVE" ] && [ -n "$LOCAL" ] && \
  echo "   match         : $([ "assets/$LOCAL" = "$LIVE" ] && echo 'YES — what is live IS this build' || echo '⚠️  NO — the live site is a DIFFERENT build')"

echo "── HIS BOOK'S UNIT"
echo "   HOME_CURRENCY is EUR (his book), not EGP. The app's own HOME_CURRENCY"
echo "   token is EGP — that is the SHEET's unit, a different question."

echo "── CLIPBOARD"
CB=$(osascript -e 'the clipboard as «class utf8»' 2>/dev/null | wc -c | tr -d ' ')
echo "   holds $CB bytes $([ "${CB:-0}" -lt 1000 ] && echo '(not a Code.gs paste)' || echo '(large — verify before telling him to paste)')"

echo "── DEPLOY RITE, if one is coming"
echo "   ⚠️  a full Code.gs paste OVERWRITES lines 75 / 93 / 271 / 303."
echo "   Have him COPY those four out of his editor FIRST. Never supply them from memory."

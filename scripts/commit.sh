#!/usr/bin/env bash
# Commit whatever changed in the data branch checkout and push, rebasing on concurrent writers.
set -e
cd data-branch
git config user.name "taiex-bot"
git config user.email "taiex-bot@users.noreply.github.com"
git add -A
git diff --cached --quiet && { echo "nothing to commit"; exit 0; }
git commit -q -m "$1"
for i in 1 2 3 4 5; do
  if git pull -q --rebase origin data && git push -q origin HEAD:data; then echo "pushed"; exit 0; fi
  sleep $((i * 5))
done
echo "push failed" >&2; exit 1

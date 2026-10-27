#!/usr/bin/env bash
# Prepare dsh-icloud-sync for npm + awesome-dsh-plugin submission.
# usage: bash scripts/release.sh <github-owner> [repo-name]
set -euo pipefail

OWNER="${1:?usage: bash scripts/release.sh <github-owner> [repo-name]}"
REPO="${2:-dsh-icloud-sync}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# 1. write repository / homepage / bugs into package.json
node - "$OWNER" "$REPO" <<'NODE'
const fs = require("node:fs")
const [owner, repo] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const url = `https://github.com/${owner}/${repo}`
pkg.repository = { type: "git", url: `git+${url}.git` }
pkg.homepage = `${url}#readme`
pkg.bugs = { url: `${url}/issues` }
const order = ["name","version","description","type","license","author","repository","homepage","bugs","keywords","os","engines","exports","files","dsh"]
const out = {}
for (const k of order) if (k in pkg) out[k] = pkg[k]
for (const k of Object.keys(pkg)) if (!(k in out)) out[k] = pkg[k]
fs.writeFileSync("package.json", JSON.stringify(out, null, 2) + "\n")
console.log(`package.json -> ${url}`)
NODE

# 2. the single file awesome-dsh-plugin wants
mkdir -p submission
cat > "submission/${OWNER}__${REPO}.yml" <<YAML
url: https://github.com/${OWNER}/${REPO}
name: ${OWNER}/${REPO}
category: ui
description:
  en: "Sync DSH profiles, plugin manifests, and skills between Macs through iCloud Drive, with a settings panel and a bundled dsh-sync CLI."
  zh: "通过 iCloud 云盘在两台 Mac 之间同步 DSH 的 profile、插件清单与技能，自带设置面板与内置的 dsh-sync 命令行。"
icon: https://raw.githubusercontent.com/${OWNER}/${REPO}/main/assets/icon-180.png
YAML
echo "submission/${OWNER}__${REPO}.yml"

# 3. local commit (the repo still needs a remote)
if ! git rev-parse --git-dir >/dev/null 2>&1; then git init -q -b main; fi
git add -A
if git diff --cached --quiet; then
  echo "nothing to commit"
else
  NAME="${GIT_AUTHOR_NAME:-$(git config user.name || true)}"
  EMAIL="${GIT_AUTHOR_EMAIL:-$(git config user.email || true)}"
  if [ -z "$NAME" ] || [ -z "$EMAIL" ]; then
    echo ""
    echo "git identity is empty. run once, then re-run this script:"
    echo "  git config --global user.name \"Your Name\""
    echo "  git config --global user.email \"you@example.com\""
    exit 1
  fi
  git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "dsh-icloud-sync 1.0.0"
  echo "committed as $NAME <$EMAIL>"
fi

cat <<DONE

next:
  npm login && npm publish --access public
  # publish the repo once (no gh needed, create it in the browser):
  #   https://github.com/new  ->  name: ${REPO}, public, no README/LICENSE
  git remote add origin https://github.com/${OWNER}/${REPO}.git
  git push -u origin main
  # then add the "dsh-plugin" topic on the repo page, wait 1 day, and open a PR
  # adding submission/${OWNER}__${REPO}.yml as data/plugins/${OWNER}__${REPO}.yml
  # to https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
DONE
#!/usr/bin/env bash

pnpm run build
version="$(jq -r .version package.json)"
[[ -n "$NIGHTLY" ]] && version="$version-nightly+$(git rev-parse --short HEAD)"
cat scripts/userscript-template.js out/dist-userscript.js > out/dist-userscript2.js
sed -e "s/__VERSION__/$version/g" out/dist-userscript2.js > out/dist-userscript.user.js

#!/usr/bin/env bash

pnpm run build
version="$(jq -r .version package.json)"
[[ -n "$NIGHTLY" ]] && version="$version-nightly+$(git rev-parse --short HEAD)"
templ="$(<scripts/userscript-template.js)"
code="$(<out/dist-userscript.js)"
x1="${templ//###VERSION###/$version}"
x2="${x1//###CODE###/$code}"
printf "%s" "$x2" > out/dist-userscript.user.js

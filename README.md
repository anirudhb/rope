# rope

A Slack client mod focused on power and performance.

Build it yourself:
1. Install tsgo and esbuild
2. `pnpm install`
3. `rm -r out` (due to some bug)
4. `NIGHTLY=1 ./scripts/prepare-userscript.sh` (will mark the version with the current Git commit hash)
5. Install `out/dist-userscript.user.js` in Tampermonkey

## Tampermonkey instructions

Tested in Firefox and Chrome.
1. Install Tampermonkey. Other userscript managers will not work.
2. If using Chrome, grant the "User Scripts" permission in Chrome's extensions page.
3. Set Tampermonkey's config mode to "Advanced". Ensure that "Security > Content Script API" is set to "Userscripts API Dynamic".
4. If using Firefox, ensure "Security > Modify existing CSP headers" and "Experimental > Add TM to the HTML's CSP" are both enabled.
5. Install Rope, either using your own build above, or by clicking this [nightly link](https://github.com/anirudhb/rope/releases/download/nightly/Rope_for_Slack.user.js) (does not auto update, but you can check for updates manually in Tampermonkey)
6. Refresh your page. Enable plugins in Settings > Rope.

Safe mode: add `rope_safe_mode=1` to query parameters (e.g. add `?rope_safe_mode=1` to end of URL)

Disabling it: add `rope_disabled=1` to query parameters (e.g. add `?rope_disabled=1` to end of URL)

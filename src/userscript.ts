/* Userscript entry point */
//import "./main";
//async function sleep(ms: number) {
//  await new Promise(r => setTimeout(r, ms));
//}
//
//async function main() {
//  /* wait for 19 slack chunks
//   * FIXME: deal with changing number of chunks in a better way */
//  while ((window as any).webpackChunkwebapp?.length < 19)
//    await sleep(10);
//
//  await import("./main");
//}
//
//main();

//const globalThis_keys1 = Object.keys(globalThis);
//
//import "./main";
//
//const globalThis_keys2 = Object.keys(globalThis);
//
//// copy keys to unsafeWindow
//const unsafeWindow = globalThis.unsafeWindow;
//
//for (const k of globalThis_keys2)
//  if (!globalThis_keys1.includes(k))
//    unsafeWindow[k] = globalThis[k];

async function main() {
  /* HACK? try to override csp */
  const parsedScripts = await (async function() {
    window.stop();
    const r = await fetch(location.href);
    const t = await r.text();
    const t2 = t.replace(/<meta http-equiv="Content-Security-Policy".*?>/g, "");
    const p = new DOMParser();
    const parsed = p.parseFromString(t2, "text/html");
    const parsedScripts = Array.from(parsed.querySelectorAll("script")).map(s => {
      return {
        type: s.type,
        src: s.src,
        textContent: s.textContent,
      };
    });
    console.log(t2);
    document.documentElement.replaceWith(parsed.documentElement);
    return parsedScripts;
  })();

  await import("./main");

  // rerun scripts
  document.querySelectorAll("script").forEach(s => s.parentNode.removeChild(s));
  for (const s of parsedScripts) {
    const scriptEl = document.createElement("script");
    if (s.type)
      scriptEl.type = s.type;
    if (s.src)
      scriptEl.src = s.src;
    if (s.textContent)
      scriptEl.textContent = s.textContent;
    document.body.appendChild(scriptEl);
  }
}

main();

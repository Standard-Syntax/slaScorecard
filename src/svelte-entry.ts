/**
 * Svelte-bundle entry point.
 *
 * webpack builds this → .tmp/build/svelte-bundle.js (an ES module containing the
 * compiled Svelte App). visual.ts imports it in Phase 2 via:
 *   import "./.tmp/build/svelte-bundle.js";
 *
 * pbiviz's bundled webpack resolves that import because the entry is a plain .js
 * file — pbiviz's webpack.config.js has ['.js'] in resolve.extensions and does
 * NOT need .svelte resolution (the Svelte source was already compiled by our webpack).
 */
import App from "./App.svelte";

export { App as default };

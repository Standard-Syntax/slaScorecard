/**
 * webpack.config.js — SLA Scorecard
 *
 * Dual-entry design:
 *   • visual entry  → .tmp/build/visual.js      — full visual bundle (TS + LESS + Svelte)
 *   • svelte entry  → .tmp/build/svelte-bundle.js — pure Svelte ES module
 *
 * Why two entries?
 *   pbiviz's bundled webpack.config.js (at powerbi-visuals-tools/lib/webpack.config.js)
 *   has resolve.extensions = ['.tsx','.ts','.jsx','.js','.mjs','.css'] — no .svelte.
 *   It CANNOT import .svelte files directly. The svelte-bundle.js workaround:
 *   1. Our project webpack pre-compiles App.svelte → svelte-bundle.js (ES module)
 *   2. visual.ts (in Phase 2) imports that .js file: import "./.tmp/build/svelte-bundle.js"
 *   3. pbiviz's webpack resolves the .js extension and finds the pre-built module.
 *
 * Used in two contexts:
 *   • `npm run build` / `npm run dev` — direct webpack with this config (both entries).
 *   • `pbiviz package` — pbiviz-tools loads this as base, then appends its own
 *     plugins / entry override / output override / loaders. Our svelte-loader and
 *     resolve.extensions (including .svelte) are preserved in the merged config.
 *
 * The postcss-loader rule is conditionally applied only when postcss.config.js
 * is present on disk.
 */

"use strict";

const path = require("path");

/** True when postcss.config.js is resolvable (i.e., Task 1.5 has been run). */
const hasPostcssConfig = (() => {
  try {
    require.resolve("./postcss.config.js");
    return true;
  } catch {
    return false;
  }
})();

/**
 * Controls the svelte-bundle entry.
 * - undefined / false  → both visual + svelte-bundle entries are created (npm run build).
 * - true              → svelte-bundle entry is excluded (pbiviz package uses this).
 *
 * pbiviz's WebPackWrap.configureVisualPlugin() REUSES our entry object and
 * merely appends entry["visual.js"]. It never removes our extra entries.
 * Setting SV_ONLY=true ensures pbiviz doesn't try to compile svelte-entry.ts
 * (which ts-loader can't resolve: .svelte imports).
 */
const svOnly = process.env.SVELTE_ONLY === "true";

module.exports = {
  mode: "development",

  // Multi-entry: visual (full bundle) + svelte-bundle (Svelte-only ES module).
  // svelte-bundle → svelte-bundle.js is imported by visual.ts in Phase 2.
  // When SV_ONLY=true (set by pbiviz), omit svelte-bundle to avoid ts-loader
  // failing on svelte-entry.ts's .svelte import (pbiviz has no svelte-loader).
  entry: svOnly
    ? { visual: "./src/visual.ts" }
    : { visual: "./src/visual.ts", "svelte-bundle": "./src/svelte-entry.ts" },

  output: {
    path: path.resolve(__dirname, ".tmp/build"),
    // [name] produces "visual.js" and "svelte-bundle.js" from the two entries.
    filename: "[name].js",
    library: {
      type: "module",
    },
  },

  // Bundler needs to know which extensions to resolve without explicit suffix.
  resolve: {
    extensions: [".ts", ".js", ".svelte"],
    conditionNames: ["svelte", "browser", "import", "default"],
  },

  module: {
    rules: [
      // ── Svelte ─────────────────────────────────────────────────────────────
      // Wired but inactive until App.svelte exists (Phase 2).
      {
        test: /\.svelte$/,
        use: {
          loader: "svelte-loader",
          options: {
            emitCss: false,
            config: "svelte.config.js",
          },
        },
        exclude: /node_modules/,
      },

      // ── TypeScript ─────────────────────────────────────────────────────────
      // transpileOnly skips type-checking (done by `npm run typecheck`).
      // Setting rootDir: "." resolves TS5011 (rootDir/outDir conflict) that ts-loader
      // derives from tsconfig.json files[] without touching the pbiviz tsconfig.
      // noEmit:true prevents ts-loader from writing .js files (webpack handles output).
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
            configFile: false,
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "bundler",
              rootDir: ".",
              strict: true,
              isolatedModules: true,
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
              forceConsistentCasingInFileNames: true,
              skipLibCheck: true,
              resolveJsonModule: false,
              noEmit: true,
            },
          },
        },
        exclude: /node_modules/,
      },

      // ── LESS ───────────────────────────────────────────────────────────────
      // pbiviz handles final CSS concatenation; we just compile .less → CSS.
      // css-loader with esModule:false + import:false lets webpack ingest the
      // compiled CSS string from less-loader without mini-css-extract-plugin.
      {
        test: /\.less$/,
        use: [
          {
            loader: "css-loader",
            options: {
              esModule: false,
              import: false,
            },
          },
          "less-loader",
        ],
        include: [path.resolve(__dirname, "src"), path.resolve(__dirname, "style")],
      },

      // ── CSS ────────────────────────────────────────────────────────────────
      // postcss-loader processes .css files (e.g. tailwind-output) only when
      // postcss.config.js is present. Wrapped in a conditional guard so the
      // build succeeds before Task 1.5 creates that file.

      // ── Fonts / Binary assets ─────────────────────────────────────────────
      // InterVariable.woff2 is referenced via url() in visual.less.
      // Webpack 5 asset/module emits it to .tmp/build/ and replaces the url().
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: "asset/resource",
      },

      ...(hasPostcssConfig
        ? [
            {
              test: /\.css$/,
              use: ["postcss-loader"],
            },
          ]
        : []),
    ],
  },

  // Enable ES module output format (import/export, async import()).
  experiments: {
    outputModule: true,
  },

  // Suppress excessive sourcemap noise in the terminal during dev.
  devtool: "eval-cheap-module-source-map",
};

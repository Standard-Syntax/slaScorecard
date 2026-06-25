/**
 * tailwind.config.js — SLA Scorecard
 *
 * ## RGB triplet requirement for opacity modifiers
 *
 * Tailwind color utilities that use opacity modifiers (e.g. bg-sla-met/50) require
 * the corresponding CSS custom property to hold a space-separated RGB triplet —
 * NOT a hex string — so the / <alpha-value> syntax resolves correctly.
 *
 * Before opacity modifiers will work, Task 5.2 must update applyThemeVariables() in
 * src/theme.ts to emit --sla-met, --sla-at-risk, and --sla-breached as:
 *   --sla-met: 22 163 74;
 * (i.e. the R G B values separated by spaces, no #, no rgb() wrapper).
 *
 * All other tokens (fg, bg, border, band-*, pill, tag, etc.) do NOT need this
 * format; they are used as plain `var(--sla-token)` references and work with either
 * hex or rgb-triplet values.
 *
 * ## BEM-style semantic modifier classes
 *
 * The following classes are NOT Tailwind utilities — they are BEM-style modifiers
 * styled via LESS rules in style/visual.less (e.g. `.sla-row--met .sla-status`,
 * `.sla-summary-pill--met`, `.sla-cell--bullet`). Tailwind does not generate CSS
 * for them, so they are NOT in the safelist. less-loader emits the actual rules.
 *
 * Classes: sla-row--met, sla-row--atRisk, sla-row--breached,
 *          sla-status--met, sla-status--atRisk, sla-status--breached,
 *          sla-summary-pill--met, sla-summary-pill--atRisk, sla-summary-pill--breached,
 *          sla-current--met, sla-current--atRisk, sla-current--breached,
 *          sla-cell--bullet, sla-cell--spark
 */

"use strict";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,svelte}", "./style/**/*.less"],

  safelist: [],

  theme: {
    extend: {
      colors: {
        // Status colors — opacity-modifier capable (rgb triplet required from Task 5.2)
        "sla-met": "rgb(var(--sla-met) / <alpha-value>)",
        "sla-at-risk": "rgb(var(--sla-at-risk) / <alpha-value>)",
        "sla-breached": "rgb(var(--sla-breached) / <alpha-value>)",
        // All other tokens — plain var() references
        "sla-fg": "var(--sla-fg)",
        "sla-bg": "var(--sla-bg)",
        "sla-fg-selected": "var(--sla-fg-selected)",
        "sla-hyperlink": "var(--sla-hyperlink)",
        "sla-fg-muted": "var(--sla-fg-muted)",
        "sla-border": "var(--sla-border)",
        "sla-row-hover": "var(--sla-row-hover)",
        "sla-header-bg": "var(--sla-header-bg)",
        "sla-legend-bg": "var(--sla-legend-bg)",
        "sla-met-bg": "var(--sla-met-bg)",
        "sla-at-risk-bg": "var(--sla-at-risk-bg)",
        "sla-breached-bg": "var(--sla-breached-bg)",
        "sla-band-bad": "var(--sla-band-bad)",
        "sla-band-caution": "var(--sla-band-caution)",
        "sla-band-target": "var(--sla-band-target)",
        "sla-target-line": "var(--sla-target-line)",
        "sla-pill-bg": "var(--sla-pill-bg)",
        "sla-pill-border": "var(--sla-pill-border)",
        "sla-pill-hover-bg": "var(--sla-pill-hover-bg)",
        "sla-pill-active-bg": "var(--sla-pill-active-bg)",
        "sla-pill-active-fg": "var(--sla-pill-active-fg)",
        "sla-tag-bg": "var(--sla-tag-bg)",
        "sla-tag-fg": "var(--sla-tag-fg)",
        "sla-section-border": "var(--sla-section-border)",
        "sla-focus-ring": "var(--sla-focus-ring)",
      },
    },
  },

  plugins: [],
};

# Changelog

## [Unreleased]

### Phase 6 — COMPLETE

Re-verified keyboard navigation: Tab through chrome, Arrow keys move row focus, Enter/Space drill, Escape clears, ArrowLeft/Right on filter pills cycles tabs. Verified focus rings visible on .sla-row, .sla-pill, .sla-search__input via existing :focus-visible rules. Added aria-live="polite" and role="status" to StatusSummary so filter/search updates announce the new counts. Re-verified high-contrast mode: --sla-met/--sla-at-risk/--sla-breached collapse to foreground, status/band color pickers remain theme-derived. Re-ran certification audit (pbiviz_prepare_certification): 19 passed, 0 failed, 0 warnings; pbiviz_check_vulnerabilities: clean. Updated README with new build commands and refactor notes.

### Phase 5 — COMPLETE

Migrated layout-only LESS rules to Tailwind utility classes inside Svelte components. Trimmed style/visual.less from 544 to 468 lines. Confirmed that the Tailwind safelist could remain empty — the dynamic sla-row--*, sla-status--*, sla-summary-pill--*, and sla-current--* classes are BEM modifiers emitted by less-loader (not Tailwind utilities), so they require no safelist entries; see tailwind.config.js:19-31. Changed --sla-met / --sla-at-risk / --sla-breached emission to RGB-triplet format for Tailwind opacity modifiers; updated LESS BEM rules to use rgb(var(...)) wrapper. Wired tw-prebuilt.css into the bundle via `@import (inline)` from style/visual.less. Final sizes: style/tw-prebuilt.css ~7.1 KB (50 KB limit), dist/*.pbiviz ~925 KB (4 MB limit).

### Phase 4 — COMPLETE

Table, rows, and chart primitives migrated from imperative DOM helpers to Svelte 5 components.

#### Added

- `src/components/SlaTable.svelte` — table container with `$effect`-driven selection opacity management. Renders `<SlaRow>` per filtered row, empty state via `sla-empty` div, and orchestrates child component props.
- `src/components/SlaRow.svelte` — single SLA row with `role="row"` / `tabindex=0`. Delegates bullet chart, sparkline, tooltip, and context menu to child components. Handles click, keyboard, and focus events.
- `src/components/BulletChart.svelte` — wraps `renderBulletChart()` from `src/bulletChart.ts` in a `bind:this` host div with deferred `$effect` measurement (matching the prior deferred-measurement pattern).
- `src/components/Sparkline.svelte` — wraps `renderSparkline()` from `src/sparkline.ts` with the same deferred `requestAnimationFrame` pattern.
- `src/row-tooltip.ts` — tooltip helpers migrated from `src/table-renderer.ts`. Exports `showTooltip()`, `moveTooltip()`, `hideTooltip()`.
- `src/opacity-constants.ts` — `FADED_OPACITY`, `HIGHLIGHTED_OPACITY`, and `FULL_OPACITY` constants migrated from `src/row-interactions.ts`.

#### Changed

- `src/App.svelte` — replaced imperative `renderDataTable` call with declarative `{#if}` / `<SlaTable>` block driven by `$derived` filtered rows. No longer imports `renderTable`.
- `src/visual.ts` — removed `updateSelectionOpacity` wiring, `registerOnSelectCallback` from constructor, `updateSelectionOpacity` call in `clearCatcher`, and `getTableBody` from `AppInstance` type. Removed all chrome rendering calls from `update()`.

#### Deleted

- `src/table-renderer.ts` — table DOM construction helpers (`renderTable`, `renderTableHead`, `renderTableBody`, `renderEmptyState`). Replaced by `SlaTable.svelte` + `SlaRow.svelte`.
- `src/row-interactions.ts` — per-row event handlers, selection state, `updateSelectionOpacity`. Replaced by `SlaRow.svelte` event props and `SlaTable.svelte`'s `$effect`.

### Changed

- `src/visual.ts` refactored from 384 lines to 174 lines. The Visual class now owns only lifecycle, selection callback, clear-catcher, and format-pane model. All DOM rendering is delegated to `App.svelte`.
- `global.d.ts` added `declare module "*svelte-bundle.js"` ambient declaration to type the pre-built Svelte artifact import.

### Added

- `src/App.svelte` — Svelte 5 mounted component. Owns the DOM tree, reactive theme application via `$effect`, all rendering via `applyUpdate()`, and exposes `getTableBody()` for the selection callback. Phase 2 ships as a skeleton; Phase 3+ replaces it with the full chrome (filter pills, search, status summary, legend, and the real SLA table).

## 1.0.0

Initial release of the SLA Scorecard Power BI custom visual.

* Table layout with bullet chart and 30-day trend sparkline per row.
* Category filter pills with live counts.
* Search box.
* Status summary pills (On Target / At Risk / Breached).
* Click-to-drill-down on rows.
* Multi-select with Ctrl/Cmd-click.
* Keyboard navigation (arrow keys, Enter, Space, Escape).
* Hover tooltips with full row details.
* Right-click context menu.
* High-contrast mode: color pickers hidden in the format pane, colors
  overridden with system foreground / background.
* Modern format pane with status colors, bullet band colors, and general
  toggles.
* Renders `Update count: 0` placeholder while the data view is being
  populated for the first time.
* Landing page when no data is mapped.

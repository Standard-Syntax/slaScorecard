# SLA Scorecard

A Power BI custom visual that renders a sortable, filterable scorecard of
service-level agreements. Each row shows an SLA, its owner, current value vs
target as a bullet chart, a 30-day trend sparkline, a status pill, and the
estimated time to breach.

## Visual

The scorecard is laid out as a table:

```
[ filter pills ............ ] [ search box ]
SLA Scorecard                [ Met 13 ] [ At risk 3 ] [ Breached 4 ]
+------+----------+-------+--------+--------+----------------+----------+----------+--------------+
| SLA  | Category | Owner | Current| Target | Performance    | 30D Trend| Status   | Time-to-Breach|
+------+----------+-------+--------+--------+----------------+----------+----------+--------------+
```

* **Filter pills** group SLAs by category with live counts. Click a pill to
  scope the table; click `All` to reset.
* **Search** narrows rows by SLA name.
* **Status summary** on the right shows live counts of each status.
* **Bullet chart** band shows the current value against the target with three
  qualitative bands (bad / caution / on-target) and a target-line marker.
* **Sparkline** shows the 30-day trend; green when trending up, red when
  trending down.

## Data roles

| Role | Kind | Description |
|------|------|-------------|
| `SLA` | Grouping | The SLA name (e.g. *Payment API Uptime*). |
| `Category` | Grouping | Bucket used by the filter pills (e.g. *Platform*). |
| `Owner` | Grouping | Owner display name. The avatar initials are derived. |
| `Current` | Measure | The current performance value. |
| `Target` | Measure | The target value the SLA is measured against. |
| `Time to breach (days)` | Measure | Days until the SLA is expected to breach. |
| `30D trend (comma-separated values)` | Measure | 30 numeric values separated by `,`, `;`, or whitespace, used for the sparkline. |

### Optional fields

* `Time to breach` and `30D trend` are optional. Rows without them render with
  an em-dash (`—`) and a flat trend placeholder respectively.
* `SLA` is used as the drill target; clicking a row triggers
  `host.drill({ roleName: "sla", drillType: DrillType.Down })`.

### Derived values

* `SLA ID` is generated as `SLA-001`, `SLA-002`, ... by row order.
* `Status` is computed from `current` vs `target`:
  * `current <= target − 5 %` (when target is a percentage) → **Breached**
  * `current <= target − 0.5 %` → **At Risk**
  * otherwise → **On Target**
* Owner avatar color is taken from the Power BI color palette, falling back to
  a default palette if the host is unavailable.

## Format pane

| Card | Controls |
|------|----------|
| Status colors | Met / At risk / Breached text and pill colors |
| Bullet band colors | Bad range / Caution / On target background bands |
| General | Toggle filter pills / search / status summary / legend; text size |

### Theme-driven colors

By default, all colors come from the report theme. The visual reads the
following from `host.colorPalette` / `ColorHelper.getThemeColor()`:

| Slot | Theme key | Default fallback |
|------|-----------|------------------|
| `Met` | `positive` | `#16A34A` |
| `At risk` | `neutral` | `#F59E0B` |
| `Breached` | `negative` | `#DC2626` |
| Text | `foreground` | `#111827` |
| Background | `background` | `#FFFFFF` |
| Muted text | `foregroundNeutralTertiary` | `#6B7280` |
| Borders | `foregroundNeutralTertiary` | `#E5E7EB` |
| Row hover | `backgroundLight` | `#F9FAFB` |
| Link / focus ring | `hyperlink` | `#2563EB` |

The format-pane color pickers (status colors, band colors) **default to the
theme color** at runtime. When a user customizes a color via the format pane,
the custom value is persisted and used on subsequent renders. Removing the
override falls back to the theme color again.

The bullet-chart target line is drawn in `var(--sla-target-line)`, which the
visual computes from the theme foreground so it stays visible in both light
and dark themes.

### High contrast

In Windows high-contrast mode, the visual:

* uses `foreground` and `background` from the color palette
* drops the sentiment colors down to `foreground` so contrast is preserved
* hides the status / band color pickers in the format pane
* keeps the bullet chart bands visible by using lightened variants of the
  active foreground color

## Interactions

* **Click a row** to select and drill down.
* **Ctrl/Cmd-click** for multi-select.
* **Enter** or **Space** on a focused row does the same as a click.
* **Arrow Up / Down** moves focus between rows.
* **Escape** clears the selection.
* **Hover** a row for a tooltip with full details.
* **Right-click** a row to open the Power BI context menu.
* **Click empty space** to clear the selection.

## Sort

Rows are sorted by status (Breached → At Risk → On Target), then by
`timeToBreach` ascending, then alphabetically. The sort is internal; the
visual does not consume Power BI's `applyCustomSort` API.

## Keyboard / accessibility

* `supportsKeyboardFocus: true` is set.
* Each row has `tabindex="0"`, `role="row"`, and an `aria-label`.
* Filter pills form a `role="tablist"` and respond to arrow keys.
* Search input has an `aria-label`.
* **Status summary** has `role="status"` and `aria-live="polite"` on the outer
  wrapper so screen readers announce count changes after filter or search.
* Focus rings are visible via `:focus-visible` on `.sla-row`, `.sla-pill`, and
  `.sla-search__input`.
* High-contrast mode: when the host's color palette reports
  `isHighContrast`, the status / band color pickers in the format pane are
  hidden and the rendered colors are swapped to system colors. Status colors
  collapse to the foreground color to preserve contrast.

## Architecture

The visual is split into two layers:

| Layer | File | Responsibility |
|-------|------|----------------|
| **Power BI shell** | `visual.ts` | Lifecycle (`constructor`, `update`, `getFormattingModel`), selection callback, clear-catcher click handler, format-pane model population. |
| **Svelte component** | `App.svelte` | DOM tree ownership, all rendering, reactive theme application, dataView parsing (`applyUpdate`), row/category state, conditional `SlaTable` rendering. |

**Dependency direction:** `visual.ts → App.svelte → (row-builder, SlaTable, SlaRow, BulletChart, Sparkline, theme, settings)`

`visual.ts` never touches the DOM directly after mount. `App.svelte` owns the `.sla-root` div.

### Refactor notes

These notes document the Svelte 5 + Tailwind refactor decisions:

* **Svelte 5 mount pattern.** `App.svelte` is mounted imperatively via
  `mount(App, { target, props })` in `visual.ts`. The Svelte tree owns all DOM;
  `visual.ts` never touches the DOM after mount.

* **LESS / Tailwind split.** LESS holds semantic class names (e.g. `.sla-pill`,
  `.sla-row`). Tailwind handles layout utilities (`flex`, `gap-2`, `p-4`). The
  Tailwind output is a small pre-built CSS file (`tw-prebuilt.css`) safelisted in
  `tailwind.config.js` and inlined into the visual bundle via `@import (inline)`.

* **Theme via CSS variables.** `applyThemeVariables()` pushes `--sla-fg`,
  `--sla-bg`, and `--sla-met` (RGB triplets) onto the root element. Components
  reference these variables for all color decisions, so the visual adapts to
  light/dark/high-contrast themes without code changes.

* **D3 bridge.** `BulletChart.svelte` and `Sparkline.svelte` call
  `renderBulletChart()` / `renderSparkline()` from `$effect` with a deferred
  `requestAnimationFrame` to ensure the DOM dimensions are measured after layout.

* **SlaRow keyboard handlers.** Row-level keyboard handlers (arrow navigation,
  Enter/Space activation) were extracted from `SlaRow.svelte` into
  `row-interactions.ts` to keep the component focused on rendering.

* **Selection opacity.** `SlaTable.svelte`'s `$effect` listens to the
  `selectionManager` and sets `opacity` on each row's root element
  (`FULL_OPACITY` / `FADED_OPACITY` / `HIGHLIGHTED_OPACITY`).

### Build pipeline

Two webpack entry points are built before packaging:

| Entry | Output | Consumed by |
|-------|--------|-------------|
| `src/visual.ts` | `.tmp/build/visual.js` | Power BI host |
| `src/App.svelte` (via `svelte-bundle.ts`) | `.tmp/build/svelte-bundle.js` | `visual.ts` (lazy import) |

The `svelte-bundle.js` artifact is typed via the ambient module declaration in `global.d.ts` (`declare module "*svelte-bundle.js"`).

## Files

```
capabilities.json     data roles, format objects, drill, tooltips
pbiviz.json           visual metadata
tsconfig.json         TypeScript with strict + bundler resolution
eslint.config.mjs     powerbi-visuals recommended config
global.d.ts           ambient declarations for .less / .woff2 / svelte-bundle imports
webpack.config.js     dev/build pipeline for visual + svelte-bundle entries
assets/
  icon.png            Power BI store icon (44×44)
  InterVariable.woff2 Inter Variable font, inlined into the package CSS
src/
  visual.ts           Power BI Visual class — lifecycle, selection, clear-catcher
  App.svelte          Svelte 5 mounted component — owns all rendering
  settings.ts         format-pane card definitions
  types.ts            shared interfaces (SlaRow, SlaStatus, etc.)
  row-builder.ts     data shaping + status classification
  row-tooltip.ts      tooltip helpers (showTooltip, moveTooltip, hideTooltip)
  opacity-constants.ts selection opacity constants (FADED_OPACITY, HIGHLIGHTED_OPACITY, FULL_OPACITY)
  theme.ts            color helpers + theme variable application
  bulletChart.ts      D3 bullet-chart renderer
  sparkline.ts        D3 sparkline renderer
  components/
    SlaTable.svelte   table container — $effect-driven selection opacity, renders SlaRow list
    SlaRow.svelte    single SLA row — click/keyboard/focus events, delegates bullet/sparkline/tooltip
    BulletChart.svelte wraps renderBulletChart() with deferred requestAnimationFrame measurement
    Sparkline.svelte  wraps renderSparkline() with deferred requestAnimationFrame measurement
style/
  visual.less         all styles
```

## Typography

The visual ships with **Inter Variable** as its default font. The woff2 lives
at `assets/InterVariable.woff2` and is referenced from `style/visual.less`:

```less
@font-face {
    font-family: 'Inter Variable';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url('../assets/InterVariable.woff2') format('woff2');
}
```

When the visual is packaged, webpack's asset pipeline inlines the woff2 as a
base64 data URL inside the compiled CSS, so the `.pbiviz` file is fully
self-contained — no extra files are fetched at runtime.

`font-feature-settings` is enabled in the root to get tabular numerals
(`tnum`), the single-storey `a` and `g` (`cv11`), and the open digit set
(`ss01`). These are active whenever Inter Variable is the rendered font.

The full font-family chain is:

```
"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont,
"Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif
```

If Inter fails to load for any reason, the visual falls back to the host
operating system's UI font.

## Build

```bash
# type-check and lint
npx tsc --noEmit
npx eslint .

# dev server (Svelte HMR + Power BI host)
npm run dev

# rebuild Tailwind prebuilt CSS only
npm run build:tw

# rebuild the visual (TypeScript + Svelte → webpack bundle)
npm run build

# package for Power BI
pbiviz package

# run tests
npm run test
```

### Final package size (Phase 5 refactor)

| Artifact | Size | Limit | Notes |
|----------|------|-------|-------|
| `style/tw-prebuilt.css` | ~7.1 KB (7,281 bytes) | 50 KB | Tailwind prebuilt CSS (minified, no safelist). Inlined into the visual bundle via `@import (inline)` in `style/visual.less`. |
| `dist/*.pbiviz` | ~925 KB (946,824 bytes) | 4 MB | Final packaged Power BI visual. Includes the inlined Tailwind CSS, LESS rules, Svelte components, d3 dependencies, and a base64-inlined Inter Variable woff2 font (~352 KB). |
| LESS pipeline output (`lessc visual.less`) | ~16 KB (16,431 bytes) | — | Output of `npx lessc style/visual.less` — visual.less + `@import (inline) tw-prebuilt.css` combined. The .pbiviz also contains a base64-inlined Inter Variable woff2 font (~352 KB) added by webpack's asset pipeline; total inlined CSS in the .pbiviz is ~475 KB. |

If the .pbiviz approaches the 4 MB limit in the future, prune the Tailwind safelist (or move rarely-used utilities to a non-safelist pattern) to keep the Tailwind output small. If `tw-prebuilt.css` exceeds 50 KB, audit the Svelte component markup for utility classes that are not actually used and remove them so Tailwind's source-file scan can drop them.

## License

MIT

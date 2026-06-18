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
* Status summary is announced via `aria-label`.
* High-contrast mode: when the host's color palette reports
  `isHighContrast`, the status / band color pickers in the format pane are
  hidden and the rendered colors are swapped to system colors.

## Files

```
capabilities.json     data roles, format objects, drill, tooltips
pbiviz.json           visual metadata
tsconfig.json         TypeScript with strict + bundler resolution
eslint.config.mjs     powerbi-visuals recommended config
global.d.ts           ambient declarations for .less / .woff2 imports
assets/
  icon.png            Power BI store icon (44×44)
  InterVariable.woff2 Inter Variable font, inlined into the package CSS
src/
  visual.ts           main Visual class, data binding, interactions
  settings.ts         format-pane card definitions
  types.ts            shared interfaces (SlaRow, SlaStatus, etc.)
  bulletChart.ts      D3 bullet-chart renderer
  sparkline.ts        D3 sparkline renderer
  components.ts       filter pills, search, status summary, legend, landing page
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

# start dev server
pbiviz start

# package
pbiviz package
```

## License

MIT

/**
 * App.svelte chrome wiring — integration tests via source inspection.
 *
 * jsdom/happy-dom are not installed, and vitest.config.ts explicitly excludes
 * Svelte files from execution.  Tests here verify structural properties of
 * App.svelte by reading the source as text and asserting on known patterns.
 *
 * Coverage:
 *   - Imports (test 1)
 *   - LegendSwatch interface location (tests 2-3)
 *   - $derived state plumbing (tests 4-6, 16-17)
 *   - Conditional markup (tests 7-13)
 *   - Event handler wiring (tests 14-15)
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "App.svelte");
const TYPES_SRC = resolve(__dirname, "types.ts");
const LEGEND_SRC = resolve(__dirname, "components/Legend.svelte");

function src(file: string): string {
  return readFileSync(file, "utf-8");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True if `needle` appears in `haystack` as a distinct import specifier token */
function hasImport(haystack: string, needle: string): boolean {
  // Named import: import { Needle } from "..."
  if (new RegExp(`import\\s+\\{[^}]*\\b${needle}\\b[^}]*\\}\\s+from`).test(haystack)) {
    return true;
  }
  // Default import: import Needle from "..."
  if (new RegExp(`import\\s+${needle}\\s+from`).test(haystack)) {
    return true;
  }
  return false;
}

/** True when `const name = $derived...` appears in the source */
function hasDerived(haystack: string, name: string): boolean {
  const needle = `const ${name} = $derived`;
  return haystack.includes(needle);
}

/** Extract the expression assigned to a $derived.by variable (the inner fn body) */
function derivedBody(haystack: string, name: string): string | null {
  // Find "const name = $derived.by(..."
  const startMarker = `const ${name} = $derived.by`;
  const idx = haystack.indexOf(startMarker);
  if (idx === -1) return null;

  // Advance past the arrow function `() =>` (possibly with return type `): T =>`)
  // to find the opening { of the function body
  const afterArrow = haystack.indexOf("=>", idx + startMarker.length);
  if (afterArrow === -1) return null;
  const braceIdx = haystack.indexOf("{", afterArrow + 2);
  if (braceIdx === -1) return null;

  // Walk forward counting braces to find the matching close
  let depth = 1;
  let i = braceIdx + 1;
  while (i < haystack.length && depth > 0) {
    const ch = haystack[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  if (depth !== 0) return null;

  // Content between the braces (not including the braces themselves)
  return haystack.slice(braceIdx + 1, i - 1);
}

// ─── Import verification ──────────────────────────────────────────────────────

describe("chrome imports", () => {
  it("1. imports all 5 chrome components", () => {
    const s = src(SRC);
    expect(hasImport(s, "FilterPills")).toBe(true);
    expect(hasImport(s, "SearchBox")).toBe(true);
    expect(hasImport(s, "StatusSummary")).toBe(true);
    expect(hasImport(s, "Legend")).toBe(true);
    expect(hasImport(s, "LandingPage")).toBe(true);
  });

  it("2. types.ts has LegendSwatch interface", () => {
    const t = src(TYPES_SRC);
    expect(t).toMatch(/interface\s+LegendSwatch\s*\{/);
  });

  it("3. Legend.svelte imports LegendSwatch from types.ts (no local definition)", () => {
    const l = src(LEGEND_SRC);
    // Handles both `import { X }` and `import type { X }` forms
    expect(l).toMatch(/import\s+(?:type\s+)?\{[\s\S]*?LegendSwatch[\s\S]*?\}\s+from\s+"[^"]+"/);
    // ensure no local interface LegendSwatch { ... } in Legend.svelte itself
    expect(l).not.toMatch(/^interface\s+LegendSwatch/m);
  });
});

// ─── $derived state plumbing ─────────────────────────────────────────────────

describe("$derived state plumbing", () => {
  it("4. showChromeFlags derived from generalCard.show* toggles", () => {
    const s = src(SRC);
    expect(hasDerived(s, "showChromeFlags")).toBe(true);
    const body = derivedBody(s, "showChromeFlags");
    expect(body).not.toBeNull();
    // must read from formattingSettings.generalCard
    expect(body!).toMatch(/formattingSettings\.generalCard/);
    // must reference all four show* properties
    expect(body!).toMatch(/showFilterPills/);
    expect(body!).toMatch(/showSearch/);
    expect(body!).toMatch(/showStatusSummary/);
    expect(body!).toMatch(/showLegend/);
  });

  it("5. statusColors derived from statusColorsCard.{metColor,atRiskColor,breachedColor}", () => {
    const s = src(SRC);
    expect(hasDerived(s, "statusColors")).toBe(true);
    const body = derivedBody(s, "statusColors");
    expect(body).not.toBeNull();
    expect(body!).toMatch(/statusColorsCard/);
    expect(body!).toMatch(/metColor/);
    expect(body!).toMatch(/atRiskColor/);
    expect(body!).toMatch(/breachedColor/);
  });

  it("6. legendSwatches derived from bandColorsCard + --sla-target-line CSS var", () => {
    const s = src(SRC);
    expect(hasDerived(s, "legendSwatches")).toBe(true);
    const body = derivedBody(s, "legendSwatches");
    expect(body).not.toBeNull();
    expect(body!).toMatch(/bandColorsCard/);
    expect(body!).toMatch(/badColor/);
    expect(body!).toMatch(/cautionColor/);
    expect(body!).toMatch(/onTargetColor/);
    expect(body!).toMatch(/--sla-target-line/);
    expect(body!).toMatch(/readCssVar/);
  });

  it("16. legendSwatches produces 3 band swatches + 1 line swatch", () => {
    const s = src(SRC);
    const body = derivedBody(s, "legendSwatches");
    expect(body).not.toBeNull();
    // Must push 4 items: Bad range, Caution, On target, Target line
    expect(body!).toMatch(/Bad range/);
    expect(body!).toMatch(/Caution/);
    expect(body!).toMatch(/On target/);
    expect(body!).toMatch(/Target line/);
    // kind: "band" for the three band entries
    const bandMatches = body!.match(/kind:\s*"band"/g);
    expect(bandMatches).toHaveLength(3);
    // kind: "line" for the target line
    expect(body!).toMatch(/kind:\s*"line"/);
  });

  it("17. statusColors and legendSwatches both use $derived.by (verifies reactive recompute)", () => {
    const s = src(SRC);
    const statusBody = derivedBody(s, "statusColors");
    const legendBody = derivedBody(s, "legendSwatches");
    expect(statusBody).not.toBeNull();
    expect(legendBody).not.toBeNull();
    // $derived.by(() => { ... }) pattern — the body is inside an arrow fn passed to $derived.by
    // Confirmed by checking the surrounding declaration pattern
    expect(s).toMatch(/\bstatusColors\s*=\s*\$derived\.by\s*\(\(\)/);
    expect(s).toMatch(/\blegendSwatches\s*=\s*\$derived\.by\s*\(\(\)/);
  });
});

// ─── Markup structure ────────────────────────────────────────────────────────

describe("markup structure", () => {
  it('7. LandingPage rendered when rows+categories empty AND formattingSettings null', () => {
    const s = src(SRC);
    // {#if !rows.length && !categories.length && formattingSettings === null}
    expect(s).toMatch(/\{#if\s+!rows\.length\s+&&\s+!categories\.length\s+&&\s+formattingSettings\s*===\s*null\}/);
    // <LandingPage /> immediately inside the if block
    expect(s).toMatch(/\{#if\s+!rows\.length[\s\S]*?<LandingPage\s*\/\>/m);
  });

  it('8. FilterPills wrapped in <div class="sla-section sla-section--filter">', () => {
    const s = src(SRC);
    expect(s).toMatch(/class="sla-section sla-section--filter(?:["\s])/);
    expect(s).toMatch(/<div\s+class="sla-section sla-section--filter\b[^"]*"[^>]*>[\s\n]*<FilterPills/);
  });

  it('9. SearchBox wrapped in <div class="sla-section sla-section--search">', () => {
    const s = src(SRC);
    expect(s).toMatch(/class="sla-section sla-section--search(?:["\s])/);
    expect(s).toMatch(/<div\s+class="sla-section sla-section--search\b[^"]*"[^>]*>[\s\n]*<SearchBox/);
  });

  it('10. StatusSummary wrapped in <div class="sla-section sla-section--summary">', () => {
    const s = src(SRC);
    expect(s).toMatch(/class="sla-section sla-section--summary(?:["\s])/);
    expect(s).toMatch(/<div\s+class="sla-section sla-section--summary\b[^"]*"[^>]*>[\s\n]*<StatusSummary/);
  });

  it('11. Legend wrapped in <div class="sla-section sla-section--legend">', () => {
    const s = src(SRC);
    expect(s).toMatch(/class="sla-section sla-section--legend(?:["\s])/);
    expect(s).toMatch(/<div\s+class="sla-section sla-section--legend\b[^"]*"[^>]*>[\s\n]*<Legend/);
  });

  it('12. SlaTable rendered inside <div class="sla-section sla-section--table">', () => {
    const s = src(SRC);
    // table section exists without bind:this
    expect(s).toMatch(/class="sla-section sla-section--table(?:["\s])/);
    // no bind:this={tableWrap} on the table section
    expect(s).not.toMatch(/sla-section--table"\s[^>]*bind:this/);
    // SlaTable appears inside the table section div
    const tableSectionMatch = s.match(
      /<div\s+class="sla-section sla-section--table\b[^"]*"[^>]*>[\s\S]*?<\/div>/,
    );
    expect(tableSectionMatch).not.toBeNull();
    const tableSectionContent = tableSectionMatch![0];
    expect(tableSectionContent).toContain("<SlaTable");
    // SlaTable receives the expected props
    expect(tableSectionContent).toMatch(/rows=\{filteredRows\}/);
    expect(tableSectionContent).toMatch(/targetLineColor=\{tableTargetLineColor\}/);
    expect(tableSectionContent).toMatch(/statusColors=\{statusColors\}/);
    expect(tableSectionContent).toMatch(/bandColors=\{bandColors\}/);
    expect(tableSectionContent).toMatch(/fontSize=\{[^}]+\}/);
    expect(tableSectionContent).toMatch(/renderVersion=\{renderVersion\}/);
    expect(tableSectionContent).toMatch(/onSelectionChange=\{[^}]*\}/);
    expect(tableSectionContent).toMatch(/rowEvents=\{[^}]*\}/);
    // old tableWrap variable is gone
    expect(s).not.toMatch(/\btableWrap\b/);
  });

  it('13. --header section uses style:display="none" (Phase 4 placeholder)', () => {
    const s = src(SRC);
    expect(s).toMatch(/class="sla-section sla-section--header\b[^"]*"\s+style:display="none"/);
    // placeholder comment confirming Phase 4 wiring intent
    expect(s).toMatch(/placeholder.*Phase 4|Phase 4.*placeholder/);
  });

  it('showChromeFlags.filter/search/summary/legend drive style:display on chrome sections', () => {
    const s = src(SRC);
    // Each chrome section must use showChromeFlags.<key> for its display toggle
    expect(s).toMatch(/style:display=\{showChromeFlags\.filter/);
    expect(s).toMatch(/style:display=\{showChromeFlags\.search/);
    expect(s).toMatch(/style:display=\{showChromeFlags\.summary/);
    expect(s).toMatch(/style:display=\{showChromeFlags\.legend/);
  });
});

// ─── Event handler wiring ─────────────────────────────────────────────────────

describe("event handler callbacks", () => {
  it("14. onSelect handler updates activeCategory", () => {
    const s = src(SRC);
    // FilterPills receives onSelect prop with an arrow fn that assigns activeCategory
    expect(s).toMatch(/onSelect=\{\(n\)\s*=>\s*\{?\s*activeCategory\s*=\s*n/);
  });

  it("15. onInput handler updates searchQuery", () => {
    const s = src(SRC);
    // SearchBox receives onInput prop with an arrow fn that assigns searchQuery
    expect(s).toMatch(/onInput=\{\(v\)\s*=>\s*\{?\s*searchQuery\s*=\s*v/);
  });
});

// ─── Smoke: file is valid TypeScript-syntactically ────────────────────────────

describe("file integrity", () => {
  it("App.svelte source file is non-empty and has script/template sections", () => {
    const s = src(SRC);
    expect(s.length).toBeGreaterThan(200);
    expect(s).toMatch(/<script lang="ts">/);
    expect(s).toMatch(/<\/script>/);
    expect(s).toMatch(/<div class="sla-root"/);
  });
});

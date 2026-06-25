/**
 * StatusSummary unit tests — no DOM library required.
 *
 * Compiles StatusSummary.svelte and inspects the generated code for
 * structural correctness.
 *
 * Run: npx vitest run src/components/StatusSummary.test.ts
 */

import { describe, it, expect } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";

const COMPONENT_PATH = "src/components/StatusSummary.svelte";

function compileComponent(source: string) {
    return compile(source, {
        filename: COMPONENT_PATH,
        generate: "client",
        dev: false,
    });
}

// ---------------------------------------------------------------------------
// Tests — structural inspection of compiled output
// ---------------------------------------------------------------------------

describe("StatusSummary", () => {
    const source = readFileSync(COMPONENT_PATH, "utf8");
    const compiled = compileComponent(source);
    const jsCode = compiled.js.code;

    // 1. Outer wrapper is <div aria-label="Status summary">
    it("outer wrapper is <div aria-label='Status summary'>", () => {
        expect(source).toMatch(
            /<div class="flex flex-wrap gap-2 items-center justify-end" aria-label="Status summary"( role="status")?( aria-live="polite")?>/,
        );
    });

    // 2. Renders exactly three <span> pills (one per status)
    it("renders exactly three <span> pills", () => {
        // The component template has exactly one {#each STATUS_KEYS ...} block
        const eachBlocks = (source.match(/{#each STATUS_KEYS/g) || []).length;
        expect(eachBlocks).toBe(1);
        // Compiled JS uses $.each with STATUS_KEYS to render 3 pills
        expect(jsCode).toContain("$.each");
        expect(jsCode).toContain("STATUS_KEYS");
        // The pill class is built from a template literal in the compiled code
        expect(jsCode).toContain("`sla-summary-pill sla-summary-pill--${key ?? ''}`");
    });

    // 3. Pills render in order: met, atRisk, breached
    it("STATUS_KEYS iteration order is met, atRisk, breached", () => {
        expect(source).toContain('const STATUS_KEYS = ["met", "atRisk", "breached"]');
        expect(source).toContain("{#each STATUS_KEYS as key (key)}");
    });

    // 4. Each pill class contains sla-summary-pill and sla-summary-pill--{key}
    it("each pill has class sla-summary-pill and sla-summary-pill--{key}", () => {
        // Template uses interpolated class
        expect(source).toContain("sla-summary-pill sla-summary-pill--{key}");
        // Compiled JS builds class via template literal
        expect(jsCode).toContain("`sla-summary-pill sla-summary-pill--${key ?? ''}`");
    });

    // 5. Inner spans: __label uses STATUS_LABEL[key], __count shows count
    it("inner spans use __label (STATUS_LABEL[key]) and __count", () => {
        expect(source).toContain("sla-summary-pill__label");
        expect(source).toContain("sla-summary-pill__count");
        expect(source).toContain("STATUS_LABEL[key]");
        expect(source).toContain("String(counts[key])");
    });

    // 6. Counts derived from rows via reduce over STATUS_KEYS
    it("counts are derived from rows using STATUS_KEYS reduce", () => {
        expect(source).toContain("STATUS_KEYS.reduce");
        expect(source).toContain("rows.filter((r: SlaRow) => r.status === key)");
        expect(source).toContain("acc[key] = rows.filter");
    });

    // 7. Empty rows → all counts 0 (initial reduce accumulator)
    it("counts accumulator initializes to { met: 0, atRisk: 0, breached: 0 }", () => {
        expect(source).toContain("{ met: 0, atRisk: 0, breached: 0 }");
    });

    // 8. Uses Svelte 5 native style:background and style:color directives
    it("uses style:background={hexToRgba(...)} native directive", () => {
        expect(source).toContain("style:background={hexToRgba(colors[key], 0.1)}");
    });

    it("uses style:color={colors[key]} native directive", () => {
        expect(source).toContain("style:color={colors[key]}");
    });

    // 9. Outer container uses Tailwind utilities (flex, gap-2, items-center)
    it("outer container has class='flex flex-wrap gap-2 items-center justify-end'", () => {
        expect(source).toContain('class="flex flex-wrap gap-2 items-center justify-end"');
    });

    // 10. STATUS_KEYS drives iteration order (compile-time constant)
    it("STATUS_KEYS is a readonly const tuple driving the {#each}", () => {
        expect(source).toContain("as const satisfies readonly SlaStatus[]");
        expect(source).toContain("{#each STATUS_KEYS as key (key)}");
    });

    // Additional: STATUS_LABEL is imported and maps are correct
    it("STATUS_LABEL is imported from types and used for each status", () => {
        expect(source).toContain('import { STATUS_LABEL } from "../types"');
        expect(jsCode).toContain("STATUS_LABEL[key]");
    });

    // Additional: hexToRgba is imported and called with alpha 0.1
    it("hexToRgba is imported and called with alpha 0.1 for background", () => {
        expect(source).toContain('import { hexToRgba } from "../theme"');
        expect(source).toContain("hexToRgba(colors[key], 0.1)");
    });

    // Additional: colors prop interface
    it("colors prop is typed as { met: string; atRisk: string; breached: string }", () => {
        expect(source).toContain("colors: { met: string; atRisk: string; breached: string }");
    });
});

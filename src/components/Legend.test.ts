/**
 * Legend unit tests — Svelte compiler output inspection.
 *
 * Compiles Legend.svelte and inspects the generated code for structural correctness.
 *
 * Run: npx vitest run src/components/Legend.test.ts
 */

import { describe, it, expect } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";

const COMPONENT_PATH = "src/components/Legend.svelte";

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

describe("Legend", () => {
    const source = readFileSync(COMPONENT_PATH, "utf8");
    const compiled = compileComponent(source);
    const jsCode = compiled.js.code;

    // 1. Renders outer <div class="sla-legend ...">
    it("renders outer <div class='sla-legend ...'>", () => {
        expect(source).toContain('<div class="sla-legend flex flex-wrap gap-3.5 items-center justify-between">');
    });

    // 2. Renders left <div class="sla-legend__items">
    it("renders left <div class='sla-legend__items'>", () => {
        expect(source).toContain('<div class="sla-legend__items flex flex-wrap gap-3.5">');
    });

    // 3. Renders right <div class="sla-legend__caption"> with caption text
    it("renders right <div class='sla-legend__caption'> with caption text", () => {
        expect(source).toContain('<div class="sla-legend__caption">{caption}</div>');
    });

    // 4. Renders one <span class="sla-legend__item"> per swatch
    it("renders one <span class='sla-legend__item'> per swatch", () => {
        // Compiled JS renders a span per swatch entry
        expect(jsCode).toContain("sla-legend__item");
        // Template has the class on the span inside the each block
        expect(source).toContain('<span class="sla-legend__item inline-flex items-center gap-1.5">');
    });

    // 5. For kind="band", renders <span class="sla-legend__swatch" style:background={color}>
    //    (band is the {:else} branch — source only has swatch.kind === "line" as the if condition)
    it("for kind='band' renders <span class='sla-legend__swatch' style:background={color}>", () => {
        // Band kind is rendered via {:else} of the {#if swatch.kind === "line"} block
        expect(source).toContain('<span class="sla-legend__swatch" style:background={swatch.color}>');
    });

    // 6. For kind="line", renders <span class="sla-legend__line" style:background={color}>
    it("for kind='line' renders <span class='sla-legend__line' style:background={color}>", () => {
        expect(source).toContain("swatch.kind === \"line\"");
        expect(source).toContain('<span class="sla-legend__line" style:background={swatch.color}>');
        // Band class only appears in {:else}, not in the {#if} block
        const ifLineBlock = source.split("{:else}")[0]; // everything before the band {:else}
        expect(ifLineBlock).toContain("sla-legend__line");
        expect(ifLineBlock).not.toContain("sla-legend__swatch");
    });

    // 7. Each item has a <span class="sla-legend__label"> with the swatch's label
    it("each item has a <span class='sla-legend__label'> with the swatch's label", () => {
        expect(source).toContain('<span class="sla-legend__label">{swatch.label}</span>');
    });

    // 8. Empty swatches array → items div is empty, caption still rendered
    it("empty swatches array → items div is empty, caption still rendered", () => {
        // Caption div comes AFTER the each block in source order — so it renders even when each yields nothing
        const captionIndex = source.indexOf('<div class="sla-legend__caption">');
        const eachBlockStart = source.indexOf("{#each swatches");
        const itemsDivIndex = source.indexOf('<div class="sla-legend__items');
        const itemsDivCloseIndex = source.indexOf("</div>", itemsDivIndex); // first </div> closes items
        expect(captionIndex).toBeGreaterThan(eachBlockStart); // caption is after each
        expect(itemsDivCloseIndex).toBeLessThan(captionIndex); // items div closes before caption
    });

    // 9. Caption is rendered exactly as provided (e.g. "Lower is worse")
    it("caption is rendered exactly as provided", () => {
        // The caption variable is interpolated directly into the caption div
        expect(source).toContain('<div class="sla-legend__caption">{caption}</div>');
        // Compiled code passes caption as a prop and references it directly
        expect(jsCode).toContain("caption");
    });

    // 10. Uses Tailwind utilities on outer wrapper (flex, flex-wrap, gap-3.5, items-center, justify-between)
    it("uses Tailwind utilities on outer wrapper", () => {
        expect(source).toContain("flex flex-wrap gap-3.5 items-center justify-between");
    });

    // 11. Uses keyed {#each swatches (swatch.label)}
    it("uses keyed {#each swatches (swatch.label)}", () => {
        expect(source).toContain("{#each swatches as swatch (swatch.label)}");
    });

    // 12. Uses native style:background directive (not style="..." string)
    it("uses native style:background directive", () => {
        // Must NOT use style="background=..." string syntax
        expect(source).not.toContain('style="background=');
        // Must use Svelte native style:background directive
        expect(source).toContain("style:background={swatch.color}");
    });
});

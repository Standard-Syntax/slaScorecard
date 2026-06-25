/**
 * LandingPage unit tests — Svelte compiler output inspection.
 *
 * Compiles LandingPage.svelte and inspects the generated code for
 * structural correctness.
 *
 * Run: npx vitest run src/components/LandingPage.test.ts
 */

import { describe, it, expect } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";

const COMPONENT_PATH = "src/components/LandingPage.svelte";

function compileComponent(source: string) {
    return compile(source, {
        filename: COMPONENT_PATH,
        generate: "client",
        dev: false,
    });
}

// Expected li item texts in order
const EXPECTED_LI_TEXTS = [
    "SLA — name of each SLA (e.g. 'Payment API Uptime')",
    "Category — for the filter pills (e.g. 'Platform', 'Support')",
    "Owner — owner name and initials (e.g. 'Payments', 'PA')",
    "Current, Target — measures for the bullet chart",
    "Time to breach — days until breach (optional)",
    "30D trend — comma-separated 30 numeric values (optional)",
];

describe("LandingPage", () => {
    const source = readFileSync(COMPONENT_PATH, "utf8");
    const compiled = compileComponent(source);
    const jsCode = compiled.js.code;

    // Test 1: Outer container renders as <div> with class "sla-landing"
    it("renders <div class=\"sla-landing ...\"> as outer container", () => {
        // Svelte 5 compiles templates into backtick string literals
        expect(jsCode).toContain("<div");
        expect(jsCode).toContain("sla-landing");
    });

    // Test 2: Title renders as <h2> with class "sla-landing__title" and text "SLA Scorecard"
    it("renders <h2 class=\"sla-landing__title\"> with text \"SLA Scorecard\"", () => {
        expect(jsCode).toContain("sla-landing__title");
        expect(jsCode).toContain("SLA Scorecard");
    });

    // Test 3: Subtitle renders as <p> with class "sla-landing__subtitle" and correct text
    it("renders <p class=\"sla-landing__subtitle\"> with text \"Map data to populate the scorecard.\"", () => {
        expect(jsCode).toContain("sla-landing__subtitle");
        expect(jsCode).toContain("Map data to populate the scorecard.");
    });

    // Test 4: Renders <ul class="sla-landing__list">
    it("renders <ul class=\"sla-landing__list\">", () => {
        expect(jsCode).toContain("sla-landing__list");
        // Check it's an unordered list
        expect(jsCode).toContain("<ul");
    });

    // Test 5: Renders exactly 6 <li> items
    it("renders exactly 6 <li> items", () => {
        // Count li elements in source
        const liCount = (source.match(/<li>/g) || []).length;
        expect(liCount).toBe(6);
    });

    // Test 6: Each <li> matches the exact text from the spec
    it("each <li> matches the exact text from the spec", () => {
        for (const expectedText of EXPECTED_LI_TEXTS) {
            expect(source).toContain(`<li>${expectedText}</li>`);
        }
    });

    // Test 7: <li> items appear in the spec order
    it("<li> items appear in the spec order", () => {
        for (let i = 0; i < EXPECTED_LI_TEXTS.length; i++) {
            const expectedIndex = source.indexOf(`<li>${EXPECTED_LI_TEXTS[i]}</li>`);
            if (i > 0) {
                const prevIndex = source.indexOf(`<li>${EXPECTED_LI_TEXTS[i - 1]}</li>`);
                expect(expectedIndex).toBeGreaterThan(prevIndex);
            }
        }
    });

    // Test 8: Outer container uses correct Tailwind utilities
    it("outer container uses Tailwind utilities (flex flex-col items-center justify-center text-center p-6 gap-3)", () => {
        expect(jsCode).toContain("flex");
        expect(jsCode).toContain("flex-col");
        expect(jsCode).toContain("items-center");
        expect(jsCode).toContain("justify-center");
        expect(jsCode).toContain("text-center");
        expect(jsCode).toContain("p-6");
        expect(jsCode).toContain("gap-3");
    });

    // Test 9: Title uses text-2xl font-semibold
    it("title uses text-2xl font-semibold", () => {
        expect(jsCode).toContain("text-2xl");
        expect(jsCode).toContain("font-semibold");
    });

    // Test 10: Subtitle uses text-sm
    it("subtitle uses text-sm", () => {
        expect(jsCode).toContain("text-sm");
    });

    // Additional: Verify subtitle also has text-slate-500
    it("subtitle uses text-slate-500 for muted color", () => {
        expect(jsCode).toContain("text-slate-500");
    });

    // Additional: Verify ul has list-none class
    it("ul has list-none class to remove default list styling", () => {
        expect(jsCode).toContain("list-none");
    });

    // Additional: Verify ul has flex and gap classes
    it("ul has flex flex-col gap-1.5 for list layout", () => {
        expect(jsCode).toContain("gap-1.5");
    });
});

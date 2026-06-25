import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const COMPONENT_PATH = resolve(__dirname, "Sparkline.svelte");

function getSource(): string {
    return readFileSync(COMPONENT_PATH, "utf-8");
}

describe("Sparkline.svelte source inspection", () => {
    const src = getSource();

    it("uses $props() and not export let", () => {
        expect(src).toContain("$props()");
        expect(src).not.toContain("export let");
    });

    it("imports renderSparkline as a value from sparkline", () => {
        expect(src).toContain(
            'import { renderSparkline } from "../sparkline"',
        );
    });

    it("imports SparklineOptions type from sparkline", () => {
        expect(src).toContain(
            'import type { SparklineOptions } from "../sparkline"',
        );
    });

    it("uses $effect", () => {
        expect(src).toContain("$effect(");
    });

    it("uses requestAnimationFrame", () => {
        expect(src).toContain("requestAnimationFrame");
    });

    it("uses bind:this on host element", () => {
        expect(src).toContain("bind:this={host}");
    });

    it("host element has class sla-spark", () => {
        expect(src).toContain('class="sla-spark"');
    });

    it("width default is 140", () => {
        expect(src).toMatch(/width\s*=\s*140/);
    });

    it("height default is 36", () => {
        expect(src).toMatch(/height\s*=\s*36/);
    });

    it("width fallback uses host.clientWidth when width is falsy", () => {
        expect(src).toContain("clientWidth");
    });

    it("calls renderSparkline with all 7 expected options keys", () => {
        const keys = [
            "width",
            "height",
            "values",
            "lineColor",
            "fillColor",
            "showDots",
            "referenceLine",
        ];
        for (const key of keys) {
            expect(src).toContain(key);
        }
    });

    it("Props interface or destructuring includes all 7 prop names", () => {
        const props = [
            "width",
            "height",
            "values",
            "lineColor",
            "fillColor",
            "showDots",
            "referenceLine",
        ];
        for (const prop of props) {
            expect(src).toContain(prop);
        }
    });

    it("no line exceeds 100 characters", () => {
        const lines = src.split("\n");
        const longLines = lines.filter((line) => line.length > 100);
        expect(longLines).toHaveLength(0);
    });

    it("compiles cleanly via svelte compiler (parse only)", () => {
        const { compile } = require("svelte/compiler");
        expect(() =>
            compile(src, { filename: "Sparkline.svelte" }),
        ).not.toThrow();
    });
});

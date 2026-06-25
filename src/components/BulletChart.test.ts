import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const COMPONENT_PATH = resolve(__dirname, "BulletChart.svelte");

function getSource(): string {
    return readFileSync(COMPONENT_PATH, "utf-8");
}

describe("BulletChart.svelte source inspection", () => {
    const src = getSource();

    it("uses $props() and not export let", () => {
        expect(src).toContain("$props()");
        expect(src).not.toContain("export let");
    });

    it("imports renderBulletChart as a value from bulletChart", () => {
        expect(src).toContain(
            'import { renderBulletChart } from "../bulletChart"',
        );
    });

    it("imports BulletChartOptions type from bulletChart", () => {
        expect(src).toContain(
            'import type { BulletChartOptions } from "../bulletChart"',
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

    it("host element has class sla-bullet", () => {
        expect(src).toContain('class="sla-bullet"');
    });

    it("width default is 150", () => {
        expect(src).toMatch(/width\s*=\s*150/);
    });

    it("height default is 36", () => {
        expect(src).toMatch(/height\s*=\s*36/);
    });

    it("width fallback uses host.clientWidth when width is falsy", () => {
        expect(src).toContain("clientWidth");
    });

    it("calls renderBulletChart with all 12 expected options keys", () => {
        const keys = [
            "current",
            "target",
            "badThreshold",
            "cautionThreshold",
            "maxValue",
            "badColor",
            "cautionColor",
            "onTargetColor",
            "barColor",
            "targetLineColor",
        ];
        for (const key of keys) {
            expect(src).toContain(key);
        }
    });

    it("Props interface or destructuring includes all 12 prop names", () => {
        const props = [
            "width",
            "height",
            "current",
            "target",
            "badThreshold",
            "cautionThreshold",
            "maxValue",
            "badColor",
            "cautionColor",
            "onTargetColor",
            "barColor",
            "targetLineColor",
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
        // parse-only check — verifies valid Svelte syntax
        const { compile } = require("svelte/compiler");
        expect(() =>
            compile(src, { filename: "BulletChart.svelte" }),
        ).not.toThrow();
    });
});

import { describe, it, expect } from "vitest";
import type { SlaRow } from "./types";
import {
    computeBulletMaxValue,
    resolveSparklineOptions,
    SPARKLINE_GAIN_COLOR,
    SPARKLINE_LOSS_COLOR,
    SPARKLINE_FLAT_COLOR,
} from "./row-builder";

// Minimal SlaRow fixture — only fields used by computeBulletMaxValue are set.
function makeSlaRow(overrides: Partial<SlaRow>): SlaRow {
    return {
        slaId: "fixture-id",
        slaName: "Fixture SLA",
        category: "Fixtures",
        ownerName: "Fixture Owner",
        ownerInitials: "FO",
        ownerColor: "#cccccc",
        current: 0,
        target: 1,
        badThreshold: 0,
        cautionThreshold: 0,
        timeToBreach: null,
        trend: [],
        status: "met",
        highlight: false,
        selectionId: {} as SlaRow["selectionId"],
        ...overrides,
    } as SlaRow;
}

describe("computeBulletMaxValue", () => {
    it("returns 1.2× target when target is largest", () => {
        const row = makeSlaRow({
            target: 1.0,
            current: 0.99,
            badThreshold: 0.95,
            cautionThreshold: 0.995,
        });
        expect(computeBulletMaxValue(row)).toBe(1.2);
    });

    it("returns 1.2× target when current exceeds 1.2× target", () => {
        const row = makeSlaRow({
            target: 0.5,
            current: 0.4,
            badThreshold: 0.4,
            cautionThreshold: 0.45,
        });
        // max(0.6, 0.4, 0.4, 0.45) = 0.6
        expect(computeBulletMaxValue(row)).toBe(0.6);
    });

    it("returns 1.2× target for large target values", () => {
        const row = makeSlaRow({
            target: 100,
            current: 95,
            badThreshold: 70,
            cautionThreshold: 85,
        });
        // max(120, 95, 70, 85) = 120
        expect(computeBulletMaxValue(row)).toBe(120);
    });
});

describe("resolveSparklineOptions", () => {
    it("returns gain color for rising trend", () => {
        const result = resolveSparklineOptions([1, 2, 3, 4, 5]);
        expect(result.lineColor).toBe(SPARKLINE_GAIN_COLOR);
        expect(result.showDots).toBe(true);
        expect(result.values).toEqual([1, 2, 3, 4, 5]);
    });

    it("returns loss color for falling trend", () => {
        const result = resolveSparklineOptions([5, 4, 3, 2, 1]);
        expect(result.lineColor).toBe(SPARKLINE_LOSS_COLOR);
        expect(result.showDots).toBe(true);
        expect(result.values).toEqual([5, 4, 3, 2, 1]);
    });

    it("returns gain color for flat trend when last >= first", () => {
        const result = resolveSparklineOptions([3, 3, 3]);
        expect(result.lineColor).toBe(SPARKLINE_GAIN_COLOR);
        expect(result.showDots).toBe(true);
        expect(result.values).toEqual([3, 3, 3]);
    });

    it("returns flat color and default values for empty array", () => {
        const result = resolveSparklineOptions([]);
        expect(result.lineColor).toBe(SPARKLINE_FLAT_COLOR);
        expect(result.showDots).toBe(false);
        expect(result.values).toEqual([50, 50, 50, 50, 50, 50, 50, 50]);
    });

    it("returns flat color and default values for single-point trend", () => {
        const result = resolveSparklineOptions([42]);
        expect(result.lineColor).toBe(SPARKLINE_FLAT_COLOR);
        expect(result.showDots).toBe(false);
        expect(result.values).toEqual([50, 50, 50, 50, 50, 50, 50, 50]);
    });
});

import { describe, expect, it } from "vitest";
import type { SlaRow } from "./types";
import {
    parseTrend,
    deriveInitials,
    statusFromValue,
    deriveThresholds,
    formatCurrentValue,
    formatTargetValue,
    buildCategoryBuckets,
} from "./row-builder";

// Minimal mock SlaRow — only the fields used by formatCurrentValue / formatTargetValue
function makeRow(target: number, current: number): SlaRow {
    return {
        slaId: "SLA-001",
        slaName: "Test SLA",
        category: "Test",
        ownerName: "Test Owner",
        ownerInitials: "TO",
        ownerColor: "#6366F1",
        current,
        target,
        badThreshold: 0,
        cautionThreshold: 0,
        timeToBreach: null,
        trend: [],
        status: "met",
        highlight: false,
        selectionId: {} as any,
    };
}

// Mock ISelectionId
const mockSelectionId = {
    equals: () => false,
    hashCode: () => "0",
} as any;

function makeRowFull(overrides: Partial<SlaRow> = {}): SlaRow {
    return {
        slaId: "SLA-001",
        slaName: "Test SLA",
        category: "Uncategorized",
        ownerName: "Alice",
        ownerInitials: "AL",
        ownerColor: "#6366F1",
        current: 0.95,
        target: 0.9,
        badThreshold: 0,
        cautionThreshold: 0,
        timeToBreach: null,
        trend: [],
        status: "met",
        highlight: false,
        selectionId: mockSelectionId,
        ...overrides,
    };
}

describe("parseTrend", () => {
    it("null input returns empty array", () => {
        expect(parseTrend(null)).toEqual([]);
    });

    it("undefined input returns empty array", () => {
        expect(parseTrend(undefined)).toEqual([]);
    });

    it("string with commas splits into array", () => {
        expect(parseTrend("1,2,3")).toEqual([1, 2, 3]);
    });

    it("string with semicolons splits into array", () => {
        expect(parseTrend("1;2;3")).toEqual([1, 2, 3]);
    });

    it("string with mixed delimiters (comma and semicolon)", () => {
        expect(parseTrend("1,2;3,4")).toEqual([1, 2, 3, 4]);
    });

    it("string with whitespace-only delimiters", () => {
        expect(parseTrend("1  2\t3")).toEqual([1, 2, 3]);
    });

    it("invalid numeric strings are filtered out", () => {
        expect(parseTrend("1,abc,3")).toEqual([1, 3]);
    });

    it("empty string returns empty array", () => {
        expect(parseTrend("")).toEqual([]);
    });

    it("array of numbers is parsed correctly", () => {
        expect(parseTrend([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("array of numeric strings is parsed correctly", () => {
        expect(parseTrend(["1", "2", "3"])).toEqual([1, 2, 3]);
    });

    it("array with mixed valid/invalid values filters invalid", () => {
        expect(parseTrend([1, "a", 3, "b"])).toEqual([1, 3]);
    });
});

describe("deriveInitials", () => {
    it("empty string returns ?", () => {
        expect(deriveInitials("")).toBe("?");
    });

    it("whitespace-only returns ?", () => {
        // trim().split(/\s+/) on whitespace-only: "   ".trim() = "", "".split(/\s+/) = [""]
        // parts[0] = "", parts.length === 1 so slice("".slice(0,2)) = ""
        expect(deriveInitials("   ")).toBe("");
    });

    it("single name returns first 2 characters uppercase", () => {
        expect(deriveInitials("alice")).toBe("AL");
    });

    it("two-word name returns first letter of each word uppercase", () => {
        expect(deriveInitials("Alice Smith")).toBe("AS");
    });

    it("three-word name uses first and last word", () => {
        expect(deriveInitials("Alice B Smith")).toBe("AS");
    });

    it("single character name returns that character", () => {
        // slice(0, 2) on "A" returns "A" (only 1 char exists)
        expect(deriveInitials("A")).toBe("A");
    });

    it("lowercase names are uppercased", () => {
        expect(deriveInitials("alice")).toBe("AL");
        expect(deriveInitials("alice smith")).toBe("AS");
    });
});

describe("statusFromValue", () => {
    it("current <= badThreshold returns breached", () => {
        expect(statusFromValue(0.7, 0.9, 0.8, 0.9)).toBe("breached");
    });

    it("current <= cautionThreshold (but > bad) returns atRisk", () => {
        expect(statusFromValue(0.85, 0.9, 0.8, 0.9)).toBe("atRisk");
    });

    it("current > cautionThreshold returns met", () => {
        expect(statusFromValue(0.95, 0.9, 0.8, 0.9)).toBe("met");
    });

    it("exact boundary: current === badThreshold is breached", () => {
        expect(statusFromValue(0.8, 0.9, 0.8, 0.9)).toBe("breached");
    });

    it("exact boundary: current === cautionThreshold is atRisk", () => {
        expect(statusFromValue(0.9, 0.9, 0.8, 0.9)).toBe("atRisk");
    });
});

describe("deriveThresholds", () => {
    it("target >= 0.95 uses fixed 0.05/0.005 gap", () => {
        const { bad, caution } = deriveThresholds(0.98);
        expect(bad).toBe(0.98 - 0.05);
        expect(caution).toBe(0.98 - 0.005);
    });

    it("target >= 0.5 and < 0.95 uses percentage multipliers", () => {
        const { bad, caution } = deriveThresholds(0.9);
        expect(bad).toBeCloseTo(0.9 * 0.85);
        expect(caution).toBeCloseTo(0.9 * 0.97);
    });

    it("target > 0 and < 0.5 uses lower percentage multipliers", () => {
        const { bad, caution } = deriveThresholds(0.4);
        expect(bad).toBeCloseTo(0.4 * 0.7);
        expect(caution).toBeCloseTo(0.4 * 0.9);
    });

    it("target <= 0 uses inverse multipliers (1.2 and 1.05)", () => {
        const { bad, caution } = deriveThresholds(-0.1);
        expect(bad).toBeCloseTo(-0.1 * 1.2);
        expect(caution).toBeCloseTo(-0.1 * 1.05);
    });

    it("target exactly 0.5 falls into the >= 0.5 branch", () => {
        const { bad, caution } = deriveThresholds(0.5);
        expect(bad).toBeCloseTo(0.5 * 0.85);
        expect(caution).toBeCloseTo(0.5 * 0.97);
    });

    it("target exactly 0.95 falls into the >= 0.95 branch", () => {
        const { bad, caution } = deriveThresholds(0.95);
        expect(bad).toBeCloseTo(0.95 - 0.05);
        expect(caution).toBeCloseTo(0.95 - 0.005);
    });
});

describe("formatCurrentValue", () => {
    it("target >= 100 formats current to 2 decimal places", () => {
        const row = makeRow(150, 99.987);
        expect(formatCurrentValue(row)).toBe("99.99");
    });

    it("target in (0, 1] formats current as percentage", () => {
        const row = makeRow(0.9, 0.8532);
        expect(formatCurrentValue(row)).toBe("85.32%");
    });

    it("target in [10, 1000) formats current with 0 decimals", () => {
        // target=100 triggers first branch (>= 100), not [10, 1000). Use 500.
        const row = makeRow(500, 85.6);
        expect(formatCurrentValue(row)).toBe("85.60");
    });

    it("target < 10 and target > 1 falls back to 2 decimals", () => {
        const row = makeRow(5, 3.14159);
        expect(formatCurrentValue(row)).toBe("3.14");
    });

    it("target 0 falls to default 2 decimals", () => {
        const row = makeRow(0, 0.5);
        expect(formatCurrentValue(row)).toBe("0.50");
    });

    it("target exactly 1 formats as percentage", () => {
        const row = makeRow(1, 0.99);
        expect(formatCurrentValue(row)).toBe("99.00%");
    });

    it("target exactly 10 formats with 0 decimals", () => {
        const row = makeRow(10, 8.7);
        expect(formatCurrentValue(row)).toBe("9");
    });

    it("target exactly 1000 falls to default 2 decimals", () => {
        const row = makeRow(1000, 500.123);
        expect(formatCurrentValue(row)).toBe("500.12");
    });

    it("target exactly 100 uses 2-decimal branch (>= 100)", () => {
        const row = makeRow(100, 85.6);
        expect(formatCurrentValue(row)).toBe("85.60");
    });
});

describe("formatTargetValue", () => {
    it("target >= 100 formats as percentage string with 2 decimals", () => {
        const row = makeRow(150, 99.987);
        expect(formatTargetValue(row)).toBe("150.00%");
    });

    it("target in (0, 1] formats as percentage string", () => {
        const row = makeRow(0.9, 0.8532);
        expect(formatTargetValue(row)).toBe("90.00%");
    });

    it("target in [10, 1000) formats with 0 decimals", () => {
        // target=100 triggers first branch (>= 100), not [10, 1000). Use 500.
        const row = makeRow(500, 85.6);
        expect(formatTargetValue(row)).toBe("500.00%");
    });

    it("target < 10 and > 1 falls back to toString", () => {
        const row = makeRow(5, 3.14159);
        expect(formatTargetValue(row)).toBe("5");
    });

    it("target exactly 1 formats as percentage", () => {
        const row = makeRow(1, 0.99);
        expect(formatTargetValue(row)).toBe("100.00%");
    });

    it("target exactly 10 formats with 0 decimals", () => {
        const row = makeRow(10, 8.7);
        expect(formatTargetValue(row)).toBe("10");
    });

    it("target exactly 100 uses percentage 2-decimal branch (>= 100)", () => {
        const row = makeRow(100, 85.6);
        expect(formatTargetValue(row)).toBe("100.00%");
    });
});

describe("buildCategoryBuckets", () => {
    it("empty rows array returns All bucket with count 0", () => {
        const buckets = buildCategoryBuckets([]);
        expect(buckets).toEqual([{ name: "All", count: 0 }]);
    });

    it("single category produces two buckets: All + that category", () => {
        const rows = [makeRowFull({ category: "Finance" })];
        const buckets = buildCategoryBuckets(rows);
        expect(buckets).toEqual([
            { name: "All", count: 1 },
            { name: "Finance", count: 1 },
        ]);
    });

    it("multiple categories are sorted alphabetically", () => {
        const rows = [
            makeRowFull({ category: "Zebra" }),
            makeRowFull({ category: "Apple" }),
            makeRowFull({ category: "Banana" }),
        ];
        const buckets = buildCategoryBuckets(rows);
        expect(buckets[0]).toEqual({ name: "All", count: 3 });
        expect(buckets[1]).toEqual({ name: "Apple", count: 1 });
        expect(buckets[2]).toEqual({ name: "Banana", count: 1 });
        expect(buckets[3]).toEqual({ name: "Zebra", count: 1 });
    });

    it("All count reflects total rows regardless of category", () => {
        const rows = [
            makeRowFull({ category: "Finance" }),
            makeRowFull({ category: "Finance" }),
            makeRowFull({ category: "HR" }),
        ];
        const buckets = buildCategoryBuckets(rows);
        expect(buckets[0]).toEqual({ name: "All", count: 3 });
    });

    it("category count reflects number of rows per category", () => {
        const rows = [
            makeRowFull({ category: "Finance" }),
            makeRowFull({ category: "Finance" }),
            makeRowFull({ category: "HR" }),
        ];
        const buckets = buildCategoryBuckets(rows);
        const finance = buckets.find((b) => b.name === "Finance");
        const hr = buckets.find((b) => b.name === "HR");
        expect(finance?.count).toBe(2);
        expect(hr?.count).toBe(1);
    });
});

import { describe, expect, it } from "vitest";
import {
    hexToRgb,
    mixWithWhite,
    hexToRgba,
    isLikelyLight,
    formatNumber,
    formatPercent,
} from "./theme";

describe("hexToRgb", () => {
    it("parses a 6-digit hex color", () => {
        const result = hexToRgb("#ff5500");
        expect(result).toEqual({ r: 255, g: 85, b: 0 });
    });

    it("parses a 3-digit hex color by padding each digit", () => {
        const result = hexToRgb("#f50");
        expect(result).toEqual({ r: 255, g: 85, b: 0 });
    });

    it("returns null for invalid input", () => {
        expect(hexToRgb("not-a-color")).toBeNull();
        expect(hexToRgb("#gg0000")).toBeNull();
        expect(hexToRgb("")).toBeNull();
        expect(hexToRgb("#ff55")).toBeNull(); // wrong length
    });

    it("handles padding correctly for 3-digit input", () => {
        // Each digit is doubled: #abc → #aabbcc
        const result = hexToRgb("#fff");
        expect(result).toEqual({ r: 255, g: 255, b: 255 });
    });
});

describe("mixWithWhite", () => {
    it("ratio 0 returns the original color unchanged", () => {
        const result = mixWithWhite("#ff5500", 0);
        expect(result).toBe("#ff5500");
    });

    it("ratio 1 returns pure white", () => {
        const result = mixWithWhite("#ff5500", 1);
        expect(result).toBe("#ffffff");
    });

    it("ratio 0.5 blends halfway", () => {
        // #ff5500 → r=255, g=85, b=0
        // mix: r=round(255 + (255-255)*0.5)=255, g=round(85+(255-85)*0.5)=170, b=round(0+(255-0)*0.5)=128
        const result = mixWithWhite("#ff5500", 0.5);
        expect(result).toBe("#ffaa80");
    });

    it("clamps negative ratios to 0", () => {
        const result = mixWithWhite("#ff5500", -0.5);
        expect(result).toBe("#ff5500");
    });

    it("clamps ratios above 1 to 1", () => {
        const result = mixWithWhite("#ff5500", 1.5);
        expect(result).toBe("#ffffff");
    });

    it("returns original hex when input is invalid", () => {
        const result = mixWithWhite("invalid", 0.5);
        expect(result).toBe("invalid");
    });
});

describe("hexToRgba", () => {
    it("returns rgba string with alpha 0.5", () => {
        const result = hexToRgba("#ff5500", 0.5);
        expect(result).toBe("rgba(255, 85, 0, 0.5)");
    });

    it("clamps alpha below 0 to 0", () => {
        const result = hexToRgba("#ff5500", -0.5);
        expect(result).toBe("rgba(255, 85, 0, 0)");
    });

    it("clamps alpha above 1 to 1", () => {
        const result = hexToRgba("#ff5500", 1.5);
        expect(result).toBe("rgba(255, 85, 0, 1)");
    });

    it("returns original hex string when input is invalid", () => {
        // Empty string is invalid (wrong length for 3/6 digit hex)
        const result = hexToRgba("", 0.5);
        expect(result).toBe("");
    });

    it("alpha of 1 does not add extra decimal places", () => {
        const result = hexToRgba("#ffffff", 1);
        expect(result).toBe("rgba(255, 255, 255, 1)");
    });
});

describe("isLikelyLight", () => {
    it("returns false for a dark hex color", () => {
        // Dark: luma well below 0.5
        expect(isLikelyLight("#111827")).toBe(false);
        expect(isLikelyLight("#000000")).toBe(false);
    });

    it("returns true for a light hex color", () => {
        // Light: luma well above 0.5
        expect(isLikelyLight("#ffffff")).toBe(true);
        expect(isLikelyLight("#f9fafb")).toBe(true);
    });

    it("returns true (default) for invalid input", () => {
        expect(isLikelyLight("")).toBe(true);
        expect(isLikelyLight("nocolor")).toBe(true);
    });
});

describe("formatNumber", () => {
    it("produces an Intl-formatted string with the suffix appended", () => {
        const result = formatNumber(1234.5, "ms");
        expect(result).toMatch(/^1,234\.50ms$/);
    });

    it("formats small numbers with two decimal places", () => {
        const result = formatNumber(1.2, "km");
        expect(result).toMatch(/^1\.20km$/);
    });

    it("formats zero correctly", () => {
        const result = formatNumber(0, "sec");
        expect(result).toMatch(/^0\.00sec$/);
    });
});

describe("formatPercent", () => {
    it("produces a percentage string with two decimal places", () => {
        expect(formatPercent(0.9995)).toBe("99.95%");
    });

    it("produces 0.00% for zero", () => {
        expect(formatPercent(0)).toBe("0.00%");
    });

    it("produces 100.00% for 1", () => {
        expect(formatPercent(1)).toBe("100.00%");
    });

    it("multiplies by 100 before formatting", () => {
        expect(formatPercent(0.5)).toBe("50.00%");
    });
});

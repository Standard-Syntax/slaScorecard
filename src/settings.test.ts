import { describe, expect, it } from "vitest";
import { VisualFormattingSettingsModel } from "./settings";

describe("VisualFormattingSettingsModel", () => {
    it("instantiates with three cards", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.cards.length).toBe(3);
    });

    it("has statusColorsCard", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.statusColorsCard).toBeDefined();
        expect(model.statusColorsCard.name).toBe("statusColors");
    });

    it("has bandColorsCard", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.bandColorsCard).toBeDefined();
        expect(model.bandColorsCard.name).toBe("bandColors");
    });

    it("has generalCard", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.generalCard).toBeDefined();
        expect(model.generalCard.name).toBe("general");
    });

    it("statusColorsCard default metColor is #16A34A", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.statusColorsCard.metColor.value.value).toBe("#16A34A");
    });

    it("statusColorsCard default atRiskColor is #F59E0B", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.statusColorsCard.atRiskColor.value.value).toBe("#F59E0B");
    });

    it("statusColorsCard default breachedColor is #DC2626", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.statusColorsCard.breachedColor.value.value).toBe("#DC2626");
    });

    it("bandColorsCard has badColor defined", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.bandColorsCard.badColor).toBeDefined();
        expect(model.bandColorsCard.badColor.name).toBe("badColor");
    });

    it("bandColorsCard has cautionColor defined", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.bandColorsCard.cautionColor).toBeDefined();
        expect(model.bandColorsCard.cautionColor.name).toBe("cautionColor");
    });

    it("bandColorsCard has onTargetColor defined", () => {
        const model = new VisualFormattingSettingsModel();
        expect(model.bandColorsCard.onTargetColor).toBeDefined();
        expect(model.bandColorsCard.onTargetColor.name).toBe("onTargetColor");
    });
});

import { describe, expect, it } from "vitest";
import { STATUS_RANK, STATUS_LABEL } from "./types";

describe("STATUS_RANK", () => {
    it("breached has rank 0", () => {
        expect(STATUS_RANK.breached).toBe(0);
    });

    it("atRisk has rank 1", () => {
        expect(STATUS_RANK.atRisk).toBe(1);
    });

    it("met has rank 2", () => {
        expect(STATUS_RANK.met).toBe(2);
    });

    it("ranks are in ascending order of severity", () => {
        expect(STATUS_RANK.breached).toBeLessThan(STATUS_RANK.atRisk);
        expect(STATUS_RANK.atRisk).toBeLessThan(STATUS_RANK.met);
    });
});

describe("STATUS_LABEL", () => {
    it("met maps to 'On Target'", () => {
        expect(STATUS_LABEL.met).toBe("On Target");
    });

    it("atRisk maps to 'At Risk'", () => {
        expect(STATUS_LABEL.atRisk).toBe("At Risk");
    });

    it("breached maps to 'Breached'", () => {
        expect(STATUS_LABEL.breached).toBe("Breached");
    });

    it("all status keys are present", () => {
        const keys = Object.keys(STATUS_LABEL);
        expect(keys).toContain("met");
        expect(keys).toContain("atRisk");
        expect(keys).toContain("breached");
        expect(keys.length).toBe(3);
    });
});

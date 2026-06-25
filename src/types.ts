/*
 *  SLA Scorecard — Domain type definitions
 *
 *  Pure types: no runtime code, no side effects, no DOM. Anything that
 *  imports from this file should be testable without a Power BI host.
 */

import type powerbi from "powerbi-visuals-api";

export type ISelectionId = powerbi.visuals.ISelectionId;

export type SlaStatus = "met" | "atRisk" | "breached";

export interface SlaRow {
    slaId: string;
    slaName: string;
    category: string;
    ownerName: string;
    ownerInitials: string;
    ownerColor: string;
    current: number;
    target: number;
    badThreshold: number;
    cautionThreshold: number;
    timeToBreach: number | null;
    trend: number[];
    status: SlaStatus;
    highlight: boolean;
    selectionId: ISelectionId;
}

export interface CategoryBucket {
    name: string;
    count: number;
}

export interface StatusSummary {
    met: number;
    atRisk: number;
    breached: number;
}

export const STATUS_RANK: Record<SlaStatus, number> = {
    breached: 0,
    atRisk: 1,
    met: 2,
};

export const STATUS_LABEL: Record<SlaStatus, string> = {
    met: "On Target",
    atRisk: "At Risk",
    breached: "Breached",
};

export interface LegendSwatch {
    label: string;
    color: string;
    kind: "band" | "line";
}

/*
 *  SLA Scorecard — Row construction
 *
 *  Pure functions that turn a Power BI DataView into a list of `SlaRow`s.
 *  No DOM, no formatting pane reads — only data shape, parsing, and
 *  classification. Output rows are sorted by risk severity so the renderer
 *  can iterate in display order.
 */

import type powerbi from "powerbi-visuals-api";
import type {
    CategoryBucket,
    ISelectionId,
    SlaRow,
    SlaStatus,
} from "./types";
import { STATUS_RANK } from "./types";
import type { ISandboxExtendedColorPalette } from "./theme";

const TREND_DELIMITER = /[,;\s]+/;

const DEFAULT_OWNER_COLORS = [
    "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
    "#3B82F6", "#EF4444", "#14B8A6", "#F97316", "#0EA5E9",
];

/**
 * Parse a 30-day trend value. Accepts:
 *  - null / undefined → empty array
 *  - an array of numbers / numeric strings → filter non-numeric
 *  - a comma / semicolon / whitespace delimited string → split and filter
 */
export function parseTrend(value: unknown): number[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
        return value.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
    }
    const text = String(value).trim();
    if (!text) return [];
    return text
        .split(TREND_DELIMITER)
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v));
}

/** Resolve a stable color for an owner (palette hash with a fallback). */
export function deriveOwnerColor(
    owner: string,
    palette: ISandboxExtendedColorPalette,
    bucket: number,
): string {
    try {
        return palette.getColor(owner || `owner-${bucket}`).value;
    } catch {
        const fallback = DEFAULT_OWNER_COLORS[bucket % DEFAULT_OWNER_COLORS.length];
        return fallback ?? DEFAULT_OWNER_COLORS[0]!;
    }
}

/** One- or two-letter uppercase initials for an owner name. */
export function deriveInitials(name: string): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    const only = parts[0];
    if (parts.length === 1) {
        return (only ?? "").slice(0, 2).toUpperCase();
    }
    const first = only?.[0] ?? "";
    const lastChar = parts[parts.length - 1]?.[0] ?? "";
    return (first + lastChar).toUpperCase();
}

/**
 * Classify a current value against bad and caution thresholds.
 *
 * `current` is assumed to be in the same units as `badThreshold` and
 * `cautionThreshold` (typically a ratio from 0 to 1 for percentage SLAs).
 */
export function statusFromValue(
    current: number,
    target: number,
    badThreshold: number,
    cautionThreshold: number,
): SlaStatus {
    if (current <= badThreshold) return "breached";
    if (current <= cautionThreshold) return "atRisk";
    return "met";
}

/**
 * Compute bad and caution thresholds from a target value.
 *
 * The thresholds tighten as the target approaches 1 (high-target SLAs),
 * which prevents false negatives when the target is near 100%.
 */
export function deriveThresholds(target: number): { bad: number; caution: number } {
    if (target >= 0.95) {
        return { bad: target - 0.05, caution: target - 0.005 };
    }
    if (target >= 0.5) {
        return { bad: target * 0.85, caution: target * 0.97 };
    }
    if (target > 0) {
        return { bad: target * 0.7, caution: target * 0.9 };
    }
    return { bad: target * 1.2, caution: target * 1.05 };
}

interface ColumnByRole {
    [roleName: string]: powerbi.DataViewCategoryColumn | powerbi.DataViewValueColumn | undefined;
}

interface BuildRowsInput {
    dataView: powerbi.DataView;
    palette: ISandboxExtendedColorPalette;
    host: powerbi.extensibility.visual.IVisualHost;
}

/**
 * Transform a DataView into a sorted list of `SlaRow`s.
 *
 * The function is tolerant: missing categories default to "Uncategorized",
 * missing owners default to "Unassigned", and numeric coercion is wrapped
 * in `Number(...)` so string columns do not crash the renderer.
 */
export function buildRows({ dataView, palette, host }: BuildRowsInput): SlaRow[] {
    const categorical = dataView.categorical;
    if (!categorical) return [];

    const categories = categorical.categories ?? [];
    const values = categorical.values ?? [];

    const slaColumn = categories[0];
    const categoryColumn = categories[1];
    const ownerColumn = categories[2];

    const byRole: ColumnByRole = {};
    values.forEach((v) => {
        const roles = v.source.roles;
        if (!roles) return;
        Object.keys(roles).forEach((role) => {
            if (roles[role]) byRole[role] = v;
        });
    });

    const currentColumn = byRole["current"] ?? values[0];
    const targetColumn = byRole["target"] ?? values[1];
    const timeColumn = byRole["timeToBreach"] ?? values[2];
    const trendColumn = byRole["sparkline"] ?? values[3];

    const hasHighlights =
        !!currentColumn &&
        "highlights" in currentColumn &&
        !!(currentColumn as powerbi.DataViewValueColumn).highlights;

    const count = slaColumn ? slaColumn.values.length : 0;
    const rows: SlaRow[] = [];

    for (let i = 0; i < count; i++) {
        const slaName = slaColumn ? String(slaColumn.values[i] ?? "") : "";
        const category = categoryColumn
            ? String(categoryColumn.values[i] ?? "Uncategorized")
            : "Uncategorized";
        const ownerName = ownerColumn ? String(ownerColumn.values[i] ?? "") : "";
        const current = currentColumn ? Number(currentColumn.values[i] ?? 0) : 0;
        const target = targetColumn ? Number(targetColumn.values[i] ?? 0) : 0;
        const timeRaw = timeColumn ? timeColumn.values[i] : null;
        const timeToBreach =
            timeRaw === null || timeRaw === undefined || Number.isNaN(Number(timeRaw))
                ? null
                : Number(timeRaw);
        const trend = trendColumn ? parseTrend(trendColumn.values[i]) : [];
        const highlight = hasHighlights
            ? !!((currentColumn as powerbi.DataViewValueColumn).highlights?.[i])
            : false;

        const { bad, caution } = deriveThresholds(target);
        const status = statusFromValue(current, target, bad, caution);

        const selectionId = buildSelectionId(host, slaColumn, currentColumn, i);

        rows.push({
            slaId: `SLA-${String(i + 1).padStart(3, "0")}`,
            slaName,
            category,
            ownerName: ownerName || "Unassigned",
            ownerInitials: deriveInitials(ownerName),
            ownerColor: deriveOwnerColor(ownerName || category, palette, i),
            current,
            target,
            badThreshold: bad,
            cautionThreshold: caution,
            timeToBreach,
            trend,
            status,
            highlight,
            selectionId,
        });
    }

    rows.sort((a, b) => {
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rank !== 0) return rank;
        if (a.timeToBreach !== null && b.timeToBreach !== null) {
            return a.timeToBreach - b.timeToBreach;
        }
        return a.slaName.localeCompare(b.slaName);
    });

    return rows;
}

/**
 * Resolve a selection id for a row, preferring the SLA category when it
 * is bound and falling back to the current measure otherwise.
 */
function buildSelectionId(
    host: powerbi.extensibility.visual.IVisualHost,
    slaColumn: powerbi.DataViewCategoryColumn | undefined,
    currentColumn: powerbi.DataViewValueColumn | powerbi.DataViewCategoryColumn | undefined,
    index: number,
): ISelectionId {
    try {
        let builder = host.createSelectionIdBuilder();
        if (slaColumn) {
            builder = builder.withCategory(slaColumn, index);
        } else if (
            currentColumn &&
            "source" in currentColumn &&
            currentColumn.source?.queryName
        ) {
            builder = builder.withMeasure(currentColumn.source.queryName);
        } else {
            builder = builder.withMeasure("current");
        }
        return builder.createSelectionId();
    } catch {
        return host
            .createSelectionIdBuilder()
            .withMeasure("current")
            .createSelectionId();
    }
}

/**
 * Aggregate rows into the set of category buckets shown in the filter
 * pills. The "All" bucket is always first.
 */
export function buildCategoryBuckets(rows: SlaRow[]): CategoryBucket[] {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
        const key = row.category || "Uncategorized";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const buckets: CategoryBucket[] = [{ name: "All", count: rows.length }];
    Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([name, count]) => {
            buckets.push({ name, count });
        });
    return buckets;
}

/**
 * Pick a display format for the current value based on the target's
 * scale. Percentages render as "99.95%" while large numbers keep two
 * decimals to make small deltas visible.
 */
export function formatCurrentValue(row: SlaRow): string {
    if (row.target >= 100) {
        return row.current.toFixed(2);
    }
    if (row.target > 0 && row.target <= 1) {
        return `${(row.current * 100).toFixed(2)}%`;
    }
    if (row.target >= 10 && row.target < 1000) {
        return row.current.toFixed(0);
    }
    return row.current.toFixed(2);
}

/**
 * Pick a display format for the target value. Symmetric with
 * `formatCurrentValue` so the two columns line up visually.
 */
export function formatTargetValue(row: SlaRow): string {
    if (row.target >= 100) {
        return `${row.target.toFixed(2)}%`;
    }
    if (row.target > 0 && row.target <= 1) {
        return `${(row.target * 100).toFixed(2)}%`;
    }
    if (row.target >= 10 && row.target < 1000) {
        return row.target.toFixed(0);
    }
    return row.target.toString();
}

/**
 * Compute the max value for a bullet chart axis.
 *
 * Uses 1.2× the target as headroom so the target line and band
 * regions remain visible even when current ≈ target.
 */
export function computeBulletMaxValue(row: SlaRow): number {
    return Math.max(
        row.target * 1.2,
        row.current,
        row.badThreshold,
        row.cautionThreshold,
    );
}

export const SPARKLINE_GAIN_COLOR = "#10B981";
export const SPARKLINE_LOSS_COLOR = "#EF4444";
export const SPARKLINE_FLAT_COLOR = "#94A3B8";
export const SPARKLINE_FLAT_VALUES: readonly number[] = [
    50, 50, 50, 50, 50, 50, 50, 50,
];

export interface SparklineRenderOptions {
    values: number[];
    lineColor: string;
    fillColor: string;
    showDots: boolean;
}

function lastGteFirst(trend: readonly number[]): boolean {
    if (trend.length < 2) return false;
    return trend[trend.length - 1]! >= trend[0]!;
}

/**
 * Resolve render options for a sparkline from a trend array.
 *
 * Green  when the trend ends above or equal to where it started.
 * Red    when the trend ends strictly below where it started.
 * Flat   when there are fewer than 2 data points.
 */
export function resolveSparklineOptions(
    trend: readonly number[],
): SparklineRenderOptions {
    if (lastGteFirst(trend)) {
        return {
            values: [...trend],
            lineColor: SPARKLINE_GAIN_COLOR,
            fillColor: SPARKLINE_GAIN_COLOR,
            showDots: true,
        };
    }
    if (trend.length >= 2) {
        return {
            values: [...trend],
            lineColor: SPARKLINE_LOSS_COLOR,
            fillColor: SPARKLINE_LOSS_COLOR,
            showDots: true,
        };
    }
    return {
        values: [...SPARKLINE_FLAT_VALUES],
        lineColor: SPARKLINE_FLAT_COLOR,
        fillColor: SPARKLINE_FLAT_COLOR,
        showDots: false,
    };
}

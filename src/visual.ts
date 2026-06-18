/*
 *  Power BI Visual — slaScorecard
 *
 *  Renders an SLA scorecard table with category filter pills, a search box,
 *  status summary chips, bullet charts, and 30-day trend sparklines. Built
 *  on top of the standard `pbiviz new` template; replaces the placeholder
 *  update() with the real renderer.
 */

"use strict";

import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";

import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import IColorPalette = powerbi.extensibility.IColorPalette;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import { VisualFormattingSettingsModel } from "./settings";
import {
    CategoryBucket,
    SlaRow,
    SlaStatus,
    STATUS_LABEL,
    STATUS_RANK,
    StatusSummary,
} from "./types";
import { renderBulletChart } from "./bulletChart";
import { renderSparkline } from "./sparkline";
import {
    renderCategoryFilters,
    renderLandingPage,
    renderLegend,
    renderSearch,
    renderStatusSummary,
} from "./components";

const TREND_DELIMITER = /[,;\s]+/;
const SPARKLINE_FILL_ALPHA = 0.18;

const DEFAULT_OWNER_COLORS = [
    "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
    "#3B82F6", "#EF4444", "#14B8A6", "#F97316", "#0EA5E9",
];

interface ThemeColors {
    foreground: string;
    background: string;
    foregroundSelected: string;
    hyperlink: string;
    good: string;
    neutral: string;
    bad: string;
    textMuted: string;
    border: string;
    rowHover: string;
    headerBg: string;
    legendBg: string;
}

const FALLBACK_THEME: ThemeColors = {
    foreground: "#111827",
    background: "#FFFFFF",
    foregroundSelected: "#1F2937",
    hyperlink: "#2563EB",
    good: "#16A34A",
    neutral: "#F59E0B",
    bad: "#DC2626",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    rowHover: "#F9FAFB",
    headerBg: "#FFFFFF",
    legendBg: "#FAFAFA",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleaned = hex.replace("#", "").trim();
    if (cleaned.length !== 6 && cleaned.length !== 3) return null;
    const full = cleaned.length === 3
        ? cleaned.split("").map((c) => c + c).join("")
        : cleaned;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b };
}

function mixWithWhite(hex: string, ratio: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = Math.max(0, Math.min(1, ratio));
    const r = Math.round(rgb.r + (255 - rgb.r) * t);
    const g = Math.round(rgb.g + (255 - rgb.g) * t);
    const b = Math.round(rgb.b + (255 - rgb.b) * t);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function isLikelyLight(hex: string): boolean {
    const rgb = hexToRgb(hex);
    if (!rgb) return true;
    const luma = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luma > 0.5;
}

const NUMBER_FORMATTERS: Record<string, Intl.NumberFormat> = {};
function formatNumber(value: number, suffix: string): string {
    const key = `num-${suffix}`;
    if (!NUMBER_FORMATTERS[key]) {
        NUMBER_FORMATTERS[key] = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
    return NUMBER_FORMATTERS[key].format(value) + suffix;
}

function formatPercent(value: number): string {
    return (value * 100).toFixed(2) + "%";
}

function parseTrend(value: unknown): number[] {
    if (value == null) return [];
    if (Array.isArray(value)) {
        return value.map((v) => Number(v)).filter((v) => !isNaN(v));
    }
    const text = String(value).trim();
    if (!text) return [];
    return text.split(TREND_DELIMITER)
        .map((v) => Number(v))
        .filter((v) => !isNaN(v));
}

function deriveOwnerColor(owner: string, palette: ISandboxExtendedColorPalette, bucket: number): string {
    try {
        return palette.getColor(owner || `owner-${bucket}`).value;
    } catch {
        return DEFAULT_OWNER_COLORS[bucket % DEFAULT_OWNER_COLORS.length];
    }
}

function deriveInitials(name: string): string {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusFromValue(current: number, target: number, badThreshold: number, cautionThreshold: number): SlaStatus {
    if (current <= badThreshold) return "breached";
    if (current <= cautionThreshold) return "atRisk";
    return "met";
}

function deriveThresholds(target: number): { bad: number; caution: number } {
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

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private events: IVisualEventService;
    private colorPalette: ISandboxExtendedColorPalette;
    private colorHelper: ColorHelper;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private formattingSettings!: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    private rows: SlaRow[] = [];
    private categories: CategoryBucket[] = [];
    private activeCategory: string = "All";
    private searchQuery: string = "";
    private renderVersion: number = 0;

    private root!: HTMLElement;
    private filterRow!: HTMLElement;
    private searchSlot!: HTMLElement;
    private headerRow!: HTMLElement;
    private statusSummarySlot!: HTMLElement;
    private tableWrap!: HTMLElement;
    private tableBody!: HTMLElement;
    private legendSlot!: HTMLElement;
    private clearCatcherHandler: () => void;

    constructor(options: VisualConstructorOptions | undefined) {
        if (!options) {
            throw new Error("slaScorecard: VisualConstructorOptions is required");
        }
        this.host = options.host;
        this.target = options.element;
        this.events = options.host.eventService;
        this.colorPalette = options.host.colorPalette;
        this.colorHelper = new ColorHelper(options.host.colorPalette);
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipService = options.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();

        this.root = document.createElement("div");
        this.root.className = "sla-root";
        this.target.appendChild(this.root);

        this.filterRow = document.createElement("div");
        this.searchSlot = document.createElement("div");
        this.headerRow = document.createElement("div");
        this.statusSummarySlot = document.createElement("div");
        this.tableWrap = document.createElement("div");
        this.legendSlot = document.createElement("div");

        this.filterRow.className = "sla-section sla-section--filter";
        this.searchSlot.className = "sla-section sla-section--search";
        this.headerRow.className = "sla-section sla-section--header";
        this.statusSummarySlot.className = "sla-section sla-section--summary";
        this.tableWrap.className = "sla-section sla-section--table";
        this.legendSlot.className = "sla-section sla-section--legend";

        const headerLeft = document.createElement("div");
        headerLeft.className = "sla-header__left";
        const title = document.createElement("div");
        title.className = "sla-header__title";
        title.textContent = "SLA Scorecard";
        const subtitle = document.createElement("div");
        subtitle.className = "sla-header__subtitle";
        subtitle.textContent = "Sorted by risk \u00B7 click a row to drill down";
        headerLeft.appendChild(title);
        headerLeft.appendChild(subtitle);

        this.headerRow.appendChild(headerLeft);
        this.headerRow.appendChild(this.statusSummarySlot);

        this.root.appendChild(this.filterRow);
        this.root.appendChild(this.searchSlot);
        this.root.appendChild(this.headerRow);
        this.root.appendChild(this.tableWrap);
        this.root.appendChild(this.legendSlot);

        this.clearCatcherHandler = () => {
            this.selectionManager.clear();
            this.updateSelectionOpacity();
        };
        this.target.addEventListener("click", (event) => {
            if (event.target === this.target) {
                this.clearCatcherHandler();
            }
        });

        this.selectionManager.registerOnSelectCallback(() => this.updateSelectionOpacity());
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        if (options.type & powerbi.VisualUpdateType.Style) {
            this.colorPalette = this.host.colorPalette;
        }

        if (!options.dataViews || !options.dataViews[0]) {
            this.renderEmpty();
            this.events.renderingFinished(options);
            return;
        }

        const dataView = options.dataViews[0];
        if (!dataView.categorical) {
            this.renderEmpty();
            this.events.renderingFinished(options);
            return;
        }

        if (options.viewport.width <= 0 || options.viewport.height <= 0) {
            this.events.renderingFinished(options);
            return;
        }

        this.formattingSettings = this.formattingSettingsService
            .populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);

        this.applyThemeDefaults(dataView);

        try {
            this.buildRows(dataView);
            this.render();
            this.events.renderingFinished(options);
        } catch (error) {
            console.error("slaScorecard render error", error);
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private renderEmpty(): void {
        const theme = this.readTheme();
        this.applyThemeVariables(theme);
        renderLandingPage(this.root, () => {
            this.filterRow.replaceChildren();
            this.searchSlot.replaceChildren();
            this.headerRow.replaceChildren();
            this.statusSummarySlot.replaceChildren();
            this.tableWrap.replaceChildren();
            this.legendSlot.replaceChildren();
        });
    }

    private applyThemeDefaults(dataView: powerbi.DataView): void {
        const userObjects: powerbi.DataViewObjects | undefined = dataView.metadata?.objects;
        const hasObject = (key: string, prop: string): boolean => {
            const obj = userObjects && userObjects[key];
            return !!(obj && (obj as powerbi.DataViewObject)[prop]);
        };

        const theme = this.colorPalette;
        const isHC = !!this.colorHelper.isHighContrast;

        const themeGood = isHC ? theme.foreground?.value : (theme.positive?.value ?? theme.getColor("good").value);
        const themeNeutral = isHC ? theme.foreground?.value : (theme.neutral?.value ?? theme.getColor("neutral").value);
        const themeBad = isHC ? theme.foreground?.value : (theme.negative?.value ?? theme.getColor("bad").value);

        if (!hasObject("statusColors", "metColor")) {
            this.formattingSettings.statusColorsCard.metColor.value.value = themeGood;
        }
        if (!hasObject("statusColors", "atRiskColor")) {
            this.formattingSettings.statusColorsCard.atRiskColor.value.value = themeNeutral;
        }
        if (!hasObject("statusColors", "breachedColor")) {
            this.formattingSettings.statusColorsCard.breachedColor.value.value = themeBad;
        }

        if (!hasObject("bandColors", "badColor")) {
            this.formattingSettings.bandColorsCard.badColor.value.value = mixWithWhite(themeBad, 0.6);
        }
        if (!hasObject("bandColors", "cautionColor")) {
            this.formattingSettings.bandColorsCard.cautionColor.value.value = mixWithWhite(themeNeutral, 0.6);
        }
        if (!hasObject("bandColors", "onTargetColor")) {
            this.formattingSettings.bandColorsCard.onTargetColor.value.value = mixWithWhite(themeGood, 0.6);
        }
    }

    private readTheme(): ThemeColors {
        const palette = this.colorPalette;
        const isHC = !!this.colorHelper.isHighContrast;

        const get = (name: string, fallback: string): string => {
            try {
                const c = this.colorHelper.getThemeColor(name as any);
                return c || fallback;
            } catch {
                return fallback;
            }
        };

        const foreground = isHC
            ? (palette.foreground?.value ?? FALLBACK_THEME.foreground)
            : (get("foreground", FALLBACK_THEME.foreground));
        const background = isHC
            ? (palette.background?.value ?? FALLBACK_THEME.background)
            : (get("background", FALLBACK_THEME.background));
        const foregroundSelected = palette.foregroundSelected?.value ?? FALLBACK_THEME.foregroundSelected;
        const hyperlink = palette.hyperlink?.value ?? FALLBACK_THEME.hyperlink;

        const good = isHC
            ? foreground
            : (palette.positive?.value ?? get("good", FALLBACK_THEME.good));
        const neutral = isHC
            ? foreground
            : (palette.neutral?.value ?? get("neutral", FALLBACK_THEME.neutral));
        const bad = isHC
            ? foreground
            : (palette.negative?.value ?? get("bad", FALLBACK_THEME.bad));

        const backgroundLight = isHC
            ? background
            : (palette.backgroundLight?.value ?? mixWithWhite(background, 0.4));
        const foregroundNeutralTertiary = isHC
            ? foreground
            : (palette.foregroundNeutralTertiary?.value ?? FALLBACK_THEME.textMuted);

        return {
            foreground,
            background,
            foregroundSelected,
            hyperlink,
            good,
            neutral,
            bad,
            textMuted: foregroundNeutralTertiary,
            border: isHC ? foreground : (palette.foregroundNeutralTertiary?.value ?? FALLBACK_THEME.border),
            rowHover: backgroundLight,
            headerBg: background,
            legendBg: isHC ? background : (palette.backgroundNeutral?.value ?? FALLBACK_THEME.legendBg),
        };
    }

    private applyThemeVariables(theme: ThemeColors): void {
        const root = this.root;
        const setVar = (name: string, value: string): void => {
            root.style.setProperty(name, value);
        };

        setVar("--sla-fg", theme.foreground);
        setVar("--sla-bg", theme.background);
        setVar("--sla-fg-selected", theme.foregroundSelected);
        setVar("--sla-hyperlink", theme.hyperlink);
        setVar("--sla-fg-muted", theme.textMuted);
        setVar("--sla-border", theme.border);
        setVar("--sla-row-hover", theme.rowHover);
        setVar("--sla-header-bg", theme.headerBg);
        setVar("--sla-legend-bg", theme.legendBg);

        setVar("--sla-met", theme.good);
        setVar("--sla-at-risk", theme.neutral);
        setVar("--sla-breached", theme.bad);

        setVar("--sla-met-bg", hexToRgba(theme.good, 0.10));
        setVar("--sla-at-risk-bg", hexToRgba(theme.neutral, 0.12));
        setVar("--sla-breached-bg", hexToRgba(theme.bad, 0.10));

        setVar("--sla-band-bad", mixWithWhite(theme.bad, 0.6));
        setVar("--sla-band-caution", mixWithWhite(theme.neutral, 0.6));
        setVar("--sla-band-target", mixWithWhite(theme.good, 0.6));
        setVar("--sla-target-line", isLikelyLight(theme.background) ? "#111827" : "#F9FAFB");
    }

    private buildRows(dataView: powerbi.DataView): void {
        const categorical = dataView.categorical;
        if (!categorical) {
            this.rows = [];
            return;
        }

        const categories = categorical.categories ?? [];
        const values = categorical.values ?? [];

        const slaColumn = categories[0];
        const categoryColumn = categories[1];
        const ownerColumn = categories[2];

        const currentColumn = values.find((v) => v.source.roles && v.source.roles["current"]) || values[0];
        const targetColumn = values.find((v) => v.source.roles && v.source.roles["target"]) || values[1];
        const timeColumn = values.find((v) => v.source.roles && v.source.roles["timeToBreach"]) || values[2];
        const trendColumn = values.find((v) => v.source.roles && v.source.roles["sparkline"]) || values[3];

        const hasHighlights = !!currentColumn && !!currentColumn.highlights;

        const count = slaColumn ? slaColumn.values.length : 0;
        const rows: SlaRow[] = [];
        for (let i = 0; i < count; i++) {
            const slaName = slaColumn ? String(slaColumn.values[i] ?? "") : "";
            const category = categoryColumn ? String(categoryColumn.values[i] ?? "Uncategorized") : "Uncategorized";
            const ownerName = ownerColumn ? String(ownerColumn.values[i] ?? "") : "";
            const current = currentColumn ? Number(currentColumn.values[i] ?? 0) : 0;
            const target = targetColumn ? Number(targetColumn.values[i] ?? 0) : 0;
            const timeRaw = timeColumn ? timeColumn.values[i] : null;
            const timeToBreach = timeRaw == null || isNaN(Number(timeRaw)) ? null : Number(timeRaw);
            const trend = trendColumn ? parseTrend(trendColumn.values[i]) : [];
            const highlight = hasHighlights && !!(currentColumn && currentColumn.highlights && currentColumn.highlights[i]);

            const { bad, caution } = deriveThresholds(target);
            const status = statusFromValue(current, target, bad, caution);

            let selectionId: ISelectionId;
            try {
                let builder = this.host.createSelectionIdBuilder();
                if (slaColumn) {
                    builder = builder.withCategory(slaColumn, i);
                } else if (currentColumn && currentColumn.source && currentColumn.source.queryName) {
                    builder = builder.withMeasure(currentColumn.source.queryName);
                } else {
                    builder = builder.withMeasure("current");
                }
                selectionId = builder.createSelectionId();
            } catch (err) {
                console.warn("slaScorecard: could not build selection id", err);
                selectionId = this.host.createSelectionIdBuilder()
                    .withMeasure("current")
                    .createSelectionId();
            }

            const ownerInitials = deriveInitials(ownerName);

            rows.push({
                slaId: `SLA-${String(i + 1).padStart(3, "0")}`,
                slaName,
                category,
                ownerName: ownerName || "Unassigned",
                ownerInitials,
                ownerColor: deriveOwnerColor(ownerName || category, this.colorPalette, i),
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
            if (a.timeToBreach != null && b.timeToBreach != null) {
                return a.timeToBreach - b.timeToBreach;
            }
            return a.slaName.localeCompare(b.slaName);
        });

        this.rows = rows;
        this.categories = this.buildCategoryBuckets(rows);

        if (this.activeCategory !== "All" && !this.categories.find((c) => c.name === this.activeCategory)) {
            this.activeCategory = "All";
        }
    }

    private buildCategoryBuckets(rows: SlaRow[]): CategoryBucket[] {
        const counts = new Map<string, number>();
        rows.forEach((row) => {
            const key = row.category || "Uncategorized";
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        const buckets: CategoryBucket[] = [{ name: "All", count: rows.length }];
        Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([name, count]) => {
                buckets.push({ name, count });
            });
        return buckets;
    }

    private render(): void {
        const theme = this.readTheme();
        this.applyThemeVariables(theme);

        const showFilterPills = !!this.formattingSettings.generalCard.showFilterPills.value;
        const showSearch = !!this.formattingSettings.generalCard.showSearch.value;
        const showStatusSummary = !!this.formattingSettings.generalCard.showStatusSummary.value;
        const showLegend = !!this.formattingSettings.generalCard.showLegend.value;

        this.filterRow.style.display = showFilterPills ? "" : "none";
        this.searchSlot.style.display = showSearch ? "" : "none";
        this.statusSummarySlot.style.display = showStatusSummary ? "" : "none";
        this.legendSlot.style.display = showLegend ? "" : "none";

        if (showFilterPills) {
            renderCategoryFilters(this.filterRow, this.categories, this.activeCategory, {
                onSelect: (name) => {
                    this.activeCategory = name;
                    this.renderTable();
                },
            });
        } else {
            this.filterRow.replaceChildren();
        }

        if (showSearch) {
            const input = renderSearch(this.searchSlot, this.searchQuery, {
                onInput: (value) => {
                    this.searchQuery = value;
                    this.renderTable();
                },
            });
            input.value = this.searchQuery;
        } else {
            this.searchSlot.replaceChildren();
        }

        if (showStatusSummary) {
            const summary = this.computeStatusSummary(this.rows);
            const theme = this.readTheme();
            renderStatusSummary(this.statusSummarySlot, summary, {
                met: theme.good,
                atRisk: theme.neutral,
                breached: theme.bad,
            });
        } else {
            this.statusSummarySlot.replaceChildren();
        }

        this.renderTable();

        if (showLegend) {
            const band = this.formattingSettings.bandColorsCard;
            const targetLine = this.getComputedCssVar("--sla-target-line", theme.foreground);
            renderLegend(this.legendSlot, [
                { label: "Bad range", color: band.badColor.value.value, kind: "band" },
                { label: "Caution", color: band.cautionColor.value.value, kind: "band" },
                { label: "On target", color: band.onTargetColor.value.value, kind: "band" },
                { label: "Target line", color: targetLine, kind: "line" },
            ], "Bullet chart shows current vs target with qualitative bands \u00B7 sparkline shows 30-day trend");
        } else {
            this.legendSlot.replaceChildren();
        }
    }

    private getComputedCssVar(name: string, fallback: string): string {
        const v = getComputedStyle(this.root).getPropertyValue(name);
        return (v && v.trim()) || fallback;
    }

    private renderTable(): void {
        const filtered = this.applyFilters();
        const summary = this.computeStatusSummary(filtered);
        const targetLineColor = this.getComputedCssVar("--sla-target-line", this.readTheme().foreground);

        this.tableWrap.replaceChildren();

        const table = document.createElement("div");
        table.className = "sla-table";
        table.setAttribute("role", "table");
        table.setAttribute("aria-label", "SLA scorecard");

        const head = document.createElement("div");
        head.className = "sla-table__head";
        head.setAttribute("role", "row");
        ["SLA", "Category", "Owner", "Current", "Target", "Performance vs Target", "30D Trend", "Status", "Time-to-Breach"]
            .forEach((label) => {
                const cell = document.createElement("div");
                cell.className = "sla-cell sla-cell--head";
                cell.setAttribute("role", "columnheader");
                cell.textContent = label;
                head.appendChild(cell);
            });
        table.appendChild(head);

        const body = document.createElement("div");
        body.className = "sla-table__body";
        body.setAttribute("role", "rowgroup");
        this.tableBody = body;

        if (filtered.length === 0) {
            const empty = document.createElement("div");
            empty.className = "sla-empty";
            empty.textContent = "No SLAs match the current filters.";
            table.appendChild(empty);
        } else {
            const colors = this.statusColors();
            const bandColors = this.formattingSettings.bandColorsCard;
            const fontSize = this.formattingSettings.generalCard.fontSize.value;

            filtered.forEach((row, idx) => {
                const tr = document.createElement("div");
                tr.className = `sla-row sla-row--${row.status}`;
                tr.setAttribute("role", "row");
                tr.setAttribute("tabindex", "0");
                tr.setAttribute("aria-label",
                    `${row.slaName}, status ${STATUS_LABEL[row.status]}, current ${this.formatCurrentValue(row)}, target ${this.formatTargetValue(row)}`);
                tr.style.fontSize = `${fontSize}px`;
                tr.dataset["index"] = String(idx);

                const nameCell = document.createElement("div");
                nameCell.className = "sla-cell sla-cell--name";
                const nameEl = document.createElement("div");
                nameEl.className = "sla-name";
                nameEl.textContent = row.slaName;
                const idEl = document.createElement("div");
                idEl.className = "sla-id";
                idEl.textContent = `ID: ${row.slaId}`;
                nameCell.appendChild(nameEl);
                nameCell.appendChild(idEl);

                const catCell = document.createElement("div");
                catCell.className = "sla-cell sla-cell--category";
                const catTag = document.createElement("span");
                catTag.className = "sla-tag";
                catTag.textContent = row.category;
                catCell.appendChild(catTag);

                const ownerCell = document.createElement("div");
                ownerCell.className = "sla-cell sla-cell--owner";
                const avatar = document.createElement("span");
                avatar.className = "sla-avatar";
                avatar.textContent = row.ownerInitials;
                avatar.style.background = row.ownerColor;
                const ownerName = document.createElement("span");
                ownerName.className = "sla-owner__name";
                ownerName.textContent = row.ownerName;
                ownerCell.appendChild(avatar);
                ownerCell.appendChild(ownerName);

                const currentCell = document.createElement("div");
                currentCell.className = "sla-cell sla-cell--current";
                const currentVal = document.createElement("span");
                currentVal.className = `sla-current sla-current--${row.status}`;
                currentVal.textContent = this.formatCurrentValue(row);
                currentCell.appendChild(currentVal);

                const targetCell = document.createElement("div");
                targetCell.className = "sla-cell sla-cell--target";
                targetCell.textContent = this.formatTargetValue(row);

                const bulletCell = document.createElement("div");
                bulletCell.className = "sla-cell sla-cell--bullet";
                const bulletHolder = document.createElement("div");
                bulletHolder.className = "sla-bullet";
                bulletCell.appendChild(bulletHolder);

                const sparkCell = document.createElement("div");
                sparkCell.className = "sla-cell sla-cell--spark";
                const sparkHolder = document.createElement("div");
                sparkHolder.className = "sla-spark";
                sparkCell.appendChild(sparkHolder);

                const statusCell = document.createElement("div");
                statusCell.className = "sla-cell sla-cell--status";
                const statusPill = document.createElement("span");
                statusPill.className = `sla-status sla-status--${row.status}`;
                const dot = document.createElement("span");
                dot.className = "sla-status__dot";
                statusPill.appendChild(dot);
                const statusText = document.createElement("span");
                statusText.textContent = STATUS_LABEL[row.status];
                statusPill.appendChild(statusText);
                statusCell.appendChild(statusPill);

                const tCell = document.createElement("div");
                tCell.className = "sla-cell sla-cell--ttb";
                tCell.textContent = row.timeToBreach == null ? "\u2014" : `${row.timeToBreach.toFixed(1)}d`;

                tr.appendChild(nameCell);
                tr.appendChild(catCell);
                tr.appendChild(ownerCell);
                tr.appendChild(currentCell);
                tr.appendChild(targetCell);
                tr.appendChild(bulletCell);
                tr.appendChild(sparkCell);
                tr.appendChild(statusCell);
                tr.appendChild(tCell);

                this.attachRowEvents(tr, row);
                body.appendChild(tr);
            });

            requestAnimationFrame(() => {
                if (this.renderVersion !== (this as any)._lastVersion) return;
                (this as any)._lastVersion = this.renderVersion;
                const rows = body.querySelectorAll<HTMLElement>(".sla-row");
                rows.forEach((rowEl) => {
                    const idx = Number(rowEl.dataset["index"]);
                    const data = filtered[idx];
                    if (!data) return;
                    const bullet = rowEl.querySelector<HTMLElement>(".sla-bullet");
                    const spark = rowEl.querySelector<HTMLElement>(".sla-spark");
                    if (bullet) {
                        const maxVal = Math.max(
                            data.target * 1.2,
                            data.current,
                            data.badThreshold,
                            data.cautionThreshold,
                        );
                        renderBulletChart(bullet, {
                            width: bullet.clientWidth || 200,
                            height: 24,
                            current: data.current,
                            target: data.target,
                            badThreshold: data.badThreshold,
                            cautionThreshold: data.cautionThreshold,
                            maxValue: maxVal,
                            badColor: bandColors.badColor.value.value,
                            cautionColor: bandColors.cautionColor.value.value,
                            onTargetColor: bandColors.onTargetColor.value.value,
                            barColor: colors[data.status],
                            targetLineColor: targetLineColor,
                        });
                    }
                    if (spark && data.trend.length >= 2) {
                        const trendColor = data.trend[data.trend.length - 1] >= data.trend[0] ? "#10B981" : "#EF4444";
                        renderSparkline(spark, {
                            width: spark.clientWidth || 140,
                            height: 36,
                            values: data.trend,
                            lineColor: trendColor,
                            fillColor: trendColor,
                            showDots: true,
                        });
                    } else if (spark) {
                        const trendColor = "#94A3B8";
                        renderSparkline(spark, {
                            width: spark.clientWidth || 140,
                            height: 36,
                            values: this.flatSparkline(),
                            lineColor: trendColor,
                            fillColor: trendColor,
                            showDots: false,
                        });
                    }
                });
            });
        }

        table.appendChild(body);
        this.tableWrap.appendChild(table);

        this.updateSelectionOpacity();
    }

    private flatSparkline(): number[] {
        return [50, 50, 50, 50, 50, 50, 50, 50];
    }

    private applyFilters(): SlaRow[] {
        const query = this.searchQuery.trim().toLowerCase();
        return this.rows.filter((row) => {
            if (this.activeCategory !== "All" && row.category !== this.activeCategory) {
                return false;
            }
            if (query && !row.slaName.toLowerCase().includes(query)) {
                return false;
            }
            return true;
        });
    }

    private computeStatusSummary(rows: SlaRow[]): StatusSummary {
        const summary: StatusSummary = { met: 0, atRisk: 0, breached: 0 };
        rows.forEach((row) => {
            summary[row.status]++;
        });
        return summary;
    }

    private statusColors(): Record<SlaStatus, string> {
        const card = this.formattingSettings.statusColorsCard;
        return {
            met: card.metColor.value.value,
            atRisk: card.atRiskColor.value.value,
            breached: card.breachedColor.value.value,
        };
    }

    private formatCurrentValue(row: SlaRow): string {
        if (row.target >= 100) {
            return formatNumber(row.current, "");
        }
        if (row.target > 0 && row.target <= 1) {
            return formatPercent(row.current);
        }
        if (row.target >= 10 && row.target < 1000) {
            return row.current.toFixed(0);
        }
        return formatNumber(row.current, "");
    }

    private formatTargetValue(row: SlaRow): string {
        if (row.target >= 100) {
            return row.target.toFixed(2) + "%";
        }
        if (row.target > 0 && row.target <= 1) {
            return formatPercent(row.target);
        }
        if (row.target >= 10 && row.target < 1000) {
            return row.target.toFixed(0);
        }
        return row.target.toString();
    }

    private attachRowEvents(rowEl: HTMLElement, row: SlaRow): void {
        const allowInteractions = !!this.host.hostCapabilities.allowInteractions;

        rowEl.addEventListener("click", (event) => {
            event.stopPropagation();
            if (!allowInteractions) return;
            const isMulti = (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey;
            this.selectionManager.select(row.selectionId, isMulti).then(() => {
                this.updateSelectionOpacity();
            });
            this.host.drill({
                roleName: "sla",
                drillType: powerbi.DrillType.Down,
            });
        });

        rowEl.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.selectionManager.select(row.selectionId).then(() => this.updateSelectionOpacity());
                this.host.drill({
                    roleName: "sla",
                    drillType: powerbi.DrillType.Down,
                });
            } else if (event.key === "Escape") {
                this.selectionManager.clear();
                this.updateSelectionOpacity();
            } else if (event.key === "ArrowDown") {
                const next = rowEl.nextElementSibling as HTMLElement | null;
                if (next) { next.focus(); event.preventDefault(); }
            } else if (event.key === "ArrowUp") {
                const prev = rowEl.previousElementSibling as HTMLElement | null;
                if (prev) { prev.focus(); event.preventDefault(); }
            }
        });

        rowEl.addEventListener("mouseover", (event) => this.showTooltip(event as MouseEvent, row));
        rowEl.addEventListener("mousemove", (event) => this.moveTooltip(event as MouseEvent));
        rowEl.addEventListener("mouseout", () => this.hideTooltip());

        rowEl.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!this.host.hostCapabilities.allowInteractions) return;
            const contextMenu = (this.host as any).contextMenuService;
            if (contextMenu && typeof contextMenu.show === "function") {
                contextMenu.show({
                    coordinates: [event.clientX, event.clientY],
                    dataItems: [
                        { displayName: "SLA", value: row.slaName },
                        { displayName: "Category", value: row.category },
                        { displayName: "Status", value: STATUS_LABEL[row.status] },
                    ],
                });
            }
        });
    }

    private showTooltip(event: MouseEvent, row: SlaRow): void {
        if (!this.tooltipService.enabled()) return;
        const items: VisualTooltipDataItem[] = [
            { displayName: "SLA", value: row.slaName },
            { displayName: "Category", value: row.category },
            { displayName: "Owner", value: row.ownerName },
            { displayName: "Current", value: this.formatCurrentValue(row) },
            { displayName: "Target", value: this.formatTargetValue(row) },
            { displayName: "Status", value: STATUS_LABEL[row.status] },
        ];
        if (row.timeToBreach != null) {
            items.push({ displayName: "Time to breach", value: `${row.timeToBreach.toFixed(1)} days` });
        }
        this.tooltipService.show({
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
            dataItems: items,
            identities: [row.selectionId],
        });
    }

    private moveTooltip(event: MouseEvent): void {
        this.tooltipService.move({
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
            dataItems: [],
            identities: [],
        });
    }

    private hideTooltip(): void {
        this.tooltipService.hide({ immediately: true, isTouchEvent: false });
    }

    private updateSelectionOpacity(): void {
        if (!this.tableBody) return;
        const hasSelection = this.selectionManager.hasSelection();
        const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
        const rows = this.tableBody.querySelectorAll<HTMLElement>(".sla-row");
        rows.forEach((rowEl) => {
            const idx = Number(rowEl.dataset["index"]);
            const dp = this.rows[idx];
            if (!dp) return;
            if (!hasSelection) {
                rowEl.style.opacity = dp.highlight ? "0.5" : "1";
            } else {
                const isSelected = selectedIds.some((id) => id.equals(dp.selectionId));
                rowEl.style.opacity = isSelected || dp.highlight ? "1" : "0.3";
            }
        });
    }
}

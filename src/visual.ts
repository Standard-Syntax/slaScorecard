/*
 *  Power BI Visual — slaScorecard
 *
 *  Renders an SLA scorecard table with category filter pills, a search box,
 *  status summary chips, bullet charts, and 30-day trend sparklines.
 *
 *  Responsibilities are split across modules:
 *    - settings.ts:        format-pane model
 *    - theme.ts:           color helpers + theme variable application
 *    - row-builder.ts:     data shaping + classification
 *    - table-renderer.ts:  table DOM construction
 *    - row-interactions.ts: per-row events + selection opacity
 *    - chrome.ts:          header chrome orchestration
 *    - components.ts:      pure DOM builders for the chrome regions
 *    - bulletChart.ts / sparkline.ts: chart primitives
 *
 *  This file is the orchestration root: it owns the visual lifecycle
 *  (constructor + update + formatting model), wires the chrome to data,
 *  and delegates rendering to the helpers above.
 */

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import powerbi from "powerbi-visuals-api";

import "./../style/visual.less";

import { VisualFormattingSettingsModel } from "./settings";
import type { CategoryBucket, SlaRow } from "./types";
import {
    applyThemeDefaultsToModel,
    applyThemeVariables,
    readCssVar,
    readTheme,
} from "./theme";
import {
    buildCategoryBuckets,
    buildRows,
} from "./row-builder";
import { renderTable } from "./table-renderer";
import { renderChrome } from "./chrome";
import { updateSelectionOpacity } from "./row-interactions";
import {
    renderLandingPage,
    type LegendSwatch,
} from "./components";

type ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
type ISelectionManager = powerbi.extensibility.ISelectionManager;
type IVisualEventService = powerbi.extensibility.IVisualEventService;
type IVisualHost = powerbi.extensibility.visual.IVisualHost;
type ITooltipService = powerbi.extensibility.ITooltipService;
type IVisual = powerbi.extensibility.visual.IVisual;
type VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
type VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

// `powerbi.VisualUpdateType` is an ambient `const enum`; with
// `isolatedModules` enabled, TypeScript forbids referencing it directly.
// Inlined numeric values match the upstream enum (Style = 1 << 4 = 16).
const VISUAL_UPDATE_TYPE_STYLE = 16;

const CATEGORY_ALL = "All";
const DEFAULT_TARGET_LINE_COLOR = "#111827";
const LEGEND_CAPTION =
    "Bullet chart shows current vs target with qualitative bands \u00B7 sparkline shows 30-day trend";

export class Visual implements IVisual {
    private readonly host: IVisualHost;
    private readonly target: HTMLElement;
    private readonly events: IVisualEventService;
    private readonly colorHelper: ColorHelper;
    private readonly selectionManager: ISelectionManager;
    private readonly tooltipService: ITooltipService;
    private readonly formattingSettingsService: FormattingSettingsService;
    private readonly root: HTMLElement;

    private readonly filterRow: HTMLElement;
    private readonly searchSlot: HTMLElement;
    private readonly headerRow: HTMLElement;
    private readonly statusSummarySlot: HTMLElement;
    private readonly tableWrap: HTMLElement;
    private readonly legendSlot: HTMLElement;

    private colorPalette: ISandboxExtendedColorPalette;
    private formattingSettings!: VisualFormattingSettingsModel;

    private rows: SlaRow[] = [];
    private renderedRows: SlaRow[] = [];
    private categories: CategoryBucket[] = [];
    private activeCategory: string = CATEGORY_ALL;
    private searchQuery: string = "";
    private renderVersion: number = 0;
    private tableBody: HTMLElement | null = null;

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

        this.filterRow = this.buildSection("filter");
        this.searchSlot = this.buildSection("search");
        this.headerRow = this.buildSection("header");
        this.statusSummarySlot = this.buildSection("summary");
        this.tableWrap = this.buildSection("table");
        this.legendSlot = this.buildSection("legend");

        this.headerRow.appendChild(this.buildHeaderLeft());
        this.headerRow.appendChild(this.statusSummarySlot);

        this.root.appendChild(this.filterRow);
        this.root.appendChild(this.searchSlot);
        this.root.appendChild(this.headerRow);
        this.root.appendChild(this.tableWrap);
        this.root.appendChild(this.legendSlot);

        this.installClearCatcher();
        this.selectionManager.registerOnSelectCallback(() =>
            updateSelectionOpacity({
                tableBody: this.requireTableBody(),
                rows: this.renderedRows,
                selectionManager: this.selectionManager,
            }),
        );
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        if (options.type & VISUAL_UPDATE_TYPE_STYLE) {
            this.colorPalette = this.host.colorPalette;
        }

        const dataView = options.dataViews?.[0];
        if (!dataView || !dataView.categorical) {
            this.renderEmpty();
            this.events.renderingFinished(options);
            return;
        }

        if (options.viewport.width <= 0 || options.viewport.height <= 0) {
            this.events.renderingFinished(options);
            return;
        }

        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            dataView,
        );

        applyThemeDefaultsToModel({
            dataView,
            palette: this.colorPalette,
            isHighContrast: !!this.colorHelper.isHighContrast,
            setter: {
                setColor: (slot, value) => {
                    this.formattingSettings.statusColorsCard[slot].value.value = value;
                },
                setBand: (slot, value) => {
                    this.formattingSettings.bandColorsCard[slot].value.value = value;
                },
            },
        });

        try {
            this.rows = buildRows({
                dataView,
                palette: this.colorPalette,
                host: this.host,
            });
            this.categories = buildCategoryBuckets(this.rows);
            this.resetCategoryIfStale();
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

    private resetCategoryIfStale(): void {
        if (
            this.activeCategory !== CATEGORY_ALL &&
            !this.categories.some((c) => c.name === this.activeCategory)
        ) {
            this.activeCategory = CATEGORY_ALL;
        }
    }

    private buildSection(suffix: string): HTMLElement {
        const el = document.createElement("div");
        el.className = `sla-section sla-section--${suffix}`;
        return el;
    }

    private buildHeaderLeft(): HTMLElement {
        const left = document.createElement("div");
        left.className = "sla-header__left";

        const title = document.createElement("div");
        title.className = "sla-header__title";
        title.textContent = "SLA Scorecard";

        const subtitle = document.createElement("div");
        subtitle.className = "sla-header__subtitle";
        subtitle.textContent = "Sorted by risk \u00B7 click a row to drill down";

        left.appendChild(title);
        left.appendChild(subtitle);
        return left;
    }

    private installClearCatcher(): void {
        this.target.addEventListener("click", (event) => {
            if (event.target !== this.target) return;
            this.selectionManager.clear();
            updateSelectionOpacity({
                tableBody: this.requireTableBody(),
                rows: this.renderedRows,
                selectionManager: this.selectionManager,
            });
        });
    }

    private requireTableBody(): HTMLElement {
        return this.tableBody ?? document.createElement("div");
    }

    private renderEmpty(): void {
        const theme = readTheme({
            colorPalette: this.colorPalette,
            colorHelper: this.colorHelper,
        });
        applyThemeVariables(this.root, theme);
        renderLandingPage(this.root, () => {
            this.filterRow.replaceChildren();
            this.searchSlot.replaceChildren();
            this.headerRow.replaceChildren();
            this.statusSummarySlot.replaceChildren();
            this.tableWrap.replaceChildren();
            this.legendSlot.replaceChildren();
        });
    }

    private render(): void {
        const theme = readTheme({
            colorPalette: this.colorPalette,
            colorHelper: this.colorHelper,
        });
        applyThemeVariables(this.root, theme);

        const { generalCard } = this.formattingSettings;
        const bandCard = this.formattingSettings.bandColorsCard;
        const targetLine = readCssVar(this.root, "--sla-target-line", DEFAULT_TARGET_LINE_COLOR);
        const legendSwatches: LegendSwatch[] = [
            { label: "Bad range", color: bandCard.badColor.value.value, kind: "band" },
            { label: "Caution", color: bandCard.cautionColor.value.value, kind: "band" },
            { label: "On target", color: bandCard.onTargetColor.value.value, kind: "band" },
            { label: "Target line", color: targetLine, kind: "line" },
        ];

        renderChrome({
            filterRow: this.filterRow,
            searchSlot: this.searchSlot,
            statusSummarySlot: this.statusSummarySlot,
            legendSlot: this.legendSlot,
            rows: this.rows,
            categories: this.categories,
            activeCategory: this.activeCategory,
            searchQuery: this.searchQuery,
            showFilterPills: !!generalCard.showFilterPills.value,
            showSearch: !!generalCard.showSearch.value,
            showStatusSummary: !!generalCard.showStatusSummary.value,
            showLegend: !!generalCard.showLegend.value,
            statusTheme: {
                good: theme.good,
                neutral: theme.neutral,
                bad: theme.bad,
            },
            legendSwatches,
            legendCaption: LEGEND_CAPTION,
            onCategorySelect: (name) => {
                this.activeCategory = name;
                this.renderTable();
            },
            onSearchInput: (value) => {
                this.searchQuery = value;
                this.renderTable();
            },
        });

        this.renderTable();
    }

    private renderTable(): void {
        this.renderVersion++;
        const filtered = this.applyFilters();
        this.renderedRows = filtered;
        const targetLineColor = readCssVar(
            this.root,
            "--sla-target-line",
            DEFAULT_TARGET_LINE_COLOR,
        );

        const currentRenderVersion = this.renderVersion;
        const onSelectionChange = (): void => {
            updateSelectionOpacity({
                tableBody: this.requireTableBody(),
                rows: this.renderedRows,
                selectionManager: this.selectionManager,
            });
        };

        this.tableBody = renderTable({
            tableWrap: this.tableWrap,
            rows: filtered,
            targetLineColor,
            statusColors: this.statusColors(),
            bandColors: {
                badColor: this.formattingSettings.bandColorsCard.badColor.value.value,
                cautionColor: this.formattingSettings.bandColorsCard.cautionColor.value.value,
                onTargetColor: this.formattingSettings.bandColorsCard.onTargetColor.value.value,
            },
            fontSize: this.formattingSettings.generalCard.fontSize.value,
            renderVersion: currentRenderVersion,
            onSelectionChange,
            attachRowEventsArgs: {
                host: this.host,
                selectionManager: this.selectionManager,
                tooltipService: this.tooltipService,
                renderVersion: currentRenderVersion,
                onSelectionChange,
            },
        });

        // Re-apply the current selection to the freshly created DOM after
        // a microtask so the rows exist when the function inspects them.
        queueMicrotask(() => {
            if (this.renderVersion !== currentRenderVersion) return;
            updateSelectionOpacity({
                tableBody: this.requireTableBody(),
                rows: filtered,
                selectionManager: this.selectionManager,
            });
        });
    }

    private applyFilters(): SlaRow[] {
        const query = this.searchQuery.trim().toLowerCase();
        return this.rows.filter((row) => {
            if (this.activeCategory !== CATEGORY_ALL && row.category !== this.activeCategory) {
                return false;
            }
            if (query && !row.slaName.toLowerCase().includes(query)) {
                return false;
            }
            return true;
        });
    }

    private statusColors(): { met: string; atRisk: string; breached: string } {
        const card = this.formattingSettings.statusColorsCard;
        return {
            met: card.metColor.value.value,
            atRisk: card.atRiskColor.value.value,
            breached: card.breachedColor.value.value,
        };
    }
}

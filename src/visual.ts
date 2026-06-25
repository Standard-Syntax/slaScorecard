/*
 * Power BI Visual — slaScorecard
 *
 * Renders an SLA scorecard table with category filter pills, a search box,
 * status summary chips, bullet charts, and 30-day trend sparklines.
 *
 * Architecture (Phase 2+):
 *   - visual.ts:       Power BI lifecycle root — owns constructor, update(),
 *                      getFormattingModel(), installClearCatcher(). Delegated all
 *                      rendering to App.svelte.
 *   - App.svelte:      Svelte 5 mounted component — owns the DOM tree, state,
 *                      and all rendering via applyUpdate(). Renders the table via
 *                      SlaTable.svelte.
 *   - settings.ts:      format-pane model
 *   - theme.ts:        color helpers + theme variable application
 *   - row-builder.ts:  data shaping + classification
 *   - components/FilterPills.svelte:   category filter pill row
 *   - components/SearchBox.svelte:     search input
 *   - components/StatusSummary.svelte: status summary chips
 *   - components/Legend.svelte:        bottom legend
 *   - components/LandingPage.svelte:   empty-state role-mapping instructions
 *   - components/SlaTable.svelte:      table with selection-opacity effect
 *   - bulletChart.ts / sparkline.ts: chart primitives
 *   - opacity-constants.ts: selection-opacity tier values
 *   - row-tooltip.ts:   tooltip show/move/hide helpers
 *
 * Visual owns:  lifecycle, format pane model, clear-catcher click handler.
 * App.svelte owns: everything rendered — the full DOM tree, theme application,
 *                  dataView parsing, buildRows, buildCategoryBuckets, table render.
 */

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import { mount } from "svelte";
import powerbi from "powerbi-visuals-api";

import "./../style/visual.less";

import { VisualFormattingSettingsModel } from "./settings";
import { applyThemeDefaultsToModel } from "./theme";

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

// AppInstance is the shape of the mount handle returned by Svelte 5's mount().
type AppInstance = {
    applyUpdate: (opts: VisualUpdateOptions) => void;
};

// Lazy import — resolved at bundle time by webpack's dual-entry.
// webpack.config.js builds svelte-bundle first (visual.ts depends on it),
// then visual-bundle. At packaging time pbiviz's webpack does NOT have
// svelte-loader, so we import the pre-built artifact.
import App from "../.tmp/build/svelte-bundle.js";

export class Visual implements IVisual {
    private readonly host: IVisualHost;
    private readonly target: HTMLElement;
    private readonly events: IVisualEventService;
    private readonly colorHelper: ColorHelper;
    private readonly selectionManager: ISelectionManager;
    private readonly tooltipService: ITooltipService;
    private readonly formattingSettingsService: FormattingSettingsService;

    private app: AppInstance | null = null;
    private colorPalette: ISandboxExtendedColorPalette;
    private formattingSettings!: VisualFormattingSettingsModel;

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

        // Mount App.svelte onto the raw visual element. App.svelte owns its own
        // .sla-root div — visual.ts no longer creates one imperatively.
        this.app = mount(App, {
            target: this.target,
            props: {
                host: this.host,
                colorPalette: this.colorPalette,
                colorHelper: this.colorHelper,
                selectionManager: this.selectionManager,
                tooltipService: this.tooltipService,
                formattingSettingsService: this.formattingSettingsService,
            },
        }) as unknown as AppInstance;

        this.installClearCatcher();
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        if (options.type & VISUAL_UPDATE_TYPE_STYLE) {
            this.colorPalette = this.host.colorPalette;
        }

        const dataView = options.dataViews?.[0];
        if (!dataView || !dataView.categorical) {
            this.app?.applyUpdate(options);
            this.events.renderingFinished(options);
            return;
        }

        if (options.viewport.width <= 0 || options.viewport.height <= 0) {
            this.app?.applyUpdate(options);
            this.events.renderingFinished(options);
            return;
        }

        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            dataView,
        );

        // Apply theme defaults to Visual's canonical formattingSettings (used by
        // getFormattingModel). App.svelte applies the same defaults to its own
        // copy — idempotent so both stay consistent.
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
            this.app?.applyUpdate(options);
            this.events.renderingFinished(options);
        } catch (error) {
            console.error("slaScorecard render error", error);
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private installClearCatcher(): void {
        // Attached to this.target (NOT the Svelte root). The Svelte tree inside
        // target catches clicks first, so this only fires when the user clicks
        // empty space (the visual element itself, not a child).
        this.target.addEventListener("click", (event) => {
            if (event.target !== this.target) return;
            this.selectionManager.clear();
        });
    }
}

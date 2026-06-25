<script lang="ts">
  // Svelte 5 App.svelte — Phase 3 chrome wiring
  // Do NOT modify: visual.ts, row-builder.ts, theme.ts, settings.ts, types.ts

  import powerbi from "powerbi-visuals-api";
  import type { ColorHelper } from "powerbi-visuals-utils-colorutils";
  import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

  import { VisualFormattingSettingsModel } from "./settings";
  import type { SlaRow, CategoryBucket, LegendSwatch } from "./types";
  import { buildRows, buildCategoryBuckets } from "./row-builder";
  import {
    applyThemeDefaultsToModel,
    readCssVar,
    readTheme,
    applyThemeVariables,
  } from "./theme";

  import FilterPills from "./components/FilterPills.svelte";
  import SearchBox from "./components/SearchBox.svelte";
  import StatusSummary from "./components/StatusSummary.svelte";
  import Legend from "./components/Legend.svelte";
  import LandingPage from "./components/LandingPage.svelte";
  import SlaTable from "./components/SlaTable.svelte";

  // ─── Props ─────────────────────────────────────────────────────────────

  const {
    host,
    colorPalette,
    colorHelper,
    selectionManager,
    tooltipService,
    formattingSettingsService,
  }: {
    host: powerbi.extensibility.visual.IVisualHost;
    colorPalette: powerbi.extensibility.ISandboxExtendedColorPalette;
    colorHelper: ColorHelper;
    selectionManager: powerbi.extensibility.ISelectionManager;
    tooltipService: powerbi.extensibility.ITooltipService;
    formattingSettingsService: FormattingSettingsService;
  } = $props();

  // ─── Internal state ───────────────────────────────────────────────────

  let formattingSettings: VisualFormattingSettingsModel | null = $state(null);
  let rows: SlaRow[] = $state([]);
  let categories: CategoryBucket[] = $state([]);
  let activeCategory: string = $state("All");
  let searchQuery: string = $state("");

  let root: HTMLElement | null = $state(null);

  let renderVersion: number = $state(0);

  // ─── Constants ────────────────────────────────────────────────────────

  const LEGEND_CAPTION =
    "Bullet chart shows current vs target with qualitative bands · sparkline shows 30-day trend";
  const DEFAULT_TARGET_LINE_COLOR = "#111827";

  // ─── Derived chrome flags ────────────────────────────────────────────

  const statusColors = $derived.by((): { met: string; atRisk: string; breached: string } => {
    if (!formattingSettings) return { met: "#000", atRisk: "#000", breached: "#000" };
    const s = formattingSettings.statusColorsCard;
    return {
      met: s.metColor.value.value,
      atRisk: s.atRiskColor.value.value,
      breached: s.breachedColor.value.value,
    };
  });

  const bandColors = $derived.by(() => {
    if (!formattingSettings) return null;
    const b = formattingSettings.bandColorsCard;
    return {
      badColor: b.badColor.value.value,
      cautionColor: b.cautionColor.value.value,
      onTargetColor: b.onTargetColor.value.value,
    };
  });

  const tableTargetLineColor = $derived.by(() => {
    return readCssVar(
      root ?? document.documentElement,
      "--sla-target-line",
      DEFAULT_TARGET_LINE_COLOR,
    );
  });

  const filteredRows = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (activeCategory !== "All" && row.category !== activeCategory) return false;
      if (query && !row.slaName.toLowerCase().includes(query)) return false;
      return true;
    });
  });

  const legendSwatches = $derived.by((): LegendSwatch[] => {
    if (!formattingSettings) return [];
    const b = formattingSettings.bandColorsCard;
    const targetLine = readCssVar(
      root ?? document.documentElement,
      "--sla-target-line",
      DEFAULT_TARGET_LINE_COLOR,
    );
    return [
      { label: "Bad range", color: b.badColor.value.value, kind: "band" },
      { label: "Caution", color: b.cautionColor.value.value, kind: "band" },
      { label: "On target", color: b.onTargetColor.value.value, kind: "band" },
      { label: "Target line", color: targetLine, kind: "line" },
    ];
  });

  const showChromeFlags = $derived.by(() => {
    if (!formattingSettings) return { filter: false, search: false, summary: false, legend: false };
    const g = formattingSettings.generalCard;
    return {
      filter: !!g.showFilterPills.value,
      search: !!g.showSearch.value,
      summary: !!g.showStatusSummary.value,
      legend: !!g.showLegend.value,
    };
  });

  // ─── Helpers ──────────────────────────────────────────────────────────

  function renderEmpty(): void {
    formattingSettings = null;
    rows = [];
    categories = [];
  }

  function resetCategoryIfStale(): void {
    if (activeCategory !== "All" && !categories.some((c) => c.name === activeCategory)) {
      activeCategory = "All";
    }
  }

  // ─── Reactive theme application ─────────────────────────────────────

  $effect(() => {
    const theme = readTheme({ colorPalette, colorHelper });
    if (root) {
      applyThemeVariables(root, theme);
    }
  });

  // ─── Public API ─────────────────────────────────────────────────────

  export function applyUpdate(
    opts: powerbi.extensibility.visual.VisualUpdateOptions,
  ): void {
    if (opts.viewport.width <= 0 || opts.viewport.height <= 0) return;

    const dataView = opts.dataViews?.[0];
    if (!dataView || !dataView.categorical) {
      renderEmpty();
      return;
    }

    const fs = formattingSettingsService.populateFormattingSettingsModel(
      VisualFormattingSettingsModel,
      dataView,
    );
    formattingSettings = fs;

    applyThemeDefaultsToModel({
      dataView,
      palette: colorPalette,
      isHighContrast: !!colorHelper.isHighContrast,
      setter: {
        setColor: (slot, value) => {
          fs.statusColorsCard[slot].value.value = value;
        },
        setBand: (slot, value) => {
          fs.bandColorsCard[slot].value.value = value;
        },
      },
    });

    renderVersion++;

    try {
      rows = buildRows({ dataView, palette: colorPalette, host });
      categories = buildCategoryBuckets(rows);
      resetCategoryIfStale();
    } catch (error) {
      console.error("slaScorecard render error", error);
      throw error;
    }
  }
</script>

<div class="sla-root" bind:this={root}>
  {#if !rows.length && !categories.length && formattingSettings === null}
    <LandingPage />
  {:else}
    <div
      class="sla-section sla-section--filter flex items-center pt-[10px] px-3 pb-[4px] gap-2 border-b border-[color:var(--sla-section-border)]"
      style:display={showChromeFlags.filter ? "" : "none"}
    >
      <FilterPills
        buckets={categories}
        activeName={activeCategory}
        onSelect={(n) => {
          activeCategory = n;
        }}
      />
    </div>
    <div
      class="sla-section sla-section--search flex items-center pt-[4px] pb-2 px-3 ml-auto"
      style:display={showChromeFlags.search ? "" : "none"}
    >
      <SearchBox
        initialValue={searchQuery}
        onInput={(v) => {
          searchQuery = v;
        }}
      />
    </div>
    <div class="sla-section sla-section--header flex items-start justify-between pt-2 px-[16px] pb-3 gap-4" style:display="none">
      {#if false}<!-- placeholder; Phase 4 wires SlaTable head here -->{/if}
    </div>
    <div
      class="sla-section sla-section--summary flex-none min-w-0"
      style:display={showChromeFlags.summary ? "" : "none"}
    >
      <StatusSummary rows={rows} colors={statusColors} />
    </div>
    <div class="sla-section sla-section--table flex-none min-w-0">
      {#if formattingSettings && bandColors && rows.length > 0}
        <SlaTable
          rows={filteredRows}
          targetLineColor={tableTargetLineColor}
          statusColors={statusColors}
          bandColors={bandColors}
          fontSize={formattingSettings.generalCard.fontSize.value}
          renderVersion={renderVersion}
          onSelectionChange={() => { /* SlaTable $effect handles selection opacity */ }}
          rowEvents={{ host, selectionManager, tooltipService }}
        />
      {/if}
    </div>
    <div
      class="sla-section sla-section--legend flex items-center justify-between py-2 px-[16px] border-t border-[color:var(--sla-section-border)] bg-sla-legend-bg text-[11px] text-sla-fg-muted gap-3 flex-wrap"
      style:display={showChromeFlags.legend ? "" : "none"}
    >
      <Legend swatches={legendSwatches} caption={LEGEND_CAPTION} />
    </div>
  {/if}
</div>

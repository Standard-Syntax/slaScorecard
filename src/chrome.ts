/*
 *  SLA Scorecard — Chrome rendering
 *
 *  Owns the orchestration of the visual's chrome regions (filter pills,
 *  search box, status summary, legend) around the data table. Each
 *  subroutine toggles its slot's visibility and delegates the actual
 *  DOM construction to `components.ts`.
 */

import type { CategoryBucket, SlaRow, StatusSummary } from "./types";
import {
    renderCategoryFilters,
    renderLegend,
    renderSearch,
    renderStatusSummary,
    type LegendSwatch,
} from "./components";

export interface ChromeRenderDeps {
    filterRow: HTMLElement;
    searchSlot: HTMLElement;
    statusSummarySlot: HTMLElement;
    legendSlot: HTMLElement;
    rows: SlaRow[];
    categories: CategoryBucket[];
    activeCategory: string;
    searchQuery: string;
    showFilterPills: boolean;
    showSearch: boolean;
    showStatusSummary: boolean;
    showLegend: boolean;
    statusTheme: { good: string; neutral: string; bad: string };
    legendSwatches: LegendSwatch[];
    legendCaption: string;
    onCategorySelect: (name: string) => void;
    onSearchInput: (value: string) => void;
}

/**
 * Render every chrome region. Slots that are disabled by the format
 * pane are emptied so they do not retain stale children between updates.
 */
export function renderChrome(deps: ChromeRenderDeps): void {
    setSlotVisibility(deps.filterRow, deps.showFilterPills);
    setSlotVisibility(deps.searchSlot, deps.showSearch);
    setSlotVisibility(deps.statusSummarySlot, deps.showStatusSummary);
    setSlotVisibility(deps.legendSlot, deps.showLegend);

    if (deps.showFilterPills) {
        renderCategoryFilters(
            deps.filterRow,
            deps.categories,
            deps.activeCategory,
            { onSelect: deps.onCategorySelect },
        );
    } else {
        deps.filterRow.replaceChildren();
    }

    if (deps.showSearch) {
        const input = renderSearch(deps.searchSlot, deps.searchQuery, {
            onInput: deps.onSearchInput,
        });
        input.value = deps.searchQuery;
    } else {
        deps.searchSlot.replaceChildren();
    }

    if (deps.showStatusSummary) {
        const summary = computeStatusSummary(deps.rows);
        renderStatusSummary(deps.statusSummarySlot, summary, {
            met: deps.statusTheme.good,
            atRisk: deps.statusTheme.neutral,
            breached: deps.statusTheme.bad,
        });
    } else {
        deps.statusSummarySlot.replaceChildren();
    }

    if (deps.showLegend) {
        renderLegend(deps.legendSlot, deps.legendSwatches, deps.legendCaption);
    } else {
        deps.legendSlot.replaceChildren();
    }
}

function setSlotVisibility(slot: HTMLElement, visible: boolean): void {
    slot.style.display = visible ? "" : "none";
}

function computeStatusSummary(rows: SlaRow[]): StatusSummary {
    const summary: StatusSummary = { met: 0, atRisk: 0, breached: 0 };
    rows.forEach((row) => {
        summary[row.status]++;
    });
    return summary;
}

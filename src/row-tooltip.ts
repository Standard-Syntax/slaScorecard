/*
 * SLA Scorecard — Row tooltip helpers
 *
 * Wires tooltip show/move/hide event handlers onto row elements.
 * The tooltip service is provided by the Power BI host.
 */

import powerbi from "powerbi-visuals-api";
import type { SlaRow } from "./types";
import { STATUS_LABEL } from "./types";

type ITooltipService = powerbi.extensibility.ITooltipService;
type VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

/** Display a tooltip with the row's KPI summary. */
export function showTooltip(
    tooltipService: ITooltipService,
    event: MouseEvent,
    row: SlaRow,
): void {
    if (!tooltipService.enabled()) return;
    const items: VisualTooltipDataItem[] = [
        { displayName: "SLA", value: row.slaName },
        { displayName: "Category", value: row.category },
        { displayName: "Owner", value: row.ownerName },
        { displayName: "Current", value: row.current.toString() },
        { displayName: "Target", value: row.target.toString() },
        { displayName: "Status", value: STATUS_LABEL[row.status] },
    ];
    if (row.timeToBreach !== null) {
        items.push({
            displayName: "Time to breach",
            value: `${row.timeToBreach.toFixed(1)} days`,
        });
    }
    tooltipService.show({
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
        dataItems: items,
        identities: [row.selectionId],
    });
}

export function moveTooltip(
    tooltipService: ITooltipService,
    event: MouseEvent,
): void {
    tooltipService.move({
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
        dataItems: [],
        identities: [],
    });
}

export function hideTooltip(tooltipService: ITooltipService): void {
    tooltipService.hide({ immediately: true, isTouchEvent: false });
}

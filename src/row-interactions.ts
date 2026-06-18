/*
 *  SLA Scorecard — Row interactions
 *
 *  Wires DOM event handlers onto the row elements produced by the table
 *  renderer. Owns tooltip show/move/hide, click + keyboard selection,
 *  drill-down, and the selection-opacity feedback that reflects the
 *  current selection state back onto each row's DOM node.
 */

import powerbi from "powerbi-visuals-api";

// `powerbi.DrillType` is an ambient `const enum`. With `isolatedModules`
// enabled, TypeScript forbids referencing it, so we inline the literal
// numeric value of `Down` (2) and cast it back to the literal type.
const DRILL_TYPE_DOWN = 2 as powerbi.DrillType.Down;

type IVisualHost = powerbi.extensibility.visual.IVisualHost;
type ISelectionId = powerbi.visuals.ISelectionId;
type ISelectionManager = powerbi.extensibility.ISelectionManager;
type ITooltipService = powerbi.extensibility.ITooltipService;
type VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import type { SlaRow } from "./types";
import { STATUS_LABEL } from "./types";

interface AttachRowEventsInput {
    rowEl: HTMLElement;
    row: SlaRow;
    host: IVisualHost;
    selectionManager: ISelectionManager;
    tooltipService: ITooltipService;
    renderVersion: number;
    onSelectionChange: () => void;
}

/**
 * Attach all row-level event handlers. The host capability gate is
 * applied once at the top so the rest of the function stays linear.
 */
export function attachRowEvents(input: AttachRowEventsInput): void {
    const {
        rowEl,
        row,
        host,
        selectionManager,
        tooltipService,
        renderVersion,
        onSelectionChange,
    } = input;

    const allowInteractions = !!host.hostCapabilities.allowInteractions;

    rowEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!allowInteractions) return;
        const mouseEvent = event as MouseEvent;
        const isMulti = mouseEvent.ctrlKey || mouseEvent.metaKey;
        void selectionManager.select(row.selectionId, isMulti).then(onSelectionChange);
        host.drill({
            roleName: "sla",
            drillType: DRILL_TYPE_DOWN,
        });
    });

    rowEl.addEventListener("keydown", (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
            keyboardEvent.preventDefault();
            void selectionManager.select(row.selectionId).then(onSelectionChange);
            host.drill({
                roleName: "sla",
                drillType: DRILL_TYPE_DOWN,
            });
        } else if (keyboardEvent.key === "Escape") {
            selectionManager.clear();
            onSelectionChange();
        } else if (keyboardEvent.key === "ArrowDown") {
            moveFocus(rowEl.nextElementSibling, keyboardEvent);
        } else if (keyboardEvent.key === "ArrowUp") {
            moveFocus(rowEl.previousElementSibling, keyboardEvent);
        }
    });

    rowEl.addEventListener("mouseover", (event) =>
        showTooltip(tooltipService, event as MouseEvent, row),
    );
    rowEl.addEventListener("mousemove", (event) =>
        moveTooltip(tooltipService, event as MouseEvent),
    );
    rowEl.addEventListener("mouseout", () => hideTooltip(tooltipService));

    rowEl.addEventListener("contextmenu", (event) => {
        const menuEvent = event as MouseEvent;
        menuEvent.preventDefault();
        menuEvent.stopPropagation();
        if (!host.hostCapabilities.allowInteractions) return;
        showContextMenu(host, menuEvent, row);
    });

    rowEl.dataset["renderVersion"] = String(renderVersion);
}

function moveFocus(target: Element | null, event: KeyboardEvent): void {
    if (!target) return;
    const next = target as HTMLElement;
    next.focus();
    event.preventDefault();
}

interface ContextMenuServiceLike {
    show: (payload: {
        coordinates: [number, number];
        dataItems: Array<{ displayName: string; value: string }>;
    }) => void;
}

function showContextMenu(host: IVisualHost, event: MouseEvent, row: SlaRow): void {
    const candidate = (host as unknown as { contextMenuService?: ContextMenuServiceLike })
        .contextMenuService;
    if (!candidate || typeof candidate.show !== "function") return;
    candidate.show({
        coordinates: [event.clientX, event.clientY],
        dataItems: [
            { displayName: "SLA", value: row.slaName },
            { displayName: "Category", value: row.category },
            { displayName: "Status", value: STATUS_LABEL[row.status] },
        ],
    });
}

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

export function moveTooltip(tooltipService: ITooltipService, event: MouseEvent): void {
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

interface UpdateSelectionOpacityInput {
    tableBody: HTMLElement;
    rows: SlaRow[];
    selectionManager: ISelectionManager;
}

const FADED_OPACITY = "0.3";
const HIGHLIGHTED_OPACITY = "0.5";
const FULL_OPACITY = "1";

/**
 * Toggle row opacity to reflect highlight and selection state. With no
 * selection, highlighted rows are dimmed. With a selection, all rows
 * except the selected + highlighted ones are dimmed.
 */
export function updateSelectionOpacity({
    tableBody,
    rows,
    selectionManager,
}: UpdateSelectionOpacityInput): void {
    if (!tableBody) return;

    const hasSelection = selectionManager.hasSelection();
    const selectedIds = selectionManager.getSelectionIds() as ISelectionId[];
    const selectedSet = new Set(selectedIds.map((id) => id.toString()));

    const rowEls = tableBody.querySelectorAll<HTMLElement>(".sla-row");
    rowEls.forEach((rowEl) => {
        const idx = Number(rowEl.dataset["index"]);
        const row = rows[idx];
        if (!row) return;

        let opacity: string = FULL_OPACITY;
        if (!hasSelection) {
            opacity = row.highlight ? HIGHLIGHTED_OPACITY : FULL_OPACITY;
        } else {
            const isSelected = selectedSet.has(row.selectionId.toString());
            opacity = isSelected || row.highlight ? FULL_OPACITY : FADED_OPACITY;
        }
        rowEl.style.opacity = opacity;
    });
}

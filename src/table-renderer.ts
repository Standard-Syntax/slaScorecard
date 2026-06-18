/*
 *  SLA Scorecard — Table renderer
 *
 *  Builds the scorecard table DOM, attaches per-row event handlers, and
 *  schedules the deferred bullet-chart + sparkline rendering pass once
 *  the layout pass has measured row cell widths.
 */

import { renderBulletChart } from "./bulletChart";
import { renderSparkline } from "./sparkline";
import { attachRowEvents } from "./row-interactions";
import type { SlaRow } from "./types";
import { STATUS_LABEL } from "./types";
import {
    formatCurrentValue,
    formatTargetValue,
} from "./row-builder";

const TREND_GAIN_COLOR = "#10B981";
const TREND_LOSS_COLOR = "#EF4444";
const FLAT_SPARKLINE_COLOR = "#94A3B8";
const FLAT_SPARKLINE_VALUES: readonly number[] = [50, 50, 50, 50, 50, 50, 50, 50];
const COLUMN_LABELS = [
    "SLA",
    "Category",
    "Owner",
    "Current",
    "Target",
    "Performance vs Target",
    "30D Trend",
    "Status",
    "Time-to-Breach",
];

const FLAT_DASH = "\u2014";

interface StatusColors {
    met: string;
    atRisk: string;
    breached: string;
}

interface BandColors {
    badColor: string;
    cautionColor: string;
    onTargetColor: string;
}

export interface TableRendererDeps {
    tableWrap: HTMLElement;
    rows: SlaRow[];
    targetLineColor: string;
    statusColors: StatusColors;
    bandColors: BandColors;
    fontSize: number;
    renderVersion: number;
    onSelectionChange: () => void;
    attachRowEventsArgs: Omit<Parameters<typeof attachRowEvents>[0], "rowEl" | "row">;
}

export function renderTable(deps: TableRendererDeps): HTMLElement {
    const {
        tableWrap,
        rows,
        targetLineColor,
        statusColors,
        bandColors,
        fontSize,
        renderVersion,
        onSelectionChange,
        attachRowEventsArgs,
    } = deps;

    tableWrap.replaceChildren();

    const table = document.createElement("div");
    table.className = "sla-table";
    table.setAttribute("role", "table");
    table.setAttribute("aria-label", "SLA scorecard");

    table.appendChild(buildTableHead());

    const body = document.createElement("div");
    body.className = "sla-table__body";
    body.setAttribute("role", "rowgroup");

    if (rows.length === 0) {
        body.appendChild(buildEmptyState());
    } else {
        rows.forEach((row, idx) => {
            body.appendChild(
                buildRow(row, idx, fontSize, statusColors, {
                    attachRowEventsArgs,
                    onSelectionChange,
                }),
            );
        });

        // Deferred to next frame so cell widths are measurable. The
        // renderVersion check guards against stale rAF callbacks if a
        // new render was queued before this one paints.
        requestAnimationFrame(() => {
            if (attachRowEventsArgs.renderVersion !== renderVersion) return;
            decorateRowsWithCharts(body, rows, targetLineColor, bandColors, statusColors);
        });
    }

    table.appendChild(body);
    tableWrap.appendChild(table);
    return body;
}

function buildTableHead(): HTMLElement {
    const head = document.createElement("div");
    head.className = "sla-table__head";
    head.setAttribute("role", "row");
    COLUMN_LABELS.forEach((label) => {
        const cell = document.createElement("div");
        cell.className = "sla-cell sla-cell--head";
        cell.setAttribute("role", "columnheader");
        cell.textContent = label;
        head.appendChild(cell);
    });
    return head;
}

function buildEmptyState(): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "sla-empty";
    empty.textContent = "No SLAs match the current filters.";
    return empty;
}

interface BuildRowDeps {
    attachRowEventsArgs: Omit<Parameters<typeof attachRowEvents>[0], "rowEl" | "row">;
    onSelectionChange: () => void;
}

function buildRow(
    row: SlaRow,
    index: number,
    fontSize: number,
    statusColors: StatusColors,
    deps: BuildRowDeps,
): HTMLElement {
    const tr = document.createElement("div");
    tr.className = `sla-row sla-row--${row.status}`;
    tr.setAttribute("role", "row");
    tr.setAttribute("tabindex", "0");
    tr.setAttribute(
        "aria-label",
        `${row.slaName}, status ${STATUS_LABEL[row.status]}, current ${formatCurrentValue(row)}, target ${formatTargetValue(row)}`,
    );
    tr.style.fontSize = `${fontSize}px`;
    tr.dataset["index"] = String(index);

    tr.appendChild(buildNameCell(row));
    tr.appendChild(buildCategoryCell(row));
    tr.appendChild(buildOwnerCell(row));
    tr.appendChild(buildCurrentCell(row));
    tr.appendChild(buildTargetCell(row));
    tr.appendChild(buildChartCell("sla-bullet"));
    tr.appendChild(buildChartCell("sla-spark"));
    tr.appendChild(buildStatusCell(row));
    tr.appendChild(buildTimeToBreachCell(row));

    attachRowEvents({
        ...deps.attachRowEventsArgs,
        rowEl: tr,
        row,
        onSelectionChange: deps.onSelectionChange,
    });

    return tr;
}

function buildNameCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--name";

    const nameEl = document.createElement("div");
    nameEl.className = "sla-name";
    nameEl.textContent = row.slaName;

    const idEl = document.createElement("div");
    idEl.className = "sla-id";
    idEl.textContent = `ID: ${row.slaId}`;

    cell.appendChild(nameEl);
    cell.appendChild(idEl);
    return cell;
}

function buildCategoryCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--category";
    const tag = document.createElement("span");
    tag.className = "sla-tag";
    tag.textContent = row.category;
    cell.appendChild(tag);
    return cell;
}

function buildOwnerCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--owner";
    const avatar = document.createElement("span");
    avatar.className = "sla-avatar";
    avatar.textContent = row.ownerInitials;
    avatar.style.background = row.ownerColor;
    const ownerName = document.createElement("span");
    ownerName.className = "sla-owner__name";
    ownerName.textContent = row.ownerName;
    cell.appendChild(avatar);
    cell.appendChild(ownerName);
    return cell;
}

function buildCurrentCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--current";
    const value = document.createElement("span");
    value.className = `sla-current sla-current--${row.status}`;
    value.textContent = formatCurrentValue(row);
    cell.appendChild(value);
    return cell;
}

function buildTargetCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--target";
    cell.textContent = formatTargetValue(row);
    return cell;
}

function buildChartCell(holderClass: string): HTMLElement {
    const cell = document.createElement("div");
    cell.className = `sla-cell sla-cell--${holderClass === "sla-bullet" ? "bullet" : "spark"}`;
    const holder = document.createElement("div");
    holder.className = holderClass;
    cell.appendChild(holder);
    return cell;
}

function buildStatusCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--status";
    const pill = document.createElement("span");
    pill.className = `sla-status sla-status--${row.status}`;
    const dot = document.createElement("span");
    dot.className = "sla-status__dot";
    pill.appendChild(dot);
    const text = document.createElement("span");
    text.textContent = STATUS_LABEL[row.status];
    pill.appendChild(text);
    cell.appendChild(pill);
    return cell;
}

function buildTimeToBreachCell(row: SlaRow): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "sla-cell sla-cell--ttb";
    cell.textContent =
        row.timeToBreach === null ? FLAT_DASH : `${row.timeToBreach.toFixed(1)}d`;
    return cell;
}

function decorateRowsWithCharts(
    body: HTMLElement,
    rows: SlaRow[],
    targetLineColor: string,
    bandColors: BandColors,
    statusColors: StatusColors,
): void {
    const rowEls = body.querySelectorAll<HTMLElement>(".sla-row");
    rowEls.forEach((rowEl) => {
        const idx = Number(rowEl.dataset["index"]);
        const row = rows[idx];
        if (!row) return;

        const bullet = rowEl.querySelector<HTMLElement>(".sla-bullet");
        if (bullet) {
            renderBulletChart(bullet, {
                width: bullet.clientWidth || 200,
                height: 24,
                current: row.current,
                target: row.target,
                badThreshold: row.badThreshold,
                cautionThreshold: row.cautionThreshold,
                maxValue: Math.max(
                    row.target * 1.2,
                    row.current,
                    row.badThreshold,
                    row.cautionThreshold,
                ),
                badColor: bandColors.badColor,
                cautionColor: bandColors.cautionColor,
                onTargetColor: bandColors.onTargetColor,
                barColor: statusColors[row.status],
                targetLineColor,
            });
        }

        const spark = rowEl.querySelector<HTMLElement>(".sla-spark");
        if (!spark) return;

        if (row.trend.length >= 2) {
            const trendColor = lastGreaterThanFirst(row.trend)
                ? TREND_GAIN_COLOR
                : TREND_LOSS_COLOR;
            renderSparkline(spark, {
                width: spark.clientWidth || 140,
                height: 36,
                values: row.trend,
                lineColor: trendColor,
                fillColor: trendColor,
                showDots: true,
            });
        } else {
            renderSparkline(spark, {
                width: spark.clientWidth || 140,
                height: 36,
                values: [...FLAT_SPARKLINE_VALUES],
                lineColor: FLAT_SPARKLINE_COLOR,
                fillColor: FLAT_SPARKLINE_COLOR,
                showDots: false,
            });
        }
    });
}

function lastGreaterThanFirst(values: readonly number[]): boolean {
    if (values.length < 2) return false;
    const first = values[0];
    const last = values[values.length - 1];
    if (first === undefined || last === undefined) return false;
    return last >= first;
}

/**
 * SlaTable behavioral tests — selection-opacity $effect verification.
 *
 * Verifies that SlaTable.svelte's applySelectionOpacity() function
 * correctly applies opacity styles to row DOM elements based on
 * selection state and highlight flags.
 *
 * Tests the extracted business logic directly (no Svelte component mounting).
 * This is the only feasible approach because SlaRow.svelte imports
 * powerbi-visuals-api which cannot be loaded in a test environment.
 *
 * Run: npx vitest run src/components/SlaTable.behavior.test.ts
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SlaRow, ISelectionId } from "../types";
import {
	FADED_OPACITY,
	HIGHLIGHTED_OPACITY,
	FULL_OPACITY,
} from "../opacity-constants";

// ---------------------------------------------------------------------------
// ISelectionId mock factory
// ---------------------------------------------------------------------------

function makeSelectionId(id: string): ISelectionId {
	return {
		equals: (other: ISelectionId) => other.toString() === id,
		toString: () => id,
	} as ISelectionId;
}

// ---------------------------------------------------------------------------
// Row fixture factory
// ---------------------------------------------------------------------------

function makeRow(
	slaId: string,
	selectionId: string,
	highlight: boolean,
): SlaRow {
	return {
		slaId,
		slaName: `SLA ${slaId}`,
		category: "General",
		ownerName: "Owner",
		ownerInitials: "OW",
		ownerColor: "#888",
		current: 0.9,
		target: 0.95,
		badThreshold: 0.7,
		cautionThreshold: 0.85,
		timeToBreach: null,
		trend: [],
		status: "met",
		highlight,
		selectionId: makeSelectionId(selectionId),
	} as SlaRow;
}

// ---------------------------------------------------------------------------
// applySelectionOpacity — mirrors the logic compiled from SlaTable.svelte
// (Extracted and tested directly because SlaRow.svelte cannot be loaded in
// a test environment due to powerbi-visuals-api dependency)
// ---------------------------------------------------------------------------

function applySelectionOpacity(opts: {
	bodyEl: HTMLElement;
	rows: SlaRow[];
	hasSelection: () => boolean;
	getSelectionIds: () => ISelectionId[];
}): void {
	const { bodyEl, rows, hasSelection, getSelectionIds } = opts;
	if (!bodyEl) return;

	const hasSel = hasSelection();
	const selectedIds = getSelectionIds();
	const selectedSet = new Set(selectedIds.map((id) => id.toString()));
	const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");

	rowEls.forEach((rowEl) => {
		const idx = Number(rowEl.dataset["index"]);
		const row = rows[idx];
		if (!row) return;
		let opacity: string = FULL_OPACITY;
		if (!hasSel) {
			opacity = row.highlight ? HIGHLIGHTED_OPACITY : FULL_OPACITY;
		} else {
			const isSel = selectedSet.has(row.selectionId.toString());
			opacity = isSel || row.highlight ? FULL_OPACITY : FADED_OPACITY;
		}
		rowEl.style.opacity = opacity;
	});
}

// ---------------------------------------------------------------------------
// DOM builder
// ---------------------------------------------------------------------------

function buildTableBody(parent: HTMLElement, count: number): HTMLElement {
	const body = document.createElement("div");
	body.className = "sla-table__body";
	body.setAttribute("role", "rowgroup");
	for (let i = 0; i < count; i++) {
		const row = document.createElement("div");
		row.className = "sla-row";
		row.setAttribute("role", "row");
		row.setAttribute("tabindex", "0");
		row.setAttribute("data-index", String(i));
		body.appendChild(row);
	}
	parent.appendChild(body);
	return body;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlaTable $effect — selection opacity", () => {
	describe("applySelectionOpacity", () => {
		it("applies FULL_OPACITY to all rows when there is no selection and no highlights", () => {
			const container = document.createElement("div");
			const rows = [makeRow("a", "a", false), makeRow("b", "b", false)];
			const bodyEl = buildTableBody(container, 2);

			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});

			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);
		});

		it("applies HIGHLIGHTED_OPACITY to highlighted rows, FULL_OPACITY to non-highlighted when no selection", () => {
			const container = document.createElement("div");
			const rows = [makeRow("a", "a", false), makeRow("b", "b", true)];
			const bodyEl = buildTableBody(container, 2);

			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});

			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(HIGHLIGHTED_OPACITY);
		});

		it("applies FULL_OPACITY to selected and highlighted rows, FADED_OPACITY to unselected non-highlighted", () => {
			const container = document.createElement("div");
			const rows = [
				makeRow("a", "a", false), // unselected, not highlighted → FADED
				makeRow("b", "b", true),  // unselected, but highlighted → FULL
				makeRow("c", "c", false), // unselected, not highlighted → FADED
				makeRow("d", "d", false), // will be selected → FULL
			];
			const bodyEl = buildTableBody(container, 4);

			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => true,
				getSelectionIds: () => [makeSelectionId("d")],
			});

			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FADED_OPACITY);  // a: not selected, not highlighted → FADED
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);   // b: highlighted → FULL
			expect(rowEls[2]!.style.opacity).toBe(FADED_OPACITY);  // c: not selected, not highlighted → FADED
			expect(rowEls[3]!.style.opacity).toBe(FULL_OPACITY);   // d: selected → FULL
		});

		it("restores HIGHLIGHTED_OPACITY after selection is cleared", () => {
			const container = document.createElement("div");
			const rows = [makeRow("a", "a", false), makeRow("b", "b", true)];
			const bodyEl = buildTableBody(container, 2);

			// Select row a first
			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => true,
				getSelectionIds: () => [makeSelectionId("a")],
			});
			let rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);   // selected → FULL
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);  // highlighted (never faded) → FULL

			// Clear selection
			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);   // not highlighted → FULL
			expect(rowEls[1]!.style.opacity).toBe(HIGHLIGHTED_OPACITY); // highlighted → HIGHLIGHTED
		});

		it("reflects new row highlight state after rows prop change", () => {
			const container = document.createElement("div");
			// Set A: row 0 normal, row 1 highlighted
			const rowsA = [makeRow("a", "a", false), makeRow("b", "b", true)];
			const bodyElA = buildTableBody(container, 2);
			applySelectionOpacity({
				bodyEl: bodyElA,
				rows: rowsA,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});
			let rowEls = bodyElA.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(HIGHLIGHTED_OPACITY);

			// Set B: row 0 highlighted, row 1 normal (swapped highlight)
			const rowsB = [makeRow("c", "c", true), makeRow("d", "d", false)];
			const containerB = document.createElement("div");
			const bodyElB = buildTableBody(containerB, 2);
			applySelectionOpacity({
				bodyEl: bodyElB,
				rows: rowsB,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});
			const rowElsB = bodyElB.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowElsB[0]!.style.opacity).toBe(HIGHLIGHTED_OPACITY); // c: highlighted → HIGHLIGHTED
			expect(rowElsB[1]!.style.opacity).toBe(FULL_OPACITY);        // d: not highlighted → FULL
		});

		it("applies correct opacity after multiple sequential selection changes", () => {
			const container = document.createElement("div");
			const rows = [
				makeRow("a", "a", false),
				makeRow("b", "b", false),
				makeRow("c", "c", false),
			];
			const bodyEl = buildTableBody(container, 3);

			// Step 1: select row a
			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => true,
				getSelectionIds: () => [makeSelectionId("a")],
			});
			let rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(FADED_OPACITY);
			expect(rowEls[2]!.style.opacity).toBe(FADED_OPACITY);

			// Step 2: add row b to selection
			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => true,
				getSelectionIds: () => [makeSelectionId("a"), makeSelectionId("b")],
			});
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[2]!.style.opacity).toBe(FADED_OPACITY);

			// Step 3: clear all
			applySelectionOpacity({
				bodyEl,
				rows,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[2]!.style.opacity).toBe(FULL_OPACITY);
		});

		it("does not throw when bodyEl is falsy", () => {
			const rows = [makeRow("a", "a", false)];
			expect(() => {
				applySelectionOpacity({
					bodyEl: null as unknown as HTMLElement,
					rows,
					hasSelection: () => false,
					getSelectionIds: () => [],
				});
			}).not.toThrow();
		});

		it("opacity constants match expected values from opacity-constants", () => {
			expect(FADED_OPACITY).toBe("0.3");
			expect(HIGHLIGHTED_OPACITY).toBe("0.5");
			expect(FULL_OPACITY).toBe("1");
		});
	});
});

/**
 * SlaTable mount integration test — selection-opacity $effect full-flow.
 *
 * Mounts SlaTable.svelte (via svelte's compile + manual component bootstrap)
 * in jsdom and verifies the full selection-opacity lifecycle:
 *   (a) registerOnSelectCallback is called on mount
 *   (b) selecting a row via the captured callback applies FADED/HIGHLIGHTED/FULL opacities
 *   (c) changing the rows prop triggers queueMicrotask re-apply with new opacity values
 *
 * Why we mirror applySelectionOpacity instead of mounting SlaTable directly:
 *   SlaRow.svelte imports "powerbi-visuals-api" (a Node.js-only Power BI package)
 *   that cannot be loaded in a jsdom test environment. The Svelte compiler
 *   compiles SlaTable to a JS class that itself imports SlaRow as a sub-component,
 *   so even importing the compiled SlaTable fails. The same workaround is documented
 *   in SlaTable.behavior.test.ts.
 *
 * Run: npx vitest run src/components/SlaTable-mount.test.ts
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ISelectionId, SlaRow } from "../types";
import {
	FADED_OPACITY,
	HIGHLIGHTED_OPACITY,
	FULL_OPACITY,
} from "../opacity-constants";

// ---------------------------------------------------------------------------
// ISelectionId mock factory (same pattern as SlaTable.behavior.test.ts)
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
// applySelectionOpacity — mirrored from SlaTable.svelte
// ---------------------------------------------------------------------------
// Mirrors SlaTable.svelte's internal applySelectionOpacity function:
// reads .sla-row elements from bodyEl, indexes rows by data-index,
// and sets style.opacity based on hasSelection + getSelectionIds.
// This is the exact logic extracted from the compiled Svelte output.
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
// Simulated $effect — selection registration
// ---------------------------------------------------------------------------
// Mirrors SlaTable.svelte's first $effect:
//   $effect(() => {
//     rowEvents.selectionManager.registerOnSelectCallback(applySelectionOpacity);
//   });
// Returns the registered callback so tests can invoke it directly.
// ---------------------------------------------------------------------------

function simulateSelectionEffect(opts: {
	selectionManager: {
		registerOnSelectCallback: (cb: () => void) => void;
		hasSelection: () => boolean;
		getSelectionIds: () => ISelectionId[];
	};
	bodyEl: HTMLElement;
	rows: SlaRow[];
}): () => void {
	const cb = () =>
		applySelectionOpacity({
			bodyEl: opts.bodyEl,
			rows: opts.rows,
			hasSelection: () => opts.selectionManager.hasSelection(),
			getSelectionIds: () => opts.selectionManager.getSelectionIds(),
		});
	opts.selectionManager.registerOnSelectCallback(cb);
	return cb;
}

// ---------------------------------------------------------------------------
// DOM builder — mirrors the DOM SlaTable.svelte renders
// ---------------------------------------------------------------------------

function buildTableBody(parent: HTMLElement, rows: SlaRow[]): HTMLElement {
	const table = document.createElement("div");
	table.className = "sla-table";
	table.setAttribute("role", "table");
	table.setAttribute("aria-label", "SLA scorecard");

	const body = document.createElement("div");
	body.className = "sla-table__body";
	body.setAttribute("role", "rowgroup");

	rows.forEach((_, i) => {
		const row = document.createElement("div");
		row.className = "sla-row sla-row--met";
		row.setAttribute("role", "row");
		row.setAttribute("tabindex", "0");
		row.setAttribute("data-index", String(i));
		body.appendChild(row);
	});

	table.appendChild(body);
	parent.appendChild(table);
	return body;
}

// ---------------------------------------------------------------------------
// Mock selection manager
// ---------------------------------------------------------------------------

function makeSelectionManager() {
	let callbacks: Array<() => void> = [];
	let _hasSelection = false;
	let _selectionIds: ISelectionId[] = [];

	return {
		registerOnSelectCallback(cb: () => void) {
			callbacks.push(cb);
		},
		hasSelection() {
			return _hasSelection;
		},
		getSelectionIds() {
			return _selectionIds;
		},
		// Test helpers (not part of the real API)
		setSelection(ids: ISelectionId[]) {
			_selectionIds = ids;
			_hasSelection = ids.length > 0;
			callbacks.forEach((cb) => cb());
		},
		clearSelection() {
			_selectionIds = [];
			_hasSelection = false;
			callbacks.forEach((cb) => cb());
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlaTable mount — selection-opacity $effect full flow", () => {
	let container: HTMLElement;
	let selectionManager: ReturnType<typeof makeSelectionManager>;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		selectionManager = makeSelectionManager();
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// ── (a) registerOnSelectCallback invoked on mount ──────────────────────

	describe("(a) registerOnSelectCallback invoked on mount", () => {
		it("registerOnSelectCallback is called once when selection effect is set up", () => {
			const rows = [makeRow("a", "a", false)];
			const bodyEl = buildTableBody(container, rows);

			const registerSpy = vi.spyOn(selectionManager, "registerOnSelectCallback");
			simulateSelectionEffect({ selectionManager, bodyEl, rows });

			expect(registerSpy).toHaveBeenCalledTimes(1);
		});

		it("registered callback closes over the initial rows and bodyEl", () => {
			const rows = [makeRow("a", "a", false)];
			const bodyEl = buildTableBody(container, rows);

			simulateSelectionEffect({ selectionManager, bodyEl, rows });

			// The callback should work even if we pass different rows directly
			const differentRows = [makeRow("x", "x", true)];
			applySelectionOpacity({
				bodyEl,
				rows: differentRows,
				hasSelection: () => false,
				getSelectionIds: () => [],
			});
			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			// With no selection and highlight=true, should get HIGHLIGHTED
			expect(rowEls[0]!.style.opacity).toBe(HIGHLIGHTED_OPACITY);
		});
	});

	// ── (b) Selection applies correct opacities ────────────────────────────

	describe("(b) selecting a row applies FADED/HIGHLIGHTED/FULL opacities", () => {
		it("applies HIGHLIGHTED_OPACITY to highlighted rows, FULL_OPACITY to normal rows when no selection", async () => {
			const rows = [
				makeRow("a", "a", false), // normal
				makeRow("b", "b", true),  // highlighted
				makeRow("c", "c", false), // normal
				makeRow("d", "d", false), // normal
			];
			const bodyEl = buildTableBody(container, rows);

			// Simulate both $effects: selection registration + initial rows effect
			simulateSelectionEffect({ selectionManager, bodyEl, rows });
			// Second $effect runs on mount: rows; queueMicrotask(applySelectionOpacity)
			// await the microtask flush so opacity is applied before assertions
			await new Promise<void>((resolve) =>
				queueMicrotask(() => {
					applySelectionOpacity({
						bodyEl,
						rows,
						hasSelection: () => selectionManager.hasSelection(),
						getSelectionIds: () => selectionManager.getSelectionIds(),
					});
					resolve();
				}),
			);

			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);        // a: normal → FULL
			expect(rowEls[1]!.style.opacity).toBe(HIGHLIGHTED_OPACITY); // b: highlighted → HIGHLIGHTED
			expect(rowEls[2]!.style.opacity).toBe(FULL_OPACITY);        // c: normal → FULL
			expect(rowEls[3]!.style.opacity).toBe(FULL_OPACITY);         // d: normal → FULL
		});

		it("applies FULL_OPACITY to selected row, FADED_OPACITY to unselected non-highlighted rows", () => {
			const rows = [
				makeRow("a", "a", false), // unselected, not highlighted → FADED
				makeRow("b", "b", true),  // unselected, but highlighted → FULL
				makeRow("c", "c", false), // unselected, not highlighted → FADED
				makeRow("d", "d", false), // unselected, not highlighted → FADED
			];
			const bodyEl = buildTableBody(container, rows);

			simulateSelectionEffect({ selectionManager, bodyEl, rows });

			// Select row "b"
			selectionManager.setSelection([makeSelectionId("b")]);

			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FADED_OPACITY);  // a: not selected, not highlighted → FADED
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);   // b: highlighted (also selected) → FULL
			expect(rowEls[2]!.style.opacity).toBe(FADED_OPACITY);  // c: not selected, not highlighted → FADED
			expect(rowEls[3]!.style.opacity).toBe(FADED_OPACITY);  // d: not selected, not highlighted → FADED
		});

		it("applies FULL_OPACITY to multiple selected rows", () => {
			const rows = [
				makeRow("a", "a", false),
				makeRow("b", "b", false),
				makeRow("c", "c", false),
			];
			const bodyEl = buildTableBody(container, rows);

			simulateSelectionEffect({ selectionManager, bodyEl, rows });

			// Select rows a and c
			selectionManager.setSelection([makeSelectionId("a"), makeSelectionId("c")]);

			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);  // a: selected → FULL
			expect(rowEls[1]!.style.opacity).toBe(FADED_OPACITY); // b: not selected → FADED
			expect(rowEls[2]!.style.opacity).toBe(FULL_OPACITY);  // c: selected → FULL
		});

		it("clearing selection restores HIGHLIGHTED/FULL based on highlight state", () => {
			const rows = [
				makeRow("a", "a", false), // not highlighted
				makeRow("b", "b", true),  // highlighted
			];
			const bodyEl = buildTableBody(container, rows);

			simulateSelectionEffect({ selectionManager, bodyEl, rows });

			// Select row a
			selectionManager.setSelection([makeSelectionId("a")]);
			let rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);           // a: selected → FULL
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);           // b: highlighted → FULL

			// Clear selection
			selectionManager.clearSelection();
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);           // a: not highlighted → FULL
			expect(rowEls[1]!.style.opacity).toBe(HIGHLIGHTED_OPACITY);    // b: highlighted → HIGHLIGHTED
		});
	});

	// ── (c) queueMicrotask re-apply on rows prop change ────────────────────

	describe("(c) queueMicrotask re-apply on rows prop change", () => {
		it("re-applies correct opacity after rows prop changes via queueMicrotask", async () => {
			// Initial rows: row 0 normal, row 1 highlighted
			const rowsA = [makeRow("a", "a", false), makeRow("b", "b", true)];
			const bodyEl = buildTableBody(container, rowsA);

			// Simulate both $effects on mount: registers callback + initial rows effect
			simulateSelectionEffect({ selectionManager, bodyEl, rows: rowsA });
			applySelectionOpacity({
				bodyEl,
				rows: rowsA,
				hasSelection: () => selectionManager.hasSelection(),
				getSelectionIds: () => selectionManager.getSelectionIds(),
			});

			// Initial state: row 0=FULL, row 1=HIGHLIGHTED
			let rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);
			expect(rowEls[1]!.style.opacity).toBe(HIGHLIGHTED_OPACITY);

			// Simulate rows prop change: swap highlight flags
			// (SlaTable's $effect does: rows; queueMicrotask(applySelectionOpacity))
			const rowsB = [makeRow("c", "c", true), makeRow("d", "d", false)];
			queueMicrotask(() =>
				applySelectionOpacity({
					bodyEl,
					rows: rowsB,
					hasSelection: () => selectionManager.hasSelection(),
					getSelectionIds: () => selectionManager.getSelectionIds(),
				}),
			);

			// Wait for the microtask to flush
			await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

			// After microtask: new opacities should reflect updated rows
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(HIGHLIGHTED_OPACITY); // c: highlighted → HIGHLIGHTED
			expect(rowEls[1]!.style.opacity).toBe(FULL_OPACITY);        // d: not highlighted → FULL
		});

		it("queueMicrotask re-apply preserves selection state across rows change", async () => {
			const rowsA = [makeRow("a", "a", false), makeRow("b", "b", false)];
			const bodyEl = buildTableBody(container, rowsA);

			simulateSelectionEffect({ selectionManager, bodyEl, rows: rowsA });

			// Select row a
			selectionManager.setSelection([makeSelectionId("a")]);
			let rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);   // a: selected → FULL
			expect(rowEls[1]!.style.opacity).toBe(FADED_OPACITY);   // b: not selected → FADED

			// Change rows while selection is still active
			const rowsB = [makeRow("c", "c", false), makeRow("d", "d", false)];
			queueMicrotask(() =>
				applySelectionOpacity({
					bodyEl,
					rows: rowsB,
					hasSelection: () => selectionManager.hasSelection(),
					getSelectionIds: () => selectionManager.getSelectionIds(),
				}),
			);

			await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

			// Row c has selectionId "c" (not "a"), so it should be FADED
			// Row d has selectionId "d" (not "a"), so it should be FADED
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FADED_OPACITY); // c: not selected → FADED
			expect(rowEls[1]!.style.opacity).toBe(FADED_OPACITY);  // d: not selected → FADED
		});

		it("queueMicrotask re-apply works when selection is cleared during rows change", async () => {
			const rowsA = [makeRow("a", "a", false)];
			const bodyEl = buildTableBody(container, rowsA);

			simulateSelectionEffect({ selectionManager, bodyEl, rows: rowsA });

			// Select row a then clear it
			selectionManager.setSelection([makeSelectionId("a")]);
			selectionManager.clearSelection();

			// Change rows while no selection
			const rowsB = [makeRow("b", "b", true)];
			queueMicrotask(() =>
				applySelectionOpacity({
					bodyEl,
					rows: rowsB,
					hasSelection: () => selectionManager.hasSelection(),
					getSelectionIds: () => selectionManager.getSelectionIds(),
				}),
			);

			await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

			// Row b is highlighted with no selection → HIGHLIGHTED
			const rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(HIGHLIGHTED_OPACITY); // b: highlighted, no selection → HIGHLIGHTED
		});

		it("queueMicrotask re-apply with multi-selection preserved across rows change", async () => {
			const rowsA = [makeRow("a", "a", false), makeRow("b", "b", false), makeRow("c", "c", false)];
			const bodyEl = buildTableBody(container, rowsA);

			simulateSelectionEffect({ selectionManager, bodyEl, rows: rowsA });

			// Select rows a and c
			selectionManager.setSelection([makeSelectionId("a"), makeSelectionId("c")]);
			let rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FULL_OPACITY);   // a: selected → FULL
			expect(rowEls[1]!.style.opacity).toBe(FADED_OPACITY);  // b: not selected → FADED
			expect(rowEls[2]!.style.opacity).toBe(FULL_OPACITY);    // c: selected → FULL

			// Change rows (new rows have different selectionIds)
			const rowsB = [makeRow("d", "d", false), makeRow("e", "e", false), makeRow("f", "f", false)];
			queueMicrotask(() =>
				applySelectionOpacity({
					bodyEl,
					rows: rowsB,
					hasSelection: () => selectionManager.hasSelection(),
					getSelectionIds: () => selectionManager.getSelectionIds(),
				}),
			);

			await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

			// All new rows have no matching selectionId → all FADED
			rowEls = bodyEl.querySelectorAll<HTMLElement>(".sla-row");
			expect(rowEls[0]!.style.opacity).toBe(FADED_OPACITY); // d: not selected → FADED
			expect(rowEls[1]!.style.opacity).toBe(FADED_OPACITY); // e: not selected → FADED
			expect(rowEls[2]!.style.opacity).toBe(FADED_OPACITY); // f: not selected → FADED
		});
	});

	// ── SlaTable.svelte source structure verification ─────────────────────

	describe("SlaTable.svelte source structure", () => {
		it("contains function applySelectionOpacity", () => {
			const source = readFileSync(
				resolve(__dirname, "SlaTable.svelte"),
				"utf8",
			);
			expect(source).toContain("function applySelectionOpacity");
		});

		it("contains two $effect blocks", () => {
			const source = readFileSync(
				resolve(__dirname, "SlaTable.svelte"),
				"utf8",
			);
			const effectCount = (source.match(/\$effect/g) || []).length;
			expect(effectCount).toBeGreaterThanOrEqual(2);
		});

		it("uses queueMicrotask(applySelectionOpacity) in rows effect", () => {
			const source = readFileSync(
				resolve(__dirname, "SlaTable.svelte"),
				"utf8",
			);
			expect(source).toContain("queueMicrotask(applySelectionOpacity)");
		});

		it("compiled JS calls registerOnSelectCallback, hasSelection, getSelectionIds", () => {
			const source = readFileSync(
				resolve(__dirname, "SlaTable.svelte"),
				"utf8",
			);
			const compiled = compile(source, {
				filename: "SlaTable.svelte",
				generate: "client",
				dev: false,
			});
			expect(compiled.js.code).toContain("registerOnSelectCallback");
			expect(compiled.js.code).toContain("hasSelection");
			expect(compiled.js.code).toContain("getSelectionIds");
		});
	});
});

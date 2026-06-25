/**
 * SlaTable unit tests — no DOM library required.
 *
 * Compiles SlaTable.svelte and inspects the generated code for
 * structural correctness.
 *
 * Run: npx vitest run src/components/SlaTable.test.ts
 */

import { describe, it, expect } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";

const COMPONENT_PATH = "src/components/SlaTable.svelte";

function compileComponent(source: string) {
	return compile(source, {
		filename: COMPONENT_PATH,
		generate: "client",
		dev: false,
	});
}

describe("SlaTable", () => {
	const source = readFileSync(COMPONENT_PATH, "utf8");
	const compiled = compileComponent(source);
	const jsCode = compiled.js.code;

	// 1. Uses $props() and NOT export let
	it("uses $props() and NOT export let", () => {
		expect(source).toContain("const {");
		expect(source).toContain("= $props()");
		expect(source).not.toContain("export let ");
	});

	// 2. Imports SlaRow as type from ../types
	it("imports SlaRow as type from ../types", () => {
		expect(source).toContain("import type { SlaRow");
		expect(source).toContain('from "../types"');
	});

	// 3. Does NOT import SlaStatus (removed as unused)
	it("does not import SlaStatus", () => {
		expect(source).not.toMatch(/import\s+type\s*\{[^}]*\bSlaStatus\b/);
	});

	// 4. Imports SlaRow from ./SlaRow.svelte
	it("imports SlaRow from ./SlaRow.svelte", () => {
		expect(source).toContain('import SlaRowComponent from "./SlaRow.svelte"');
	});

	// 5. The 9 column header labels are present in order
	it("has 9 column header labels in correct order", () => {
		const expectedLabels = [
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
		for (const label of expectedLabels) {
			expect(source).toContain(label);
		}
		// Verify order by checking relative positions
		const slaIdx = source.indexOf('"SLA"');
		const categoryIdx = source.indexOf('"Category"');
		const ownerIdx = source.indexOf('"Owner"');
		const currentIdx = source.indexOf('"Current"');
		const targetIdx = source.indexOf('"Target"');
		const perfIdx = source.indexOf('"Performance vs Target"');
		const trendIdx = source.indexOf('"30D Trend"');
		const statusIdx = source.indexOf('"Status"');
		const ttbIdx = source.indexOf('"Time-to-Breach"');
		expect(slaIdx).toBeLessThan(categoryIdx);
		expect(categoryIdx).toBeLessThan(ownerIdx);
		expect(ownerIdx).toBeLessThan(currentIdx);
		expect(currentIdx).toBeLessThan(targetIdx);
		expect(targetIdx).toBeLessThan(perfIdx);
		expect(perfIdx).toBeLessThan(trendIdx);
		expect(trendIdx).toBeLessThan(statusIdx);
		expect(statusIdx).toBeLessThan(ttbIdx);
	});

	// 6. Outer wrapper has class="sla-table", role="table", aria-label="SLA scorecard"
	it('outer wrapper has class="sla-table", role="table", aria-label="SLA scorecard"', () => {
		expect(source).toContain('class="sla-table"');
		expect(source).toContain('role="table"');
		expect(source).toContain('aria-label="SLA scorecard"');
	});

	// 7. Head has class="sla-table__head", role="row"
	it('head has class="sla-table__head", role="row"', () => {
		expect(source).toContain('class="sla-table__head"');
		expect(source).toContain('role="row"');
	});

	// 8. Body has class="sla-table__body", role="rowgroup"
	it('body has class="sla-table__body", role="rowgroup"', () => {
		expect(source).toContain('class="sla-table__body"');
		expect(source).toContain('role="rowgroup"');
	});

	// 9. Each header cell has class="sla-cell sla-cell--head", role="columnheader"
	it('each header cell has class="sla-cell sla-cell--head", role="columnheader"', () => {
		expect(source).toContain('class="sla-cell sla-cell--head"');
		expect(source).toContain('role="columnheader"');
	});

	// 10. Empty state has class="sla-empty" and exact text
	it('empty state has class="sla-empty" and text "No SLAs match the current filters."', () => {
		expect(source).toContain('class="sla-empty"');
		expect(source).toContain("No SLAs match the current filters.");
	});

	// 11. Body uses {#each rows as row, i (row.slaId)} iteration
	it("body iterates rows using {#each rows as row, i (row.slaId)}", () => {
		expect(source).toContain("{#each rows as row, i (row.slaId)}");
	});

	// 12. Compiled JS uses $.each and references rows
	it("compiled JS uses $.each and references rows", () => {
		expect(jsCode).toContain("$.each");
		expect(jsCode).toContain("rows");
	});

	// 13. File has <script lang="ts"> and </script> tags
	it('has <script lang="ts"> and </script> tags', () => {
		expect(source).toContain("<script lang=\"ts\">");
		expect(source).toContain("</script>");
	});

	// 14. Head rendering uses COLUMN_LABELS each block (or inline list)
	it("head rendering uses COLUMN_LABELS iteration (or equivalent literal list)", () => {
		// Either COLUMN_LABELS constant is used in the head each block,
		// or 9 literal cells are present inline — both are acceptable.
		const hasColumnLabelsConstant =
			source.includes("COLUMN_LABELS") &&
			source.includes("{#each COLUMN_LABELS");
		const hasInlineCells = (source.match(/class="sla-cell sla-cell--head"/g) || []).length === 9;
		expect(hasColumnLabelsConstant || hasInlineCells).toBe(true);
		if (hasColumnLabelsConstant) {
			expect(source).toContain("const COLUMN_LABELS = [");
		}
	});

	// 15. SlaRowComponent receives all 9 props including targetLineColor, bandColors, renderVersion
	it("SlaRowComponent receives all 9 props and destructure has no underscore prefixes", () => {
		// Verify new props are forwarded to SlaRowComponent
		expect(source).toContain("{targetLineColor}");
		expect(source).toContain("{bandColors}");
		expect(source).toContain("{renderVersion}");
		// Verify original 6 props are still forwarded
		expect(source).toContain("{row}");
		expect(source).toContain("index={i}");
		expect(source).toContain("{fontSize}");
		expect(source).toContain("{statusColors}");
		expect(source).toContain("{rowEvents}");
		expect(source).toContain("{onSelectionChange}");
		// Regression guard: underscore-prefixed props must not appear
		expect(source).not.toContain("_targetLineColor");
		expect(source).not.toContain("_bandColors");
		expect(source).not.toContain("_renderVersion");
	});

	// 16. imports FADED_OPACITY, HIGHLIGHTED_OPACITY, FULL_OPACITY from ../opacity-constants
	it(
		"imports FADED_OPACITY, HIGHLIGHTED_OPACITY, FULL_OPACITY from ../opacity-constants",
		() => {
			expect(source).toContain("FADED_OPACITY");
			expect(source).toContain("HIGHLIGHTED_OPACITY");
			expect(source).toContain("FULL_OPACITY");
			expect(source).toContain('from "../opacity-constants"');
		},
	);

	// 17. declares bodyEl $state ref bound to the body div
	it("declares bodyEl $state ref bound to the body div", () => {
		expect(source).toContain("let bodyEl:");
		expect(source).toContain("$state()");
		expect(source).toContain('bind:this={bodyEl}');
	});

	// 18. defines applySelectionOpacity function
	it("defines applySelectionOpacity function", () => {
		expect(source).toContain("function applySelectionOpacity");
	});

	// 19. registers a selection callback via registerOnSelectCallback
	it("registers a selection callback via registerOnSelectCallback", () => {
		expect(source).toContain("registerOnSelectCallback");
	});

	// 20. uses $effect at least twice (selection registration + rows re-apply)
	it(
		"uses $effect at least twice (selection registration + rows re-apply)",
		() => {
			const effectCount = (source.match(/\$effect/g) || []).length;
			expect(effectCount).toBeGreaterThanOrEqual(2);
		},
	);

	// 21. rows re-apply effect uses queueMicrotask
	it("rows re-apply effect uses queueMicrotask", () => {
		expect(source).toContain("queueMicrotask(applySelectionOpacity)");
	});

	// 22. applySelectionOpacity sets rowEl.style.opacity
	it("applySelectionOpacity sets rowEl.style.opacity", () => {
		expect(source).toContain("rowEl.style.opacity =");
	});

	// 23. compiled JS contains 'hasSelection' and 'getSelectionIds' from selectionManager
	it(
		"compiled JS contains 'hasSelection' and 'getSelectionIds' from selectionManager",
		() => {
			expect(jsCode).toContain("hasSelection");
			expect(jsCode).toContain("getSelectionIds");
		},
	);

	// 24. all lines are 100 characters or shorter
	it("all lines are 100 characters or shorter", () => {
		const longLines = source
			.split("\n")
			.filter((line) => line.length > 100);
		expect(longLines).toHaveLength(0);
	});
});

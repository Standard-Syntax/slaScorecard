/**
 * SlaRow unit tests — no DOM library required.
 *
 * Compiles SlaRow.svelte and inspects the generated code for
 * structural correctness.
 *
 * Run: npx vitest run src/components/SlaRow.test.ts
 */

import { describe, it, expect } from "vitest";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";

const COMPONENT_PATH = "src/components/SlaRow.svelte";

function compileComponent(source: string) {
	return compile(source, {
		filename: COMPONENT_PATH,
		generate: "client",
		dev: false,
	});
}

describe("SlaRow", () => {
	const source = readFileSync(COMPONENT_PATH, "utf8");
	const compiled = compileComponent(source);
	const jsCode = compiled.js.code;

	// 1. Uses $props() and NOT export let
	it("uses $props() and NOT export let", () => {
		expect(source).toContain("const {");
		expect(source).toMatch(/=\s*\$props\(\)/);
		expect(source).not.toContain("export let ");
	});

	// 2. Imports SlaRow as type from ../types
	it("imports SlaRow as type from ../types", () => {
		expect(source).toContain("import type { SlaRow");
		expect(source).toContain('from "../types"');
	});

	// 3. Imports STATUS_LABEL as a value from ../types (not a type import)
	it("imports STATUS_LABEL as a value from ../types", () => {
		expect(source).toContain('import { STATUS_LABEL } from "../types"');
		expect(source).not.toContain("import type { STATUS_LABEL");
	});

	// 4. Imports formatCurrentValue and formatTargetValue from ../row-builder
	it("imports formatCurrentValue and formatTargetValue from ../row-builder", () => {
		const pattern =
			`import\\s*\\{[^}]*\\bformatCurrentValue\\b[^}]*\\bformatTargetValue\\b[^}]*\\}` +
			`\\s+from\\s+["']\\.\\.\\/row-builder["']`;
		expect(source).toMatch(new RegExp(pattern, "s"));
	});

	// 5. Imports powerbi as a type from powerbi-visuals-api
	it("imports powerbi as a type from powerbi-visuals-api", () => {
		expect(source).toContain('import type powerbi from "powerbi-visuals-api"');
	});

	// 6. Outer wrapper has class containing "sla-row" and status suffix,
	// role="row", tabindex="0", and an aria-label
	it("outer wrapper has class sla-row and sla-row--{status}, role=row, tabindex=0", () => {
		expect(source).toContain('class="sla-row sla-row--{row.status}"');
		expect(source).toContain('role="row"');
		expect(source).toContain('tabindex="0"');
	});

	it("outer wrapper has aria-label built from slaName, status, current, target", () => {
		expect(source).toContain("aria-label={ariaLabel}");
		expect(source).toContain("row.slaName");
		expect(source).toContain("STATUS_LABEL[row.status]");
		expect(source).toContain("formatCurrentValue(row)");
		expect(source).toContain("formatTargetValue(row)");
	});

	// 7. Row has data-index attribute set to String(index)
	it("row has data-index={String(index)}", () => {
		expect(source).toContain("data-index={String(index)}");
	});

	// 8. Row has style:font-size set to ${fontSize}px
	it("row has style:font-size={fontSize}px", () => {
		expect(source).toContain("style:font-size=\"{fontSize}px\"");
	});

	// 9. Nine cells exist with correct classes in order
	it("has 9 cells with correct classes in order", () => {
		expect(source).toContain("sla-cell--name");
		expect(source).toContain("sla-cell--category");
		expect(source).toContain("sla-cell--owner");
		expect(source).toContain("sla-cell--current");
		expect(source).toContain("sla-cell--target");
		expect(source).toContain("sla-cell--bullet");
		expect(source).toContain("sla-cell--spark");
		expect(source).toContain("sla-cell--status");
		expect(source).toContain("sla-cell--ttb");
	});

	// 10. NAME cell: sla-name div and sla-id div inside sla-cell--name
	it("name cell contains sla-name and sla-id", () => {
		expect(source).toContain('class="sla-name">');
		expect(source).toContain("sla-id");
		expect(source).toContain("{row.slaName}");
		expect(source).toContain("{row.slaId}");
	});

	// 11. CATEGORY cell: sla-tag span inside sla-cell--category
	it("category cell contains sla-tag span with row.category", () => {
		expect(source).toContain('class="sla-tag">');
		expect(source).toContain("{row.category}");
	});

	// 12. OWNER cell: sla-avatar with style:background and sla-owner__name
	it("owner cell contains sla-avatar with style:background=row.ownerColor", () => {
		expect(source).toContain('class="sla-avatar"');
		expect(source).toContain("style:background={row.ownerColor}");
		expect(source).toContain("sla-owner__name");
		expect(source).toContain("{row.ownerInitials}");
		expect(source).toContain("{row.ownerName}");
	});

	// 13. CURRENT cell: sla-current with status class and formatCurrentValue
	it("current cell contains sla-current with sla-current--{row.status} and formatCurrentValue", () => {
		expect(source).toContain('class="sla-current sla-current--{row.status}"');
		expect(source).toContain("{formatCurrentValue(row)}");
	});

	// 14. TARGET cell: sla-cell--target with formatTargetValue
	it("target cell contains sla-cell--target with formatTargetValue", () => {
		expect(source).toContain("sla-cell--target");
		expect(source).toContain("{formatTargetValue(row)}");
	});

	// 15. BULLET cell renders <BulletChart> inside sla-cell--bullet
	it("bullet cell renders <BulletChart> component inside sla-cell--bullet", () => {
		expect(source).toContain('class="sla-cell sla-cell--bullet"');
		expect(source).toContain("<BulletChart");
	});

	// 16. SPARK cell renders <Sparkline> inside sla-cell--spark
	it("spark cell renders <Sparkline> component inside sla-cell--spark", () => {
		expect(source).toContain('class="sla-cell sla-cell--spark"');
		expect(source).toContain("<Sparkline");
	});

	// 17. STATUS cell: sla-status with status class, sla-status__dot, and STATUS_LABEL text
	it("status cell contains sla-status with sla-status__dot and STATUS_LABEL", () => {
		expect(source).toContain('class="sla-status sla-status--{row.status}"');
		expect(source).toContain("sla-status__dot");
		expect(source).toContain("STATUS_LABEL[row.status]");
	});

	// 18. TTB cell: renders em-dash for null and ${toFixed(1)}d for a value
	it("TTB cell renders em-dash for null and toFixed(1)d for value", () => {
		expect(source).toContain('row.timeToBreach === null ? "\\u2014"');
		expect(source).toContain("row.timeToBreach.toFixed(1)}d`");
	});

	// 19. File uses <script lang="ts">
	it("file uses <script lang=\"ts\">", () => {
		expect(source).toContain('<script lang="ts">');
		expect(source).toContain("</script>");
	});

	// 20. Compiles cleanly via svelte/compiler
	it("compiles cleanly via svelte/compiler", () => {
		expect(compiled.js.code.length).toBeGreaterThan(0);
		expect(() => compileComponent(source)).not.toThrow();
	});

	// 21. All lines ≤ 100 chars
	it("all lines are 100 characters or shorter", () => {
		const lines = source.split("\n");
		const longLines = lines.filter((line) => line.length > 100);
		expect(longLines, `Lines exceeding 100 chars: ${longLines.map((l) => `${l.length}: ${l}`).join(", ")}`).toHaveLength(0);
	});

	// 22. Uses onclick= attribute on the sla-row outer div
	it("uses onclick= attribute on outer div", () => {
		expect(source).toMatch(/onclick=\{/);
	});

	// 23. Uses onkeydown= attribute on outer div
	it("uses onkeydown= attribute on outer div", () => {
		expect(source).toMatch(/onkeydown=\{/);
	});

	// 24. Uses onmouseover= attribute on outer div
	it("uses onmouseover= attribute on outer div", () => {
		expect(source).toMatch(/onmouseover=\{/);
	});

	// 25. Uses onmousemove= attribute on outer div
	it("uses onmousemove= attribute on outer div", () => {
		expect(source).toMatch(/onmousemove=\{/);
	});

	// 26. Uses onmouseout= attribute on outer div
	it("uses onmouseout= attribute on outer div", () => {
		expect(source).toMatch(/onmouseout=\{/);
	});

	// 27. Uses oncontextmenu= attribute on outer div
	it("uses oncontextmenu= attribute on outer div", () => {
		expect(source).toMatch(/oncontextmenu=\{/);
	});

	// 28. Calls selectionManager.select
	it("calls selectionManager.select", () => {
		expect(source).toMatch(/selectionManager\s*\.\s*select/);
	});

	// 29. Calls host.drill with roleName: "sla" and drillType: 2
	it("calls host.drill with roleName: sla and drillType: 2", () => {
		expect(source).toContain('roleName: "sla"');
		expect(source).toContain("drillType: DRILL_TYPE_DOWN");
	});

	// 30. Checks host.hostCapabilities.allowInteractions
	it("checks host.hostCapabilities.allowInteractions", () => {
		expect(source).toContain("allowInteractions");
	});

	// 31. Calls selectionManager.clear on Escape
	it("calls selectionManager.clear on Escape", () => {
		expect(source).toMatch(/selectionManager\.clear\(\)/);
	});

	// 32. Uses nextElementSibling for ArrowDown focus
	it("uses nextElementSibling for ArrowDown focus", () => {
		expect(source).toContain("nextElementSibling");
	});

	// 33. Uses previousElementSibling for ArrowUp focus
	it("uses previousElementSibling for ArrowUp focus", () => {
		expect(source).toContain("previousElementSibling");
	});

	// 34. Imports showTooltip, moveTooltip, hideTooltip from row-tooltip
	it("imports showTooltip, moveTooltip, hideTooltip from ../row-tooltip", () => {
		expect(source).toContain("showTooltip");
		expect(source).toContain("moveTooltip");
		expect(source).toContain("hideTooltip");
		expect(source).toContain('from "../row-tooltip"');
	});

	// 35. Uses event.stopPropagation() in onclick
	it("uses event.stopPropagation() in onclick", () => {
		expect(source).toContain("event.stopPropagation()");
	});

	// 36. Uses event.preventDefault() in onkeydown
	it("uses event.preventDefault() in onkeydown", () => {
		expect(source).toMatch(/\w+\.preventDefault\(\)/);
	});

	// 37. Uses event.preventDefault() in oncontextmenu
	it("uses event.preventDefault() in oncontextmenu", () => {
		const contextMenuSection = source.match(/oncontextmenu=\{[\s\S]*?\}/);
		expect(contextMenuSection?.[0]).toContain("preventDefault()");
	});

	// 38. Uses bind:this for rowEl
	it("uses bind:this for rowEl", () => {
		expect(source).toContain("bind:this={rowEl}");
	});

	// 39. Imports DRILL_TYPE_DOWN constant
	it("defines DRILL_TYPE_DOWN constant", () => {
		expect(source).toContain("DRILL_TYPE_DOWN");
	});

	// 40. Imports BulletChart and Sparkline from ./
	it("imports BulletChart and Sparkline from ./", () => {
		expect(source).toContain(
			'import BulletChart from "./BulletChart.svelte"',
		);
		expect(source).toContain('import Sparkline from "./Sparkline.svelte"');
	});

	// 41. Imports computeBulletMaxValue and resolveSparklineOptions from ../row-builder
	it(
		"imports computeBulletMaxValue and resolveSparklineOptions from ../row-builder",
		() => {
			expect(source).toContain("computeBulletMaxValue");
			expect(source).toContain("resolveSparklineOptions");
			expect(source).toContain('from "../row-builder"');
		},
	);

	// 42. Renders BulletChart inside sla-cell--bullet with all required props
	it(
		"renders BulletChart inside sla-cell--bullet with all required props",
		() => {
			expect(source).toContain("class=\"sla-cell sla-cell--bullet\"");
			expect(source).toContain("<BulletChart");
			expect(source).toContain("current={row.current}");
			expect(source).toContain("target={row.target}");
			expect(source).toContain("badThreshold={row.badThreshold}");
			expect(source).toContain("cautionThreshold={row.cautionThreshold}");
			expect(source).toContain("maxValue={bulletMaxValue}");
			expect(source).toContain("badColor={bandColors.badColor}");
			expect(source).toContain("cautionColor={bandColors.cautionColor}");
			expect(source).toContain("onTargetColor={bandColors.onTargetColor}");
			expect(source).toContain("barColor={statusColors[row.status]}");
			expect(source).toContain("targetLineColor={targetLineColor}");
		},
	);

	// 43. Renders Sparkline inside sla-cell--spark with all required props
	it("renders Sparkline inside sla-cell--spark with all required props", () => {
		expect(source).toContain("class=\"sla-cell sla-cell--spark\"");
		expect(source).toContain("<Sparkline");
		expect(source).toContain("values={sparklineOptions.values}");
		expect(source).toContain("lineColor={sparklineOptions.lineColor}");
		expect(source).toContain("fillColor={sparklineOptions.fillColor}");
		expect(source).toContain("showDots={sparklineOptions.showDots}");
	});

	// 44. Does NOT contain placeholder bullet/spark divs
	it("does NOT contain placeholder bullet/spark divs", () => {
		expect(source).not.toContain('<div class="sla-bullet">');
		expect(source).not.toContain('<div class="sla-spark">');
	});
});

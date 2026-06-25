<script lang="ts">
	import type powerbi from "powerbi-visuals-api";
	import type { SlaRow, ISelectionId } from "../types";
	import SlaRowComponent from "./SlaRow.svelte";
	import {
		FADED_OPACITY,
		HIGHLIGHTED_OPACITY,
		FULL_OPACITY,
	} from "../opacity-constants";

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

	interface RowEvents {
		host: powerbi.extensibility.visual.IVisualHost;
		selectionManager: powerbi.extensibility.ISelectionManager;
		tooltipService: powerbi.extensibility.ITooltipService;
	}

	interface Props {
		rows: SlaRow[];
		targetLineColor: string;
		statusColors: StatusColors;
		bandColors: BandColors;
		fontSize: number;
		renderVersion: number;
		onSelectionChange: () => void;
		rowEvents: RowEvents;
	}

	const {
		rows,
		targetLineColor,
		statusColors,
		bandColors,
		fontSize,
		renderVersion,
		onSelectionChange,
		rowEvents,
	}: Props = $props();

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
	] as const;

	let bodyEl: HTMLElement | undefined = $state();

	function applySelectionOpacity(): void {
		if (!bodyEl) return;
		const hasSel = rowEvents.selectionManager.hasSelection();
		const selectedIds =
			rowEvents.selectionManager.getSelectionIds() as ISelectionId[];
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

	$effect(() => {
		rowEvents.selectionManager.registerOnSelectCallback(
			applySelectionOpacity,
		);
	});

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		rows;
		queueMicrotask(applySelectionOpacity);
	});
</script>

<div class="sla-table" role="table" aria-label="SLA scorecard">
	<div class="sla-table__head" role="row">
		{#each COLUMN_LABELS as label (label)}
			<div class="sla-cell sla-cell--head" role="columnheader">
				{label}
			</div>
		{/each}
	</div>
	<div class="sla-table__body" role="rowgroup" bind:this={bodyEl}>
		{#if rows.length === 0}
			<div class="sla-empty">No SLAs match the current filters.</div>
		{:else}
			{#each rows as row, i (row.slaId)}
				<SlaRowComponent
					{row}
					index={i}
					{fontSize}
					{statusColors}
					{rowEvents}
					{onSelectionChange}
					{targetLineColor}
					{bandColors}
					{renderVersion}
				/>
			{/each}
		{/if}
	</div>
</div>

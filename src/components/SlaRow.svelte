<script lang="ts">
	import type powerbi from "powerbi-visuals-api";
	import type { SlaRow } from "../types";
	import { STATUS_LABEL } from "../types";
	import {
		formatCurrentValue,
		formatTargetValue,
		computeBulletMaxValue,
		resolveSparklineOptions,
	} from "../row-builder";
	import {
		showTooltip,
		moveTooltip,
		hideTooltip,
	} from "../row-tooltip";
	import BulletChart from "./BulletChart.svelte";
	import Sparkline from "./Sparkline.svelte";

	// Inlined: powerbi.DrillType.Down = 2
	const DRILL_TYPE_DOWN = 2 as powerbi.DrillType.Down;

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
		row: SlaRow;
		index: number;
		fontSize: number;
		statusColors: StatusColors;
		rowEvents: RowEvents;
		onSelectionChange: () => void;
		targetLineColor: string;
		bandColors: BandColors;
		renderVersion: number;
	}

	const {
		row,
		index,
		fontSize,
		statusColors,
		rowEvents,
		onSelectionChange,
		targetLineColor,
		bandColors,
		renderVersion: _renderVersion,
	} = $props();

	const bulletMaxValue = $derived(computeBulletMaxValue(row));
	const sparklineOptions = $derived(resolveSparklineOptions(row.trend));

	let rowEl: HTMLElement | undefined = $state();

	const ariaLabel = $derived(
		`${row.slaName}, status ${STATUS_LABEL[row.status]}, ` +
			`current ${formatCurrentValue(row)}, target ${formatTargetValue(row)}`,
	);
</script>

<div
	bind:this={rowEl}
	class="sla-row sla-row--{row.status}"
	role="row"
	tabindex="0"
	aria-label={ariaLabel}
	style:font-size="{fontSize}px"
	data-index={String(index)}
	onclick={(event) => {
		event.stopPropagation();
		if (!rowEvents.host.hostCapabilities.allowInteractions) return;
		const me = event as MouseEvent;
		const isMulti = me.ctrlKey || me.metaKey;
		void rowEvents.selectionManager
			.select(row.selectionId, isMulti)
			.then(onSelectionChange);
		rowEvents.host.drill({ roleName: "sla", drillType: DRILL_TYPE_DOWN });
	}}
	onkeydown={(event) => {
		const ke = event as KeyboardEvent;
		if (ke.key === "Enter" || ke.key === " ") {
			ke.preventDefault();
			void rowEvents.selectionManager
				.select(row.selectionId)
				.then(onSelectionChange);
			rowEvents.host.drill({
				roleName: "sla",
				drillType: DRILL_TYPE_DOWN,
			});
		} else if (ke.key === "Escape") {
			rowEvents.selectionManager.clear();
			onSelectionChange();
		} else if (ke.key === "ArrowDown") {
			const next = rowEl?.nextElementSibling as HTMLElement | undefined;
			next?.focus();
			ke.preventDefault();
		} else if (ke.key === "ArrowUp") {
			const prev = rowEl?.previousElementSibling as HTMLElement | undefined;
			prev?.focus();
			ke.preventDefault();
		}
	}}
	onmouseover={(event) =>
		showTooltip(rowEvents.tooltipService, event as MouseEvent, row)}
	onmousemove={(event) =>
		moveTooltip(rowEvents.tooltipService, event as MouseEvent)}
	onmouseout={() => hideTooltip(rowEvents.tooltipService)}
	oncontextmenu={(event) => {
		const me = event as MouseEvent;
		me.preventDefault();
		me.stopPropagation();
		if (!rowEvents.host.hostCapabilities.allowInteractions) return;
		const cms = (rowEvents.host as unknown as {
			contextMenuService?: {
				show: (payload: {
					coordinates: [number, number];
					dataItems: Array<{ displayName: string; value: string }>;
				}) => void;
			};
		}).contextMenuService;
		if (!cms || typeof cms.show !== "function") return;
		cms.show({
			coordinates: [me.clientX, me.clientY],
			dataItems: [
				{ displayName: "SLA", value: row.slaName },
				{ displayName: "Category", value: row.category },
				{ displayName: "Status", value: STATUS_LABEL[row.status] },
			],
		});
	}}
>
	<div class="sla-cell sla-cell--name">
		<div class="sla-name">{row.slaName}</div>
		<div class="sla-id">ID: {row.slaId}</div>
	</div>

	<div class="sla-cell sla-cell--category">
		<span class="sla-tag">{row.category}</span>
	</div>

	<div class="sla-cell sla-cell--owner">
		<span class="sla-avatar" style:background={row.ownerColor}
			>{row.ownerInitials}</span
		>
		<span class="sla-owner__name">{row.ownerName}</span>
	</div>

	<div class="sla-cell sla-cell--current">
		<span class="sla-current sla-current--{row.status}"
			>{formatCurrentValue(row)}</span
		>
	</div>

	<div class="sla-cell sla-cell--target">{formatTargetValue(row)}</div>

	<div class="sla-cell sla-cell--bullet">
		<BulletChart
			current={row.current}
			target={row.target}
			badThreshold={row.badThreshold}
			cautionThreshold={row.cautionThreshold}
			maxValue={bulletMaxValue}
			badColor={bandColors.badColor}
			cautionColor={bandColors.cautionColor}
			onTargetColor={bandColors.onTargetColor}
			barColor={statusColors[row.status]}
			targetLineColor={targetLineColor}
		/>
	</div>

	<div class="sla-cell sla-cell--spark">
		<Sparkline
			values={sparklineOptions.values}
			lineColor={sparklineOptions.lineColor}
			fillColor={sparklineOptions.fillColor}
			showDots={sparklineOptions.showDots}
		/>
	</div>

	<div class="sla-cell sla-cell--status">
		<span class="sla-status sla-status--{row.status}">
			<span class="sla-status__dot"></span>
			<span>{STATUS_LABEL[row.status]}</span>
		</span>
	</div>

	<div class="sla-cell sla-cell--ttb">
		{row.timeToBreach === null ? "\u2014" : `${row.timeToBreach.toFixed(1)}d`}
	</div>
</div>

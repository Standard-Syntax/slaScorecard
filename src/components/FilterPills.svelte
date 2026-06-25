<script lang="ts">
	import type { CategoryBucket } from "../types";

	let {
		buckets,
		activeName,
		onSelect,
	}: {
		buckets: CategoryBucket[];
		activeName: string;
		onSelect: (name: string) => void;
	} = $props();

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (event.key === "ArrowLeft") {
			const prev = index - 1;
			if (prev >= 0) {
				const btns = Array.from(
					document.querySelectorAll<HTMLButtonElement>(".sla-filter-pills button"),
				);
				btns[prev]?.focus();
				event.preventDefault();
			}
		} else if (event.key === "ArrowRight") {
			const next = index + 1;
			const btns = Array.from(
				document.querySelectorAll<HTMLButtonElement>(".sla-filter-pills button"),
			);
			if (next < btns.length) {
				btns[next]?.focus();
				event.preventDefault();
			}
		}
	}
</script>

<div class="flex flex-wrap gap-2 items-center" role="presentation">
	<div
		class="sla-filter-pills flex flex-wrap items-center gap-1.5"
		role="tablist"
		aria-label="Filter SLAs by category"
	>
		{#each buckets as bucket, i (bucket.name)}
			{@const active = bucket.name === activeName}
			<button
				type="button"
				role="tab"
				class="sla-pill{active ? ' sla-pill--active' : ''}"
				aria-selected={active}
				tabindex={active ? 0 : -1}
				data-category={bucket.name}
				onclick={() => onSelect(bucket.name)}
				onkeydown={(e) => handleKeydown(e, i)}
			>
				<span class="sla-pill__label">{bucket.name}</span>
				<span class="sla-pill__count">{String(bucket.count)}</span>
			</button>
		{/each}
	</div>
</div>

<script lang="ts">
	let { initialValue, onInput }: { initialValue: string; onInput: (value: string) => void } = $props();

	let value = $state(initialValue);
</script>

<div class="sla-search ml-auto h-7 w-[200px]">
	<input
		type="search"
		class="sla-search__input"
		placeholder="Search SLAs..."
		aria-label="Search SLAs by name"
		bind:value
		oninput={() => onInput(value.trim())}
	/>
</div>

<script lang="ts">
    import type { LegendSwatch } from "../types";

    interface Props {
        swatches: LegendSwatch[];
        caption: string;
    }

    const { swatches, caption } = $props();
</script>

<div class="sla-legend flex flex-wrap gap-3.5 items-center justify-between">
    <div class="sla-legend__items flex flex-wrap gap-3.5">
        {#each swatches as swatch (swatch.label)}
            <span class="sla-legend__item inline-flex items-center gap-1.5">
                {#if swatch.kind === "line"}
                    <span class="sla-legend__line" style:background={swatch.color}></span>
                {:else}
                    <span class="sla-legend__swatch" style:background={swatch.color}></span>
                {/if}
                <span class="sla-legend__label">{swatch.label}</span>
            </span>
        {/each}
    </div>
    <div class="sla-legend__caption">{caption}</div>
</div>

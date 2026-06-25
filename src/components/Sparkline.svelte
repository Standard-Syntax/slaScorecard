<script lang="ts">
    import { renderSparkline } from "../sparkline";
    import type { SparklineOptions } from "../sparkline";

    interface Props extends Omit<SparklineOptions, "width" | "height"> {
        width?: number;
        height?: number;
    }

    const {
        width = 140,
        height = 36,
        values,
        lineColor,
        fillColor,
        showDots,
        referenceLine,
    }: Props = $props();

    let host: HTMLElement;

    $effect(() => {
        if (!host) return;
        requestAnimationFrame(() => {
            renderSparkline(host, {
                width: width || host.clientWidth,
                height,
                values,
                lineColor,
                fillColor,
                showDots,
                referenceLine,
            });
        });
    });
</script>

<div class="sla-spark" bind:this={host}></div>

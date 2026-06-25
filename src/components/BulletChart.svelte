<script lang="ts">
    import { renderBulletChart } from "../bulletChart";
    import type { BulletChartOptions } from "../bulletChart";

    interface Props extends Omit<BulletChartOptions, "width" | "height"> {
        width?: number;
        height?: number;
    }

    const {
        width = 150,
        height = 36,
        current,
        target,
        badThreshold,
        cautionThreshold,
        maxValue,
        badColor,
        cautionColor,
        onTargetColor,
        barColor,
        targetLineColor,
    }: Props = $props();

    let host: HTMLElement;

    $effect(() => {
        if (!host) return;
        requestAnimationFrame(() => {
            renderBulletChart(host, {
                width: width || host.clientWidth,
                height,
                current,
                target,
                badThreshold,
                cautionThreshold,
                maxValue,
                badColor,
                cautionColor,
                onTargetColor,
                barColor,
                targetLineColor,
            });
        });
    });
</script>

<div class="sla-bullet" bind:this={host}></div>

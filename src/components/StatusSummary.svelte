<script lang="ts">
    import type { SlaRow, SlaStatus } from "../types";
    import { STATUS_LABEL } from "../types";
    import { hexToRgba } from "../theme";

    interface Props {
        rows: SlaRow[];
        colors: { met: string; atRisk: string; breached: string };
    }

    const { rows, colors } = $props();

    const STATUS_KEYS = ["met", "atRisk", "breached"] as const satisfies readonly SlaStatus[];

    const counts = $derived(
        STATUS_KEYS.reduce<Record<SlaStatus, number>>(
            (acc, key) => {
                acc[key] = rows.filter((r: SlaRow) => r.status === key).length;
                return acc;
            },
            { met: 0, atRisk: 0, breached: 0 },
        ),
    );
</script>

<div class="flex flex-wrap gap-2 items-center justify-end" aria-label="Status summary" role="status" aria-live="polite">
    {#each STATUS_KEYS as key (key)}
        <span
            class="sla-summary-pill sla-summary-pill--{key}"
            style:background={hexToRgba(colors[key], 0.1)}
            style:color={colors[key]}
        >
            <span class="sla-summary-pill__label">{STATUS_LABEL[key]}</span>
            <span class="sla-summary-pill__count">{String(counts[key])}</span>
        </span>
    {/each}
</div>

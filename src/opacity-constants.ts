/*
 * SLA Scorecard — Opacity constants
 *
 * Selection-opacity tier values used by SlaTable.svelte's applySelectionOpacity
 * effect to reflect highlight and selection state onto row DOM nodes.
 *
 * With no selection: highlighted rows = HIGHLIGHTED_OPACITY, others = FULL.
 * With a selection: selected + highlighted = FULL, all others = FADED.
 */

export const FADED_OPACITY = "0.3";
export const HIGHLIGHTED_OPACITY = "0.5";
export const FULL_OPACITY = "1";

/*
 *  SLA Scorecard — Bullet chart renderer
 *
 *  Renders a horizontal bullet chart with three qualitative bands
 *  (bad / caution / on-target), a current-value bar, and a target marker.
 */

import * as d3 from "d3";

export interface BulletChartOptions {
    width: number;
    height: number;
    current: number;
    target: number;
    badThreshold: number;
    cautionThreshold: number;
    maxValue: number;
    badColor: string;
    cautionColor: string;
    onTargetColor: string;
    barColor: string;
    targetLineColor: string;
}

export function renderBulletChart(container: HTMLElement, options: BulletChartOptions): void {
    const { width, height, current, target, badThreshold, cautionThreshold, maxValue } = options;

    d3.select(container).selectAll("*").remove();

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("focusable", false);

    const barHeight = Math.max(8, Math.round(height * 0.45));
    const barY = Math.round((height - barHeight) / 2);
    const x = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, width]);

    const drawBand = (startVal: number, endVal: number, color: string): void => {
        const x0 = x(Math.max(0, startVal));
        const x1 = x(Math.min(maxValue, endVal));
        const w = Math.max(0, x1 - x0);
        if (w <= 0) return;
        svg.append("rect")
            .attr("x", x0)
            .attr("y", barY)
            .attr("width", w)
            .attr("height", barHeight)
            .attr("fill", color)
            .attr("rx", 1);
    };

    drawBand(0, badThreshold, options.badColor);
    drawBand(badThreshold, cautionThreshold, options.cautionColor);
    drawBand(cautionThreshold, maxValue, options.onTargetColor);

    const currentX = Math.max(0, Math.min(width, x(Math.max(0, current))));
    const currentWidth = Math.max(2, currentX);
    svg.append("rect")
        .attr("x", 0)
        .attr("y", barY)
        .attr("width", currentWidth)
        .attr("height", barHeight)
        .attr("fill", options.barColor)
        .attr("rx", 1);

    const targetX = Math.max(0, Math.min(width, x(target)));
    svg.append("line")
        .attr("x1", targetX)
        .attr("x2", targetX)
        .attr("y1", barY - 3)
        .attr("y2", barY + barHeight + 3)
        .attr("stroke", options.targetLineColor)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round");
}

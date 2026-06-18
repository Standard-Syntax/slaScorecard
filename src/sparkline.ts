/*
 *  SLA Scorecard — Sparkline renderer
 *
 *  Renders a minimal line sparkline. No axes, no labels — just a smooth
 *  trend line whose color reflects whether the most recent value is above
 *  or below the first.
 */

import * as d3 from "d3";

export interface SparklineOptions {
    width: number;
    height: number;
    values: number[];
    lineColor: string;
    fillColor: string;
    showDots: boolean;
    referenceLine?: number;
}

export function renderSparkline(container: HTMLElement, options: SparklineOptions): void {
    const { width, height, values } = options;

    d3.select(container).selectAll("*").remove();

    if (!values || values.length < 2) {
        return;
    }

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("focusable", false);

    const padX = 1;
    const padY = 3;
    const innerW = Math.max(1, width - padX * 2);
    const innerH = Math.max(1, height - padY * 2);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const x = d3.scaleLinear()
        .domain([0, values.length - 1])
        .range([padX, padX + innerW]);

    const y = d3.scaleLinear()
        .domain([min - range * 0.1, max + range * 0.1])
        .range([padY + innerH, padY]);

    const line = d3.line<number>()
        .x((_d, i) => x(i))
        .y((d) => y(d))
        .curve(d3.curveMonotoneX);

    const area = d3.area<number>()
        .x((_d, i) => x(i))
        .y0(padY + innerH)
        .y1((d) => y(d))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(values)
        .attr("fill", options.fillColor)
        .attr("opacity", 0.5)
        .attr("d", area);

    svg.append("path")
        .datum(values)
        .attr("fill", "none")
        .attr("stroke", options.lineColor)
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);

    if (options.showDots) {
        const first = values[0];
        const last = values[values.length - 1];
        if (first !== undefined) {
            svg.append("circle")
                .attr("cx", x(0))
                .attr("cy", y(first))
                .attr("r", 1.5)
                .attr("fill", options.lineColor);
        }
        if (last !== undefined) {
            svg.append("circle")
                .attr("cx", x(values.length - 1))
                .attr("cy", y(last))
                .attr("r", 2)
                .attr("fill", options.lineColor);
        }
    }
}

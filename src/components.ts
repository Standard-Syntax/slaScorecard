/*
 *  SLA Scorecard — UI component builders
 *
 *  Pure DOM builders for the chrome of the visual: category filter pills,
 *  search input, status summary pills, and the bottom legend. None of
 *  these touch Power BI APIs — they just produce HTMLElements.
 */

"use strict";

import { CategoryBucket, StatusSummary, SlaStatus, STATUS_LABEL } from "./types";

export interface CategoryFilterEvents {
    onSelect: (name: string) => void;
}

export function renderCategoryFilters(
    container: HTMLElement,
    buckets: CategoryBucket[],
    activeName: string,
    events: CategoryFilterEvents,
): void {
    container.replaceChildren();
    container.classList.add("sla-filter-row");

    const pills = document.createElement("div");
    pills.className = "sla-filter-pills";
    pills.setAttribute("role", "tablist");
    pills.setAttribute("aria-label", "Filter SLAs by category");

    buckets.forEach((bucket) => {
        const pill = document.createElement("button");
        pill.className = "sla-pill" + (bucket.name === activeName ? " sla-pill--active" : "");
        pill.type = "button";
        pill.setAttribute("role", "tab");
        pill.setAttribute("aria-selected", String(bucket.name === activeName));
        pill.setAttribute("tabindex", bucket.name === activeName ? "0" : "-1");
        pill.dataset["category"] = bucket.name;

        const label = document.createElement("span");
        label.className = "sla-pill__label";
        label.textContent = bucket.name;

        const count = document.createElement("span");
        count.className = "sla-pill__count";
        count.textContent = String(bucket.count);

        pill.appendChild(label);
        pill.appendChild(count);

        pill.addEventListener("click", () => events.onSelect(bucket.name));
        pill.addEventListener("keydown", (event) => {
            const target = event.currentTarget as HTMLElement;
            const parent = target.parentElement;
            if (!parent) return;
            const siblings: HTMLElement[] = [];
            for (let i = 0; i < parent.children.length; i++) {
                siblings.push(parent.children[i] as HTMLElement);
            }
            const idx = siblings.indexOf(target);
            let nextIdx = idx;
            if (event.key === "ArrowRight") nextIdx = idx + 1;
            else if (event.key === "ArrowLeft") nextIdx = idx - 1;
            const next = siblings[nextIdx];
            if (next) {
                next.focus();
                event.preventDefault();
            }
        });

        pills.appendChild(pill);
    });

    container.appendChild(pills);
}

export interface SearchEvents {
    onInput: (value: string) => void;
}

export function renderSearch(
    container: HTMLElement,
    initialValue: string,
    events: SearchEvents,
): HTMLInputElement {
    container.replaceChildren();
    container.classList.add("sla-search");

    const input = document.createElement("input");
    input.type = "search";
    input.className = "sla-search__input";
    input.placeholder = "Search SLAs...";
    input.setAttribute("aria-label", "Search SLAs by name");
    input.value = initialValue;

    input.addEventListener("input", () => events.onInput(input.value));

    container.appendChild(input);
    return input;
}

export function renderStatusSummary(container: HTMLElement, summary: StatusSummary, colors: Record<SlaStatus, string>): void {
    container.replaceChildren();
    container.classList.add("sla-status-summary");
    container.setAttribute("aria-label", "Status summary");

    const items: Array<{ key: SlaStatus; count: number }> = [
        { key: "met", count: summary.met },
        { key: "atRisk", count: summary.atRisk },
        { key: "breached", count: summary.breached },
    ];

    items.forEach((item) => {
        const pill = document.createElement("span");
        pill.className = `sla-summary-pill sla-summary-pill--${item.key}`;
        pill.style.setProperty("--summary-color", colors[item.key]);

        const label = document.createElement("span");
        label.className = "sla-summary-pill__label";
        label.textContent = STATUS_LABEL[item.key];

        const count = document.createElement("span");
        count.className = "sla-summary-pill__count";
        count.textContent = String(item.count);

        pill.appendChild(label);
        pill.appendChild(count);
        container.appendChild(pill);
    });
}

export interface LegendSwatch {
    label: string;
    color: string;
    kind: "band" | "line";
}

export function renderLegend(container: HTMLElement, swatches: LegendSwatch[], caption: string): void {
    container.replaceChildren();
    container.classList.add("sla-legend");

    const left = document.createElement("div");
    left.className = "sla-legend__items";
    swatches.forEach((swatch) => {
        const item = document.createElement("span");
        item.className = "sla-legend__item";

        if (swatch.kind === "line") {
            const line = document.createElement("span");
            line.className = "sla-legend__line";
            line.style.background = swatch.color;
            item.appendChild(line);
        } else {
            const box = document.createElement("span");
            box.className = "sla-legend__swatch";
            box.style.background = swatch.color;
            item.appendChild(box);
        }

        const text = document.createElement("span");
        text.className = "sla-legend__label";
        text.textContent = swatch.label;
        item.appendChild(text);

        left.appendChild(item);
    });

    const right = document.createElement("div");
    right.className = "sla-legend__caption";
    right.textContent = caption;

    container.appendChild(left);
    container.appendChild(right);
}

export function renderLandingPage(container: HTMLElement, onClear: () => void): void {
    container.replaceChildren();
    container.classList.add("sla-landing");

    const title = document.createElement("h2");
    title.className = "sla-landing__title";
    title.textContent = "SLA Scorecard";

    const subtitle = document.createElement("p");
    subtitle.className = "sla-landing__subtitle";
    subtitle.textContent = "Map data to populate the scorecard.";

    const list = document.createElement("ul");
    list.className = "sla-landing__list";
    const roles = [
        "SLA — name of each SLA (e.g. 'Payment API Uptime')",
        "Category — for the filter pills (e.g. 'Platform', 'Support')",
        "Owner — owner name and initials (e.g. 'Payments', 'PA')",
        "Current, Target — measures for the bullet chart",
        "Time to breach — days until breach (optional)",
        "30D trend — comma-separated 30 numeric values (optional)",
    ];
    roles.forEach((role) => {
        const li = document.createElement("li");
        li.textContent = role;
        list.appendChild(li);
    });

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(list);

    onClear();
}

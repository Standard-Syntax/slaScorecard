/*
 *  SLA Scorecard — Theme + color utilities
 *
 *  Everything in this module is pure: given inputs, it returns outputs.
 *  No DOM mutation, no Power BI host calls. The visual pushes the
 *  resolved theme onto its root element via `applyThemeVariables()`.
 */

import type { ColorHelper } from "powerbi-visuals-utils-colorutils";
import type powerbi from "powerbi-visuals-api";

type IColorPalette = powerbi.extensibility.IColorPalette;
type ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
type ThemeColorName = keyof ISandboxExtendedColorPalette;

export interface ThemeColors {
    foreground: string;
    background: string;
    foregroundSelected: string;
    hyperlink: string;
    good: string;
    neutral: string;
    bad: string;
    textMuted: string;
    border: string;
    rowHover: string;
    headerBg: string;
    legendBg: string;
}

export const FALLBACK_THEME: ThemeColors = {
    foreground: "#111827",
    background: "#FFFFFF",
    foregroundSelected: "#1F2937",
    hyperlink: "#2563EB",
    good: "#16A34A",
    neutral: "#F59E0B",
    bad: "#DC2626",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    rowHover: "#F9FAFB",
    headerBg: "#FFFFFF",
    legendBg: "#FAFAFA",
};

/**
 * Parses a 3- or 6-digit hex color into RGB components.
 * Returns null for malformed input — callers fall back to a default.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleaned = hex.replace("#", "").trim();
    if (cleaned.length !== 6 && cleaned.length !== 3) return null;
    const full = cleaned.length === 3
        ? cleaned.split("").map((c) => c + c).join("")
        : cleaned;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
}

/** Mix `hex` toward white by `ratio` (0 = unchanged, 1 = pure white). */
export function mixWithWhite(hex: string, ratio: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = Math.max(0, Math.min(1, ratio));
    const r = Math.round(rgb.r + (255 - rgb.r) * t);
    const g = Math.round(rgb.g + (255 - rgb.g) * t);
    const b = Math.round(rgb.b + (255 - rgb.b) * t);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Convert a hex color to an `rgba(...)` CSS string with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/** Crude luma test — used to decide a high-contrast target-line color. */
export function isLikelyLight(hex: string): boolean {
    const rgb = hexToRgb(hex);
    if (!rgb) return true;
    const luma = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luma > 0.5;
}

const NUMBER_FORMATTERS: Record<string, Intl.NumberFormat> = {};

export function formatNumber(value: number, suffix: string): string {
    const key = `num-${suffix}`;
    let formatter = NUMBER_FORMATTERS[key];
    if (!formatter) {
        formatter = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        NUMBER_FORMATTERS[key] = formatter;
    }
    return formatter.format(value) + suffix;
}

export function formatPercent(value: number): string {
    return (value * 100).toFixed(2) + "%";
}

interface ReadThemeInput {
    colorPalette: ISandboxExtendedColorPalette;
    colorHelper: ColorHelper;
}

/**
 * Build a `ThemeColors` snapshot from the host palette.
 *
 * Falls back to `FALLBACK_THEME` entries whenever the host palette does
 * not expose a given key. High-contrast mode collapses status colors to
 * the foreground so all three states remain visually distinct.
 */
export function readTheme({ colorPalette, colorHelper }: ReadThemeInput): ThemeColors {
    const palette = colorPalette;
    const isHC = !!colorHelper.isHighContrast;

    const get = (name: ThemeColorName, fallback: string): string => {
        try {
            const c = colorHelper.getThemeColor(name);
            return c || fallback;
        } catch {
            return fallback;
        }
    };

    const foreground = isHC
        ? (palette.foreground?.value ?? FALLBACK_THEME.foreground)
        : get("foreground", FALLBACK_THEME.foreground);

    const background = isHC
        ? (palette.background?.value ?? FALLBACK_THEME.background)
        : get("background", FALLBACK_THEME.background);

    const foregroundSelected =
        palette.foregroundSelected?.value ?? FALLBACK_THEME.foregroundSelected;
    const hyperlink = palette.hyperlink?.value ?? FALLBACK_THEME.hyperlink;

    const good = isHC
        ? foreground
        : (palette.positive?.value ?? get("foreground", FALLBACK_THEME.good));
    const neutral = isHC
        ? foreground
        : (palette.neutral?.value ?? get("foreground", FALLBACK_THEME.neutral));
    const bad = isHC
        ? foreground
        : (palette.negative?.value ?? get("foreground", FALLBACK_THEME.bad));

    const backgroundLight = isHC
        ? background
        : (palette.backgroundLight?.value ?? mixWithWhite(background, 0.4));
    const foregroundNeutralTertiary = isHC
        ? foreground
        : (palette.foregroundNeutralTertiary?.value ?? FALLBACK_THEME.textMuted);

    return {
        foreground,
        background,
        foregroundSelected,
        hyperlink,
        good,
        neutral,
        bad,
        textMuted: foregroundNeutralTertiary,
        border: isHC ? foreground : (palette.foregroundNeutralTertiary?.value ?? FALLBACK_THEME.border),
        rowHover: backgroundLight,
        headerBg: background,
        legendBg: isHC ? background : (palette.backgroundNeutral?.value ?? FALLBACK_THEME.legendBg),
    };
}

/**
 * Push a `ThemeColors` snapshot onto the visual's root element as CSS
 * custom properties. The values drive every color in `style/visual.less`.
 */
export function applyThemeVariables(root: HTMLElement, theme: ThemeColors): void {
    const setVar = (name: string, value: string): void => {
        root.style.setProperty(name, value);
    };

    setVar("--sla-fg", theme.foreground);
    setVar("--sla-bg", theme.background);
    setVar("--sla-fg-selected", theme.foregroundSelected);
    setVar("--sla-hyperlink", theme.hyperlink);
    setVar("--sla-fg-muted", theme.textMuted);
    setVar("--sla-border", theme.border);
    setVar("--sla-row-hover", theme.rowHover);
    setVar("--sla-header-bg", theme.headerBg);
    setVar("--sla-legend-bg", theme.legendBg);

    const toRgbTriplet = (hex: string): string => {
        const rgb = hexToRgb(hex);
        return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : hex;
    };

    setVar("--sla-met", toRgbTriplet(theme.good));
    setVar("--sla-at-risk", toRgbTriplet(theme.neutral));
    setVar("--sla-breached", toRgbTriplet(theme.bad));

    setVar("--sla-met-bg", hexToRgba(theme.good, 0.10));
    setVar("--sla-at-risk-bg", hexToRgba(theme.neutral, 0.12));
    setVar("--sla-breached-bg", hexToRgba(theme.bad, 0.10));

    setVar("--sla-band-bad", mixWithWhite(theme.bad, 0.6));
    setVar("--sla-band-caution", mixWithWhite(theme.neutral, 0.6));
    setVar("--sla-band-target", mixWithWhite(theme.good, 0.6));
    setVar(
        "--sla-target-line",
        isLikelyLight(theme.background) ? "#111827" : "#F9FAFB",
    );
}

/**
 * Read a CSS custom property from the root element with a fallback.
 * Used to pull computed theme values into the legend swatches.
 */
export function readCssVar(root: HTMLElement, name: string, fallback: string): string {
    const v = getComputedStyle(root).getPropertyValue(name);
    return (v && v.trim()) || fallback;
}

export interface ThemeDefaultsSetter {
    setColor: (slot: "metColor" | "atRiskColor" | "breachedColor", value: string) => void;
    setBand: (slot: "badColor" | "cautionColor" | "onTargetColor", value: string) => void;
}

interface ApplyThemeDefaultsInput {
    dataView: powerbi.DataView;
    palette: ISandboxExtendedColorPalette;
    isHighContrast: boolean;
    setter: ThemeDefaultsSetter;
}

/**
 * Resolve a single color slot from the formatting model. If the user has
 * not set it explicitly, populate the model with a host-derived default
 * so the next read returns the theme-aware value.
 */
export function applyThemeDefaultsToModel({
    dataView,
    palette,
    isHighContrast,
    setter,
}: ApplyThemeDefaultsInput): void {
    type UserObjects = powerbi.DataViewObjects | undefined;
    const userObjects: UserObjects = dataView.metadata?.objects;

    const hasObject = (key: string, prop: string): boolean => {
        const obj = userObjects && userObjects[key];
        return !!(obj && (obj as powerbi.DataViewObject)[prop]);
    };

    const themeGood = isHighContrast
        ? palette.foreground?.value
        : (palette.positive?.value ?? palette.getColor("good").value);
    const themeNeutral = isHighContrast
        ? palette.foreground?.value
        : (palette.neutral?.value ?? palette.getColor("neutral").value);
    const themeBad = isHighContrast
        ? palette.foreground?.value
        : (palette.negative?.value ?? palette.getColor("bad").value);

    if (!hasObject("statusColors", "metColor")) setter.setColor("metColor", themeGood);
    if (!hasObject("statusColors", "atRiskColor")) setter.setColor("atRiskColor", themeNeutral);
    if (!hasObject("statusColors", "breachedColor")) setter.setColor("breachedColor", themeBad);

    if (!hasObject("bandColors", "badColor")) setter.setBand("badColor", mixWithWhite(themeBad, 0.6));
    if (!hasObject("bandColors", "cautionColor")) setter.setBand("cautionColor", mixWithWhite(themeNeutral, 0.6));
    if (!hasObject("bandColors", "onTargetColor")) setter.setBand("onTargetColor", mixWithWhite(themeGood, 0.6));
}

// Re-export so consumers do not need a second import for the palette type.
export type { IColorPalette, ISandboxExtendedColorPalette };

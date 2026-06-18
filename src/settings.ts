/*
 *  SLA Scorecard — Format pane settings
 *
 *  Wrapper subclasses below fix a TypeScript constructor-signature regression
 *  in `powerbi-visuals-utils-formattingmodel` v7: each slice class declares
 *  `constructor(object: ColorPicker)` (i.e. an instance of itself), which
 *  rejects the documented object-literal call style. The wrappers widen the
 *  parameter to `Partial<>` so consumers can use the constructor cleanly
 *  while still passing through to the real implementation.
 */

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

// `powerbi.visuals.ValidatorType` is declared as an ambient `const enum`,
// which TypeScript forbids referencing when `isolatedModules` is enabled.
// We cast the literal numeric values through the upstream `Min/MaxValidator`
// types to preserve type safety without needing the enum at compile time.


type ColorSliceOptions = {
    name: string;
    displayName: string;
    value: powerbi.ThemeColorData;
};

type ToggleSliceOptions = {
    name: string;
    displayName: string;
    value: boolean;
};

type NumSliceOptions = {
    name: string;
    displayName: string;
    value: number;
    options?: powerbi.visuals.NumUpDownFormat;
};

class ColorPickerSlice extends formattingSettings.ColorPicker {
    constructor(opts: ColorSliceOptions) {
        // Cast through `unknown` (not `any`) per project type-safety policy;
        // target constructor accepts an instance, but the runtime uses
        // `Object.assign(this, object)` and is satisfied with the literal.
        super(opts as unknown as formattingSettings.ColorPicker);
    }
}

class ToggleSwitchSlice extends formattingSettings.ToggleSwitch {
    constructor(opts: ToggleSliceOptions) {
        super(opts as unknown as formattingSettings.ToggleSwitch);
    }
}

class NumUpDownSlice extends formattingSettings.NumUpDown {
    constructor(opts: NumSliceOptions) {
        super(opts as unknown as formattingSettings.NumUpDown);
    }
}

export const DEFAULT_MET = "#16A34A";
export const DEFAULT_AT_RISK = "#F59E0B";
export const DEFAULT_BREACHED = "#DC2626";
export const DEFAULT_BAD_BAND = "#FECDD3";
export const DEFAULT_CAUTION_BAND = "#FDE68A";
export const DEFAULT_TARGET_BAND = "#BBF7D0";

class StatusColorsCard extends formattingSettings.SimpleCard {
    metColor = new ColorPickerSlice({
        name: "metColor",
        displayName: "Met",
        value: { value: DEFAULT_MET },
    });

    atRiskColor = new ColorPickerSlice({
        name: "atRiskColor",
        displayName: "At risk",
        value: { value: DEFAULT_AT_RISK },
    });

    breachedColor = new ColorPickerSlice({
        name: "breachedColor",
        displayName: "Breached",
        value: { value: DEFAULT_BREACHED },
    });

    override name: string = "statusColors";
    override displayName: string = "Status colors";
    override slices: Array<formattingSettings.Slice> = [
        this.metColor,
        this.atRiskColor,
        this.breachedColor,
    ];
}

class BandColorsCard extends formattingSettings.SimpleCard {
    badColor = new ColorPickerSlice({
        name: "badColor",
        displayName: "Bad range",
        value: { value: DEFAULT_BAD_BAND },
    });

    cautionColor = new ColorPickerSlice({
        name: "cautionColor",
        displayName: "Caution",
        value: { value: DEFAULT_CAUTION_BAND },
    });

    onTargetColor = new ColorPickerSlice({
        name: "onTargetColor",
        displayName: "On target",
        value: { value: DEFAULT_TARGET_BAND },
    });

    override name: string = "bandColors";
    override displayName: string = "Bullet band colors";
    override slices: Array<formattingSettings.Slice> = [
        this.badColor,
        this.cautionColor,
        this.onTargetColor,
    ];
}

class GeneralCard extends formattingSettings.SimpleCard {
    showFilterPills = new ToggleSwitchSlice({
        name: "showFilterPills",
        displayName: "Show category filter pills",
        value: true,
    });

    showSearch = new ToggleSwitchSlice({
        name: "showSearch",
        displayName: "Show search",
        value: true,
    });

    showStatusSummary = new ToggleSwitchSlice({
        name: "showStatusSummary",
        displayName: "Show status summary",
        value: true,
    });

    showLegend = new ToggleSwitchSlice({
        name: "showLegend",
        displayName: "Show legend",
        value: true,
    });

    fontSize = new NumUpDownSlice({
        name: "fontSize",
        displayName: "Text size",
        value: 13,
        options: {
            minValue: {
                type: 0 as powerbi.visuals.MinValidator<number>["type"],
                value: 10,
            },
            maxValue: {
                type: 1 as powerbi.visuals.MaxValidator<number>["type"],
                value: 20,
            },
        },
    });

    override name: string = "general";
    override displayName: string = "General";
    override slices: Array<formattingSettings.Slice> = [
        this.showFilterPills,
        this.showSearch,
        this.showStatusSummary,
        this.showLegend,
        this.fontSize,
    ];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    statusColorsCard = new StatusColorsCard();
    bandColorsCard = new BandColorsCard();
    generalCard = new GeneralCard();

    override cards = [this.statusColorsCard, this.bandColorsCard, this.generalCard];
}

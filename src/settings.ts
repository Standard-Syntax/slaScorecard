/*
 *  SLA Scorecard — Format pane settings
 */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export const DEFAULT_MET = "#16A34A";
export const DEFAULT_AT_RISK = "#F59E0B";
export const DEFAULT_BREACHED = "#DC2626";
export const DEFAULT_BAD_BAND = "#FECDD3";
export const DEFAULT_CAUTION_BAND = "#FDE68A";
export const DEFAULT_TARGET_BAND = "#BBF7D0";

class StatusColorsCard extends FormattingSettingsCard {
    metColor = new formattingSettings.ColorPicker({
        name: "metColor",
        displayName: "Met",
        value: { value: DEFAULT_MET },
    });

    atRiskColor = new formattingSettings.ColorPicker({
        name: "atRiskColor",
        displayName: "At risk",
        value: { value: DEFAULT_AT_RISK },
    });

    breachedColor = new formattingSettings.ColorPicker({
        name: "breachedColor",
        displayName: "Breached",
        value: { value: DEFAULT_BREACHED },
    });

    name: string = "statusColors";
    displayName: string = "Status colors";
    slices: Array<FormattingSettingsSlice> = [this.metColor, this.atRiskColor, this.breachedColor];
}

class BandColorsCard extends FormattingSettingsCard {
    badColor = new formattingSettings.ColorPicker({
        name: "badColor",
        displayName: "Bad range",
        value: { value: DEFAULT_BAD_BAND },
    });

    cautionColor = new formattingSettings.ColorPicker({
        name: "cautionColor",
        displayName: "Caution",
        value: { value: DEFAULT_CAUTION_BAND },
    });

    onTargetColor = new formattingSettings.ColorPicker({
        name: "onTargetColor",
        displayName: "On target",
        value: { value: DEFAULT_TARGET_BAND },
    });

    name: string = "bandColors";
    displayName: string = "Bullet band colors";
    slices: Array<FormattingSettingsSlice> = [this.badColor, this.cautionColor, this.onTargetColor];
}

class GeneralCard extends FormattingSettingsCard {
    showFilterPills = new formattingSettings.ToggleSwitch({
        name: "showFilterPills",
        displayName: "Show category filter pills",
        value: true,
    });

    showSearch = new formattingSettings.ToggleSwitch({
        name: "showSearch",
        displayName: "Show search",
        value: true,
    });

    showStatusSummary = new formattingSettings.ToggleSwitch({
        name: "showStatusSummary",
        displayName: "Show status summary",
        value: true,
    });

    showLegend = new formattingSettings.ToggleSwitch({
        name: "showLegend",
        displayName: "Show legend",
        value: true,
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text size",
        value: 13,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 10 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 },
        },
    });

    name: string = "general";
    displayName: string = "General";
    slices: Array<FormattingSettingsSlice> = [
        this.showFilterPills,
        this.showSearch,
        this.showStatusSummary,
        this.showLegend,
        this.fontSize,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    statusColorsCard = new StatusColorsCard();
    bandColorsCard = new BandColorsCard();
    generalCard = new GeneralCard();

    cards = [this.statusColorsCard, this.bandColorsCard, this.generalCard];
}

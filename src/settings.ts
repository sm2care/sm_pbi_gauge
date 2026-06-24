/**
 * Formatting model — maps every capabilities.json object/property to a
 * typed settings card using powerbi-visuals-utils-formattingmodel.
 * visual.ts reads `settings.<card>.<slice>.value`.
 */
import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import Card = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;

const MIN = powerbi.visuals.ValidatorType.Min;
const MAX = powerbi.visuals.ValidatorType.Max;

const ACCENT = "#4F46E5";
const TARGET_GREY = "#5B5B66";

class ShapeCard extends Card {
    gaugeType = new formattingSettings.ItemDropdown({
        name: "gaugeType",
        displayName: "Gauge type",
        items: [
            { displayName: "Bullet", value: "bullet" },
            { displayName: "Thermometer", value: "thermometer" },
            { displayName: "Radial", value: "radial" },
            { displayName: "Arc (minimal)", value: "arc" },
            { displayName: "Progress ring", value: "progress" }
        ],
        value: { displayName: "Bullet", value: "bullet" }
    });
    sweepAngle = new formattingSettings.NumUpDown({
        name: "sweepAngle", displayName: "Arc sweep angle", value: 270,
        options: { minValue: { value: 90, type: MIN }, maxValue: { value: 360, type: MAX } }
    });
    thickness = new formattingSettings.NumUpDown({
        name: "thickness", displayName: "Arc thickness", value: 18,
        options: { minValue: { value: 4, type: MIN }, maxValue: { value: 48, type: MAX } }
    });
    orientation = new formattingSettings.ItemDropdown({
        name: "orientation", displayName: "Orientation (linear)",
        items: [
            { displayName: "Horizontal", value: "horizontal" },
            { displayName: "Vertical", value: "vertical" }
        ],
        value: { displayName: "Horizontal", value: "horizontal" }
    });
    heroPosition = new formattingSettings.ItemDropdown({
        name: "heroPosition", displayName: "Hero value position",
        items: [
            { displayName: "Center", value: "center" },
            { displayName: "Below", value: "below" },
            { displayName: "None", value: "none" }
        ],
        value: { displayName: "Center", value: "center" }
    });
    adaptiveCollapse = new formattingSettings.ToggleSwitch({ name: "adaptiveCollapse", displayName: "Adaptive collapse", value: true });

    name = "shape";
    displayName = "Shape & Layout";
    slices = [this.gaugeType, this.sweepAngle, this.thickness, this.orientation,
        this.heroPosition, this.adaptiveCollapse];
}

class ValueCard extends Card {
    decimals = new formattingSettings.NumUpDown({
        name: "decimals", displayName: "Decimals", value: 1,
        options: { minValue: { value: 0, type: MIN }, maxValue: { value: 4, type: MAX } }
    });
    formatType = new formattingSettings.ItemDropdown({
        name: "formatType", displayName: "Format type",
        items: [
            { displayName: "Number", value: "number" },
            { displayName: "Currency", value: "currency" },
            { displayName: "Percent", value: "percent" }
        ],
        value: { displayName: "Number", value: "number" }
    });
    displayUnits = new formattingSettings.ItemDropdown({
        name: "displayUnits", displayName: "Display units",
        items: [
            { displayName: "Auto", value: "auto" },
            { displayName: "None", value: "none" },
            { displayName: "Thousands", value: "thousands" },
            { displayName: "Millions", value: "millions" },
            { displayName: "Billions", value: "billions" }
        ],
        value: { displayName: "Auto", value: "auto" }
    });
    currencySymbol = new formattingSettings.TextInput({ name: "currencySymbol", displayName: "Currency symbol", value: "€", placeholder: "€" });
    negativeStyle = new formattingSettings.ItemDropdown({
        name: "negativeStyle", displayName: "Negative style",
        items: [
            { displayName: "Minus sign", value: "sign" },
            { displayName: "Parentheses", value: "parentheses" }
        ],
        value: { displayName: "Minus sign", value: "sign" }
    });
    heroAutoSize = new formattingSettings.ToggleSwitch({ name: "heroAutoSize", displayName: "Auto-size hero", value: true });

    name = "value";
    displayName = "Value";
    slices = [this.formatType, this.displayUnits, this.decimals, this.currencySymbol, this.negativeStyle, this.heroAutoSize];
}

class TargetsCard extends Card {
    showTarget = new formattingSettings.ToggleSwitch({ name: "showTarget", displayName: "Show target", value: true });
    targetMarker = new formattingSettings.ItemDropdown({
        name: "targetMarker", displayName: "Target marker",
        items: [
            { displayName: "Diamond", value: "diamond" },
            { displayName: "Triangle", value: "triangle" },
            { displayName: "Line", value: "line" }
        ],
        value: { displayName: "Diamond", value: "diamond" }
    });
    targetColor = new formattingSettings.ColorPicker({ name: "targetColor", displayName: "Target color", value: { value: TARGET_GREY } });

    name = "targets";
    displayName = "Target";
    slices = [this.showTarget, this.targetMarker, this.targetColor];
}

class ColorsCard extends Card {
    mode = new formattingSettings.ItemDropdown({
        name: "mode", displayName: "Modalità colore",
        items: [
            { displayName: "Tinta unica", value: "single" },
            { displayName: "Per obiettivo (automatico)", value: "target" },
            { displayName: "A soglie", value: "thresholds" }
        ],
        value: { displayName: "Tinta unica", value: "single" }
    });
    mainColor = new formattingSettings.ColorPicker({ name: "mainColor", displayName: "Colore principale", value: { value: ACCENT } });
    trackColor = new formattingSettings.ColorPicker({ name: "trackColor", displayName: "Colore traccia", value: { value: "#E8E8ED" } });
    t1 = new formattingSettings.NumUpDown({
        name: "t1", displayName: "Soglia 1 (%)", value: 60,
        options: { minValue: { value: 0, type: MIN }, maxValue: { value: 100, type: MAX } }
    });
    c1 = new formattingSettings.ColorPicker({ name: "c1", displayName: "Colore sotto soglia 1", value: { value: "#EF4444" } });
    t2 = new formattingSettings.NumUpDown({
        name: "t2", displayName: "Soglia 2 (%)", value: 90,
        options: { minValue: { value: 0, type: MIN }, maxValue: { value: 100, type: MAX } }
    });
    c2 = new formattingSettings.ColorPicker({ name: "c2", displayName: "Colore tra le soglie", value: { value: "#F59E0B" } });
    c3 = new formattingSettings.ColorPicker({ name: "c3", displayName: "Colore sopra soglia 2", value: { value: "#22C55E" } });
    applyToValue = new formattingSettings.ToggleSwitch({ name: "applyToValue", displayName: "Applica colore al valore", value: true });
    showBands = new formattingSettings.ToggleSwitch({ name: "showBands", displayName: "Mostra fasce sulla traccia", value: true });

    name = "colors";
    displayName = "Soglie e Colori";
    slices = [this.mode, this.mainColor, this.trackColor, this.t1, this.c1, this.t2, this.c2, this.c3, this.applyToValue, this.showBands];
}

class ThemeCard extends Card {
    mode = new formattingSettings.ItemDropdown({
        name: "mode", displayName: "Theme mode",
        items: [
            { displayName: "Auto", value: "auto" },
            { displayName: "Light", value: "light" },
            { displayName: "Dark", value: "dark" }
        ],
        value: { displayName: "Auto", value: "auto" }
    });
    arcGradient = new formattingSettings.ToggleSwitch({ name: "arcGradient", displayName: "Arc gradient", value: true });
    glass = new formattingSettings.ToggleSwitch({ name: "glass", displayName: "Glass effect", value: true });
    elevation = new formattingSettings.NumUpDown({
        name: "elevation", displayName: "Elevation level", value: 2,
        options: { minValue: { value: 0, type: MIN }, maxValue: { value: 3, type: MAX } }
    });

    name = "theme";
    displayName = "Tema & Aspetto";
    slices = [this.mode, this.arcGradient, this.glass, this.elevation];
}

class TypographyCard extends Card {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font family", value: "wf_standard-font, helvetica, arial, sans-serif" });
    tabularNumbers = new formattingSettings.ToggleSwitch({ name: "tabularNumbers", displayName: "Tabular numbers", value: true });

    name = "typography";
    displayName = "Typography";
    slices = [this.fontFamily, this.tabularNumbers];
}

class AnimationCard extends Card {
    enabled = new formattingSettings.ToggleSwitch({ name: "enabled", displayName: "Enable animations", value: true });
    loadStyle = new formattingSettings.ItemDropdown({
        name: "loadStyle", displayName: "Load animation",
        items: [
            { displayName: "Fill + count", value: "fillcount" },
            { displayName: "Fade", value: "fade" },
            { displayName: "None", value: "none" }
        ],
        value: { displayName: "Fill + count", value: "fillcount" }
    });
    duration = new formattingSettings.NumUpDown({
        name: "duration", displayName: "Duration (ms)", value: 800,
        options: { minValue: { value: 0, type: MIN }, maxValue: { value: 1200, type: MAX } }
    });

    name = "animation";
    displayName = "Animation";
    slices = [this.enabled, this.loadStyle, this.duration];
}

export class GaugeSettings extends Model {
    shape = new ShapeCard();
    value = new ValueCard();
    targets = new TargetsCard();
    colors = new ColorsCard();
    theme = new ThemeCard();
    typography = new TypographyCard();
    animation = new AnimationCard();

    cards = [this.shape, this.value, this.targets, this.colors,
        this.theme, this.typography, this.animation];
}

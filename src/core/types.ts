/**
 * Shared types: the unified data model that feeds every shape,
 * and the resolved render context handed to the engines.
 */
import { ThemeTokens, SemanticColors } from "./tokens";

export type GaugeType = "bullet" | "thermometer" | "radial" | "arc" | "progress";
export type SemanticState = "positive" | "warning" | "negative" | "neutral";

export interface ThresholdStop {
    /** fraction of the scale [0..1] where this band ends */
    at: number;
    color: string;
    label?: string;
}

/** The unified data model — produced by model.ts, consumed by engines. */
export interface GaugeModel {
    value: number | null;
    target: number | null;
    min: number;
    max: number;

    // derived
    hasValue: boolean;
    achievement: number | null; // value / target
    variance: number | null;    // value - target
    state: SemanticState;
    zeroCross: boolean;         // min < 0 < max
    overflow: boolean;          // value > max
    underflow: boolean;         // value < min
    /** clamped value used for geometry */
    valueClamped: number;
    /** normalized position of value on the scale [0..1] */
    valuePos: number;
    /** normalized position of zero on the scale [0..1] */
    zeroPos: number;
    targetPos: number | null;
}

export interface ResolvedColors {
    theme: ThemeTokens;
    semantic: SemanticColors;
    accent: string;
    accentSoft: string;
    track: string;
    valueFill: string; // resolved fill color for the value bar/arc
}

export interface RenderContext {
    width: number;
    height: number;
    model: GaugeModel;
    colors: ResolvedColors;
    thresholds: ThresholdStop[];
    /** call to format a raw value into a display string */
    fmt: (v: number | null, compact?: boolean) => string;
    /** call to format a percent (0.12 -> "+12%") */
    fmtPct: (v: number | null, signed?: boolean) => string;
    animate: boolean;
    reducedMotion: boolean;
    durationMs: number;
}

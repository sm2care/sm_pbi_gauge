/**
 * Builds the unified GaugeModel from a Power BI categorical DataView,
 * computing every derivation (achievement, variance, state,
 * zero-crossing, overflow/underflow and normalized positions).
 */
import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import { GaugeModel, SemanticState, ThresholdStop } from "./types";

interface RawValues {
    value: number | null;
    target: number | null;
    min: number | null;
    max: number | null;
}

function firstNumber(v: powerbi.PrimitiveValue | undefined): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return isNaN(n) ? null : n;
}

/** Pull each role's last value out of the categorical values array. */
export function readDataView(dataView: DataView | undefined): RawValues {
    const empty: RawValues = {
        value: null, target: null, min: null, max: null
    };
    const cat = dataView?.categorical;
    if (!cat || !cat.values) return empty;

    const out: RawValues = { ...empty };

    for (const col of cat.values) {
        const roles = col.source.roles || {};
        const lastIdx = col.values.length - 1;
        const last = firstNumber(col.values[lastIdx]);

        if (roles["value"]) out.value = last;
        else if (roles["target"]) out.target = last;
        else if (roles["minValue"]) out.min = last;
        else if (roles["maxValue"]) out.max = last;
    }
    return out;
}

export interface ScaleHints {
    /** when no Min role: 0, or the natural min if data is negative */
    autoMinFromZero: boolean;
}

export function buildModel(
    raw: RawValues,
    thresholds: ThresholdStop[]
): GaugeModel {
    const hasValue = raw.value !== null;
    const value = raw.value ?? 0;

    // ---- scale bounds -------------------------------------------------
    const candidates = [raw.value, raw.target]
        .filter((x): x is number => x !== null);
    const dataMin = candidates.length ? Math.min(...candidates) : 0;
    const dataMax = candidates.length ? Math.max(...candidates) : 1;

    let min = raw.min;
    let max = raw.max;

    if (min === null) {
        // include zero unless data is entirely above it; give negatives room
        min = dataMin < 0 ? niceFloor(dataMin) : 0;
    }
    if (max === null) {
        const base = raw.target !== null ? Math.max(raw.target, dataMax) : dataMax;
        max = niceCeil(base > 0 ? base * 1.15 : base === 0 ? 1 : base * 0.85);
    }
    if (max <= min) max = min + 1;

    const span = max - min;
    const norm = (v: number) => clamp01((v - min) / span);

    // ---- derivations --------------------------------------------------
    const achievement =
        raw.target !== null && raw.target !== 0 ? value / raw.target : null;
    const variance = raw.target !== null ? value - raw.target : null;

    const valueClamped = Math.max(min, Math.min(max, value));

    const state = resolveState(value, min, max, raw.target, thresholds, hasValue);

    return {
        value: hasValue ? value : null,
        target: raw.target,
        min, max,
        hasValue,
        achievement,
        variance,
        state,
        zeroCross: min < 0 && max > 0,
        overflow: value > max,
        underflow: value < min,
        valueClamped,
        valuePos: norm(valueClamped),
        zeroPos: norm(Math.max(min, Math.min(max, 0))),
        targetPos: raw.target !== null ? norm(raw.target) : null
    };
}

function resolveState(
    value: number,
    min: number,
    max: number,
    target: number | null,
    thresholds: ThresholdStop[],
    hasValue: boolean
): SemanticState {
    if (!hasValue) return "neutral";

    // Threshold bands take precedence when defined.
    if (thresholds.length) {
        const pos = (value - min) / (max - min);
        let idx = thresholds.length - 1;
        for (let i = 0; i < thresholds.length; i++) {
            if (pos <= thresholds[i].at) { idx = i; break; }
        }
        const ratio = idx / Math.max(1, thresholds.length - 1);
        return ratio < 0.34 ? "negative" : ratio < 0.67 ? "warning" : "positive";
    }

    // Otherwise: relative to target if present, else sign.
    if (target !== null) {
        return value >= target ? "positive" : value >= target * 0.9 ? "warning" : "negative";
    }
    return value >= 0 ? "positive" : "negative";
}

// ---- nice-number helpers ---------------------------------------------
function niceCeil(v: number): number {
    if (v === 0) return 0;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
    return Math.ceil(v / mag) * mag;
}
function niceFloor(v: number): number {
    if (v === 0) return 0;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
    return Math.floor(v / mag) * mag;
}
function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

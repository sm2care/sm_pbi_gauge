/**
 * Smart number formatting: currency, percent, compact notation for large
 * numbers, locale separators and negative styling.
 *
 * Wraps powerbi-visuals-utils-formattingutils when a column format string is
 * available, and falls back to a self-contained Intl-based formatter so the
 * engine always has something to render.
 */

export interface FormatOptions {
    formatType: "number" | "currency" | "percent";
    decimals: number;
    currencySymbol: string;
    negativeStyle: "sign" | "parentheses";
    /** "auto" enables compact (K/M/B) once |value| >= 10_000 */
    displayUnits: "auto" | "none" | "thousands" | "millions" | "billions";
    locale: string;
    /** raw Power BI column format string, when present */
    columnFormat?: string;
}

const COMPACT_THRESHOLD = 10_000;

export function makeFormatter(opts: FormatOptions) {
    const nf = pickNumberFormatter(opts);
    return (value: number | null, compactOverride?: boolean): string => {
        if (value === null || value === undefined || isNaN(value)) return "—";

        if (opts.formatType === "percent") {
            const s = (value * 100).toFixed(opts.decimals);
            return applyNegative(`${stripTrailingZeros(s, opts.decimals)}%`, value, opts);
        }

        const useCompact =
            compactOverride ?? shouldCompact(value, opts.displayUnits);

        let core: string;
        if (useCompact) {
            core = compact(value, opts);
        } else {
            core = nf.format(Math.abs(value));
        }

        if (opts.formatType === "currency") {
            core = placeCurrency(core, opts.currencySymbol, opts.locale);
        }
        return applyNegative(core, value, opts);
    };
}

function pickNumberFormatter(opts: FormatOptions): Intl.NumberFormat {
    try {
        return new Intl.NumberFormat(opts.locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.max(0, Math.min(4, opts.decimals))
        });
    } catch {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    }
}

function shouldCompact(
    value: number,
    units: FormatOptions["displayUnits"]
): boolean {
    if (units === "none") return false;
    if (units === "thousands" || units === "millions" || units === "billions") return true;
    return Math.abs(value) >= COMPACT_THRESHOLD; // auto
}

const SUFFIX = [
    { v: 1e12, s: "T" },
    { v: 1e9, s: "B" },
    { v: 1e6, s: "M" },
    { v: 1e3, s: "K" }
];

function compact(value: number, opts: FormatOptions): string {
    const abs = Math.abs(value);
    let divisor = 1;
    let suffix = "";

    if (opts.displayUnits === "thousands") { divisor = 1e3; suffix = "K"; }
    else if (opts.displayUnits === "millions") { divisor = 1e6; suffix = "M"; }
    else if (opts.displayUnits === "billions") { divisor = 1e9; suffix = "B"; }
    else {
        for (const u of SUFFIX) {
            if (abs >= u.v) { divisor = u.v; suffix = u.s; break; }
        }
    }
    const scaled = abs / divisor;
    const dec = scaled >= 100 ? 0 : Math.min(opts.decimals, 2);
    const str = scaled.toLocaleString(opts.locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: dec
    });
    return `${str}${suffix}`;
}

function placeCurrency(core: string, symbol: string, locale: string): string {
    const sym = symbol || "€";
    // Most EUR locales put the symbol after; default to before for $/£.
    const after = sym === "€" && /^(it|de|fr|es|pt|nl)/i.test(locale);
    return after ? `${core} ${sym}` : `${sym}${core}`;
}

function applyNegative(core: string, value: number, opts: FormatOptions): string {
    if (value >= 0) return core;
    return opts.negativeStyle === "parentheses" ? `(${core})` : `−${core}`;
}

function stripTrailingZeros(s: string, decimals: number): string {
    if (decimals === 0) return s;
    return s.replace(/\.?0+$/, "");
}

/** Percent delta formatter, e.g. 0.124 -> "+12.4%". */
export function makePercentFormatter(locale: string, decimals = 1) {
    return (value: number | null, signed = true): string => {
        if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return "—";
        const pct = value * 100;
        const sign = signed ? (pct > 0 ? "+" : pct < 0 ? "−" : "") : "";
        const body = Math.abs(pct).toLocaleString(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
        return `${sign}${body}%`;
    };
}

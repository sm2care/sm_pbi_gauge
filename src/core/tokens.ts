/**
 * Design tokens for SM2 Executive Gauge.
 * One source of truth shared by every shape/engine. Light + dark variants.
 * Values mirror the Phase-2 design spec.
 */

export interface ThemeTokens {
    name: "light" | "dark";
    bgCanvas: string;
    bgSurface: string;
    bgSubtle: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    hairline: string;
    track: string;
    glassBg: string;
    glassBorder: string;
    /** drop-shadow stack for the card, by elevation level 0..3 */
    elevation: string[];
}

export interface SemanticColors {
    positive: string;
    positiveSoft: string;
    positiveStrong: string;
    warning: string;
    warningSoft: string;
    negative: string;
    negativeSoft: string;
    negativeStrong: string;
}

export const LIGHT: ThemeTokens = {
    name: "light",
    bgCanvas: "#FFFFFF",
    bgSurface: "#FBFBFD",
    bgSubtle: "#F4F4F7",
    textPrimary: "#0B0B0F",
    textSecondary: "#5B5B66",
    textTertiary: "#9A9AA5",
    hairline: "#E8E8ED",
    track: "#E8E8ED",
    glassBg: "rgba(255,255,255,0.62)",
    glassBorder: "rgba(255,255,255,0.18)",
    elevation: [
        "none",
        "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
        "0 4px 8px rgba(16,24,40,0.06), 0 2px 4px rgba(16,24,40,0.06)",
        "0 12px 24px rgba(16,24,40,0.08), 0 4px 8px rgba(16,24,40,0.04)"
    ]
};

export const DARK: ThemeTokens = {
    name: "dark",
    bgCanvas: "#0E1116",
    bgSurface: "#161B22",
    bgSubtle: "#1C222B",
    textPrimary: "#F2F3F5",
    textSecondary: "#A8B0BA",
    textTertiary: "#6B7480",
    hairline: "#2A313B",
    track: "#2A313B",
    glassBg: "rgba(22,27,34,0.55)",
    glassBorder: "rgba(255,255,255,0.10)",
    elevation: [
        "none",
        "0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.40)",
        "0 0 0 1px rgba(255,255,255,0.06), 0 6px 16px rgba(0,0,0,0.45)",
        "0 0 0 1px rgba(255,255,255,0.08), 0 14px 30px rgba(0,0,0,0.55)"
    ]
};

export const SEMANTIC_DEFAULT: SemanticColors = {
    positive: "#22C55E",
    positiveSoft: "#86EFAC",
    positiveStrong: "#15803D",
    warning: "#F59E0B",
    warningSoft: "#FCD34D",
    negative: "#EF4444",
    negativeSoft: "#FCA5A5",
    negativeStrong: "#B91C1C"
};

export const RADIUS = { xs: 6, sm: 10, md: 14, lg: 18, full: 9999 };
export const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32 };

export const MOTION = {
    easeOutExpo: "cubic-bezier(0.16,1,0.3,1)",
    standard: "cubic-bezier(0.4,0,0.2,1)",
    durFast: 150,
    durBase: 300,
    durSlow: 500,
    durLoad: 800,
    staggerSegment: 40
};

export const ACCENT_DEFAULT = "#4F46E5";
export const ACCENT_SOFT_DEFAULT = "#A5B4FC";

/** Decide light vs dark from the host background luminance. */
export function pickTheme(mode: "auto" | "light" | "dark", hostBackground?: string): ThemeTokens {
    if (mode === "light") return LIGHT;
    if (mode === "dark") return DARK;
    // auto: inspect host background luminance
    const lum = relativeLuminance(hostBackground || "#FFFFFF");
    return lum < 0.4 ? DARK : LIGHT;
}

export function relativeLuminance(hex: string): number {
    const c = parseHex(hex);
    if (!c) return 1;
    const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
    if (!hex) return null;
    let h = hex.trim().replace("#", "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Mix two hex colors; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
    const ca = parseHex(a), cb = parseHex(b);
    if (!ca || !cb) return a;
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

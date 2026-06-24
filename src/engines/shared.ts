/**
 * Helpers shared by the Arc and Linear engines:
 * semantic color resolution, threshold band colors and easing.
 */
import { easeExpOut } from "d3-ease";
import { RenderContext } from "../core/types";

/** One color per threshold band, low → high. */
export function bandColors(ctx: RenderContext): string[] {
    if (ctx.thresholds.length) return ctx.thresholds.map((t) => t.color);
    return [ctx.colors.semantic.negative, ctx.colors.semantic.warning, ctx.colors.semantic.positive];
}

/** d3 ease function used by transitions; expo-out matches the spec. */
export function easeName() {
    return easeExpOut;
}

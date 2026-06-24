/**
 * ArcEngine — renders Radial (270°), Arc minimal (~110°) and Progress (360°).
 * One arc generator; the three shapes differ only by sweep angle and thickness.
 */
import { Selection } from "d3-selection";
import "d3-transition";
import { arc as d3arc } from "d3-shape";
import { interpolate } from "d3-interpolate";
import { RenderContext } from "../core/types";
import { mix } from "../core/tokens";
import { bandColors, easeName } from "./shared";

type G = Selection<SVGGElement, unknown, null, undefined>;

export interface ArcOptions {
    sweepDeg: number;   // total angular span
    thickness: number;
    showBands?: boolean;
}

const DEG = Math.PI / 180;

export function renderArc(g: G, ctx: RenderContext, opts: ArcOptions): void {
    const { width, height, model, colors } = ctx;
    g.selectAll("*").remove();

    const sweep = clamp(opts.sweepDeg, 60, 360);
    // center the arc; opening points down for sub-360 sweeps
    const start = -sweep / 2 * DEG;
    const end = sweep / 2 * DEG;

    const cx = width / 2;
    // for partial arcs, nudge the center down so the open bottom is balanced
    const cy = sweep >= 350 ? height / 2 : height * 0.58;
    const radius = Math.max(8, Math.min(width, height) / 2 - opts.thickness - 6);
    const thick = clamp(opts.thickness, 4, radius);

    g.attr("transform", `translate(${cx},${cy})`);

    const angleAt = (p: number) => start + (end - start) * clamp(p, 0, 1);

    const makeArc = (a0: number, a1: number) =>
        d3arc()({
            innerRadius: radius - thick,
            outerRadius: radius,
            startAngle: a0,
            endAngle: a1,
            cornerRadius: thick / 2
        } as any) ?? "";

    // ---- track --------------------------------------------------------
    g.append("path")
        .attr("d", makeArc(start, end))
        .attr("fill", colors.track)
        .attr("opacity", 0.55);

    // ---- threshold bands ---------------------------------------------
    if (opts.showBands && ctx.thresholds.length) {
        const cols = bandColors(ctx);
        let from = 0;
        ctx.thresholds.forEach((t, i) => {
            g.append("path")
                .attr("d", makeArc(angleAt(from), angleAt(t.at)))
                .attr("fill", cols[i] ?? colors.track)
                .attr("opacity", 0.16);
            from = t.at;
        });
    }

    // ---- value arc ----------------------------------------------------
    const sc = colors.valueFill;
    const fill = colors.theme.name === "dark" ? mix(sc, "#FFFFFF", 0.08) : sc;
    const a0 = angleAt(model.zeroCross ? model.zeroPos : 0);
    const aTarget = angleAt(model.valuePos);

    const valuePath = g.append("path")
        .attr("fill", fill)
        .attr("filter", model.overflow ? "url(#sm2-glow)" : null);

    const animate = ctx.animate && !ctx.reducedMotion && ctx.durationMs > 0;
    if (animate) {
        valuePath.transition().duration(ctx.durationMs).ease(easeName())
            .attrTween("d", () => {
                const i = interpolate(a0, aTarget);
                return (tt: number) => makeArc(Math.min(a0, i(tt)), Math.max(a0, i(tt)));
            });
    } else {
        valuePath.attr("d", makeArc(Math.min(a0, aTarget), Math.max(a0, aTarget)));
    }

    // ---- progress overflow ring (value > max on a 360 ring) ----------
    if (model.overflow && sweep >= 350) {
        g.append("path")
            .attr("d", makeArc(start, end))
            .attr("fill", "none");
        g.append("path")
            .attr("d", makeArc(start, angleAt((model.value! - model.max) / (model.max - model.min))))
            .attr("fill", colors.semantic.positiveStrong)
            .attr("opacity", 0.9);
    }

    // ---- target marker (radial tick) ---------------------------------
    if (model.targetPos !== null) {
        tick(g, angleAt(model.targetPos), radius, thick, colors.theme.textSecondary, 2.5);
    }
}

function tick(g: G, angle: number, radius: number, thick: number, color: string, w: number) {
    // angle is measured from 12 o'clock; convert to screen coords
    const a = angle - Math.PI / 2;
    const r0 = radius - thick - 2;
    const r1 = radius + 2;
    g.append("line")
        .attr("x1", Math.cos(a) * r0).attr("y1", Math.sin(a) * r0)
        .attr("x2", Math.cos(a) * r1).attr("y2", Math.sin(a) * r1)
        .attr("stroke", color).attr("stroke-width", w).attr("stroke-linecap", "round");
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

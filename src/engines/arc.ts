/**
 * ArcEngine — renders Radial (semicircle/270°), Arc minimal (~110°) and
 * Progress (360°). One arc generator; the shapes differ by sweep + thickness.
 * The arc is sized to fill the container width first (capped by height) so it
 * stays large in wide widgets, never overflowing into the title above.
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
    showScaleLabels?: boolean;
    showTarget?: boolean;
    showTargetLabel?: boolean;
    targetMarker?: "diamond" | "triangle" | "line";
    targetColor?: string;
}

const DEG = Math.PI / 180;

export function renderArc(g: G, ctx: RenderContext, opts: ArcOptions): void {
    const { width, height, model, colors } = ctx;
    g.selectAll("*").remove();

    const sweep = clamp(opts.sweepDeg, 60, 360);
    const half = sweep / 2;
    const start = -half * DEG;
    const end = half * DEG;

    // ---- geometry: fit the arc's true bounding box into the box --------
    // Extents (in units of radius) of an arc opening downward, center at 0.
    //   point(θ) = (sinθ·r, -cosθ·r),  θ ∈ [-half, +half]
    const halfRad = half * DEG;
    const xUnit = sweep >= 180 ? 1 : Math.sin(halfRad);          // half-width
    const topUnit = 1;                                            // always r above
    const botUnit = Math.max(0, -Math.cos(halfRad));             // below center

    const isFull = sweep >= 350;
    const labelFont = clamp(Math.min(width, height) * 0.045, 10, 15);
    const labelReserve = opts.showScaleLabels && !isFull ? labelFont * 1.9 + 6 : 6;
    const marginTop = 8;
    const marginSide = 6;
    // target leader needs a little air on the sides
    const sidePad = opts.showTarget && model.targetPos !== null ? labelFont * 2.4 : marginSide;

    // width-first: use as much horizontal room as possible…
    const rW = (width - 2 * sidePad) / (2 * xUnit);
    // …capped so the arc + label band fit vertically.
    const rHbow = (height - marginTop - labelReserve) / (topUnit + botUnit);
    const radius = Math.max(8, Math.min(rW, rHbow));

    const thick = clamp(opts.thickness, 4, radius - 2);

    const cx = width / 2;
    const cy = isFull ? height / 2 : marginTop + radius;

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
        .attr("opacity", 0.9);

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
    // fill origin: the zero line when the scale crosses zero (negative min),
    // otherwise the scale start.
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
    if (model.overflow && isFull) {
        g.append("path")
            .attr("d", makeArc(start, angleAt((model.value! - model.max) / (model.max - model.min))))
            .attr("fill", colors.semantic.positiveStrong)
            .attr("opacity", 0.9);
    }

    // ---- target marker + leader label --------------------------------
    if (opts.showTarget && model.targetPos !== null) {
        const tColor = opts.targetColor || colors.theme.textSecondary;
        const ang = angleAt(model.targetPos);
        targetMark(g, ang, radius, thick, tColor, opts.targetMarker || "line");
        if (opts.showTargetLabel) {
            leaderLabel(g, ang, radius, tColor, labelFont,
                ctx.fmt(model.target), colors.theme.bgSurface);
        }
    }

    // ---- min / max scale labels --------------------------------------
    if (opts.showScaleLabels && !isFull) {
        endpointLabel(g, start, radius, labelFont, colors.theme.textTertiary,
            ctx.fmt(model.min), "start");
        endpointLabel(g, end, radius, labelFont, colors.theme.textTertiary,
            ctx.fmt(model.max), "end");
    }

    // ---- hero anchor: optical center of the bowl ---------------------
    // Centre the value within the open bowl (a touch below the geometric
    // mid-radius reads best), horizontally on the arc's center axis.
    const anchorY = isFull ? cy : cy - radius * 0.34;
    ctx.heroAnchorPct = { x: 50, y: clamp(anchorY / height * 100, 5, 95) };
}

/** Convert an arc angle (from 12 o'clock, clockwise) to screen coords on a
 *  circle of the given radius, centered at the (already translated) origin. */
function pointAt(angle: number, r: number): [number, number] {
    const a = angle - Math.PI / 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
}

function targetMark(
    g: G, angle: number, radius: number, thick: number,
    color: string, marker: "diamond" | "triangle" | "line"
): void {
    const a = angle - Math.PI / 2;
    const rMid = radius - thick / 2;
    const [mx, my] = [Math.cos(a) * rMid, Math.sin(a) * rMid];

    if (marker === "line") {
        const r0 = radius - thick - 2;
        const r1 = radius + 2;
        g.append("line")
            .attr("x1", Math.cos(a) * r0).attr("y1", Math.sin(a) * r0)
            .attr("x2", Math.cos(a) * r1).attr("y2", Math.sin(a) * r1)
            .attr("stroke", color).attr("stroke-width", 2.5).attr("stroke-linecap", "round");
        return;
    }

    const s = Math.max(5, thick * 0.42); // marker half-size
    const rot = (a * 180) / Math.PI + 90; // align with the radial direction
    const shape = marker === "triangle"
        ? `M0,${-s} L${s},${s} L${-s},${s} Z`
        : `M0,${-s} L${s},0 L0,${s} L${-s},0 Z`; // diamond
    g.append("path")
        .attr("d", shape)
        .attr("transform", `translate(${mx},${my}) rotate(${rot})`)
        .attr("fill", color);
}

/** A short radial leader from the arc outward to a value label. */
function leaderLabel(
    g: G, angle: number, radius: number, color: string,
    font: number, text: string, haloColor: string
): void {
    const a = angle - Math.PI / 2;
    const r0 = radius + 3;
    const r1 = radius + Math.max(14, font * 1.3);
    const [x0, y0] = [Math.cos(a) * r0, Math.sin(a) * r0];
    const [x1, y1] = [Math.cos(a) * r1, Math.sin(a) * r1];

    g.append("line")
        .attr("x1", x0).attr("y1", y0).attr("x2", x1).attr("y2", y1)
        .attr("stroke", color).attr("stroke-width", 1.5);

    const cosA = Math.cos(a);
    const anchor = cosA > 0.2 ? "start" : cosA < -0.2 ? "end" : "middle";
    const dx = cosA > 0.2 ? 4 : cosA < -0.2 ? -4 : 0;
    const tx = x1 + dx;
    const ty = y1 + (Math.sin(a) >= 0 ? font * 0.9 : -font * 0.2);

    appendText(g, tx, ty, text, anchor, font, color, haloColor, 700);
}

/** Min/max label sitting just below an arc endpoint. */
function endpointLabel(
    g: G, angle: number, radius: number, font: number,
    color: string, text: string, anchor: "start" | "end"
): void {
    const [x, y] = pointAt(angle, radius);
    appendText(g, x, y + font * 1.25, text, anchor, font, color, "", 500);
}

function appendText(
    g: G, x: number, y: number, text: string, anchor: string,
    font: number, color: string, halo: string, weight: number
): void {
    const t = g.append("text")
        .attr("x", x).attr("y", y)
        .attr("text-anchor", anchor)
        .attr("dominant-baseline", "middle")
        .attr("font-size", font)
        .attr("font-weight", weight)
        .attr("fill", color)
        .text(text);
    if (halo) {
        t.attr("stroke", halo).attr("stroke-width", 3)
            .attr("paint-order", "stroke").attr("stroke-linejoin", "round");
    }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

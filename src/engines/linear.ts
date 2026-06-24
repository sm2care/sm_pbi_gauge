/**
 * LinearEngine — renders Bullet (horizontal) and Thermometer (vertical).
 * Both share one scale; orientation flips the axis. Zero-crossing aware:
 * the value bar grows from the zero anchor in either direction.
 */
import { Selection } from "d3-selection";
import "d3-transition";
import { RenderContext } from "../core/types";
import { mix } from "../core/tokens";
import { bandColors, easeName } from "./shared";

type G = Selection<SVGGElement, unknown, null, undefined>;

export interface LinearOptions {
    vertical: boolean;
    thickness: number;
    showBands: boolean;
}

export function renderLinear(g: G, ctx: RenderContext, opts: LinearOptions): void {
    const { width, height, model, colors } = ctx;
    g.selectAll("*").remove();

    const pad = 10;
    const thick = clamp(opts.thickness, 10, opts.vertical ? width * 0.5 : height * 0.45);

    // axis geometry: a -> start (min), b -> end (max)
    const geom = opts.vertical
        ? { a: height - pad, b: pad, cross: width / 2, len: height - pad * 2 }
        : { a: pad, b: width - pad, cross: height / 2, len: width - pad * 2 };

    const pos = (p: number) => geom.a + (geom.b - geom.a) * p; // p in [0..1]

    // ---- track --------------------------------------------------------
    rect(g, opts, geom.cross, thick, pos(0), pos(1))
        .attr("rx", thick / 2)
        .attr("fill", colors.track)
        .attr("opacity", 0.55);

    // ---- threshold bands ---------------------------------------------
    if (opts.showBands && ctx.thresholds.length) {
        const cols = bandColors(ctx);
        let from = 0;
        ctx.thresholds.forEach((t, i) => {
            rect(g, opts, geom.cross, thick, pos(from), pos(t.at))
                .attr("rx", thick / 2)
                .attr("fill", cols[i] ?? colors.track)
                .attr("opacity", 0.18);
            from = t.at;
        });
    }

    // ---- value bar (zero-anchored) -----------------------------------
    const sc = colors.valueFill;
    const from = model.zeroPos;
    const to = model.valuePos;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);

    const barThick = thick - 4;
    const animate = ctx.animate && !ctx.reducedMotion && ctx.durationMs > 0;

    // start collapsed at the zero anchor, then grow to the value
    const bar = rect(g, opts, geom.cross, barThick, pos(from), pos(from))
        .attr("rx", barThick / 2)
        .attr("fill", colors.theme.name === "dark" ? mix(sc, "#FFFFFF", 0.08) : sc)
        .attr("filter", model.overflow ? "url(#sm2-glow)" : null);

    if (animate) {
        bar.transition().duration(ctx.durationMs).ease(easeName())
            .call((tr: any) => { setSpan(tr, opts, geom.cross, barThick, pos(lo), pos(hi)); });
    } else {
        setSpanImmediate(bar, opts, geom.cross, barThick, pos(lo), pos(hi));
    }

    // ---- zero baseline (only meaningful when crossing) ---------------
    if (model.zeroCross) {
        line(g, opts, geom.cross, thick + 6, pos(model.zeroPos))
            .attr("stroke", colors.theme.textTertiary)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2 2");
    }

    // ---- target marker (solid) ---------------------------------------
    if (model.targetPos !== null) {
        marker(g, opts, geom.cross, thick + 12, pos(model.targetPos))
            .attr("stroke", colors.theme.textSecondary)
            .attr("stroke-width", 2);
    }
}

// ---- primitive helpers ------------------------------------------------
function rect(g: G, o: LinearOptions, cross: number, thick: number, p0: number, p1: number) {
    const r = g.append("rect");
    return setSpanImmediate(r, o, cross, thick, p0, p1);
}

function setSpanImmediate(sel: any, o: LinearOptions, cross: number, thick: number, p0: number, p1: number) {
    const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
    if (o.vertical) {
        return sel.attr("x", cross - thick / 2).attr("width", thick)
            .attr("y", lo).attr("height", Math.max(0, hi - lo));
    }
    return sel.attr("y", cross - thick / 2).attr("height", thick)
        .attr("x", lo).attr("width", Math.max(0, hi - lo));
}

function setSpan(tr: any, o: LinearOptions, cross: number, thick: number, p0: number, p1: number) {
    const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
    if (o.vertical) {
        return tr.attr("y", lo).attr("height", Math.max(0, hi - lo));
    }
    return tr.attr("x", lo).attr("width", Math.max(0, hi - lo));
}

function line(g: G, o: LinearOptions, cross: number, span: number, p: number) {
    const l = g.append("line");
    if (o.vertical) {
        return l.attr("x1", cross - span / 2).attr("x2", cross + span / 2).attr("y1", p).attr("y2", p);
    }
    return l.attr("x1", p).attr("x2", p).attr("y1", cross - span / 2).attr("y2", cross + span / 2);
}

function marker(g: G, o: LinearOptions, cross: number, span: number, p: number) {
    return line(g, o, cross, span, p).attr("stroke-linecap", "round");
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

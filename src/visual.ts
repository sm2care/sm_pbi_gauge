/**
 * SM2 Executive Gauge — entry point.
 * Orchestrates: settings → data model → resolved theme/colors → render
 * context → engine routing (Arc | Linear) → HTML chrome.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { select, Selection } from "d3-selection";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ITooltipService = powerbi.extensibility.ITooltipService;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { GaugeSettings } from "./settings";
import { readDataView, buildModel } from "./core/model";
import { makeFormatter, makePercentFormatter, FormatOptions } from "./core/format";
import {
    pickTheme, SEMANTIC_DEFAULT, ACCENT_SOFT_DEFAULT, mix
} from "./core/tokens";
import { ResolvedColors, RenderContext, ThresholdStop, GaugeType } from "./core/types";
import { buildChrome, renderChrome, stageOf, ChromeRefs, ChromeFlags } from "./chrome";
import { renderArc } from "./engines/arc";
import { renderLinear } from "./engines/linear";

export class SM2ExecutiveGauge implements IVisual {
    private host: IVisualHost;
    private container: HTMLElement;
    private refs: ChromeRefs;
    private svg: Selection<SVGSVGElement, unknown, null, undefined>;
    private gaugeLayer: Selection<SVGGElement, unknown, null, undefined>;
    private fsService: FormattingSettingsService;
    private settings!: GaugeSettings;
    private locale: string;
    private tooltipService: ITooltipService;
    private tooltipItems: VisualTooltipDataItem[] = [];
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private selectionId: powerbi.extensibility.ISelectionId | undefined;
    private isSelected = false;
    private renderTimer: number | undefined;

    constructor(options?: VisualConstructorOptions) {
        if (!options) {
            throw new Error("VisualConstructorOptions are required");
        }
        this.host = options.host;
        this.locale = options.host.locale || "en-US";
        this.tooltipService = options.host.tooltipService;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
        this.fsService = new FormattingSettingsService();
        this.container = options.element;
        this.container.classList.add("sm2-root");

        this.refs = buildChrome(this.container);
        this.bindTooltips();
        this.bindContextMenu();

        const stage = stageOf(this.refs);
        this.svg = select(stage).append("svg").classed("sm2-svg", true);
        this.defineFilters();
        this.gaugeLayer = this.svg.append("g").classed("sm2-gauge", true);

        this.bindSelection();
    }

    public update(options: VisualUpdateOptions): void {
        // Rendering Events API — required for certification and lets the
        // export / print service know exactly when the visual is ready.
        this.events.renderingStarted(options);
        try {
            this.render(options);
        } catch {
            this.events.renderingFailed(options);
        }
    }

    private render(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews[0];
        this.settings = this.fsService.populateFormattingSettingsModel(GaugeSettings, dataView);

        // Identity for the single (aggregated) data point — drives selection
        // and cross-filtering of other visuals on click / keyboard.
        this.selectionId = this.buildSelectionId(dataView);

        const vp = options.viewport;
        const s = this.settings;

        // ---- resolve theme -------------------------------------------
        const cp: any = this.host.colorPalette;
        const hc = !!cp?.isHighContrast;
        const hostBg = cp?.background?.value as string | undefined;
        let theme = pickTheme(val(s.theme.mode) as any, hostBg);

        // ---- color mode & thresholds ---------------------------------
        const colorMode = val(s.colors.mode); // single | target | thresholds
        const mainColor = s.colors.mainColor.value.value;
        // Bands/stops are only built in "thresholds" mode.
        const thresholds = colorMode === "thresholds" ? this.resolveThresholds() : [];

        // ---- data model ----------------------------------------------
        const raw = readDataView(dataView);
        const model = buildModel(raw, thresholds);

        // ---- resolve the value fill color per mode -------------------
        let valueFill: string;
        if (colorMode === "single") {
            valueFill = mainColor;
        } else if (colorMode === "thresholds") {
            valueFill = s.colors.applyToValue.value
                ? bandColorAt(model.valuePos, thresholds, mainColor)
                : mainColor;
        } else { // target: automatic green / amber / red vs the target
            valueFill = autoStateColor(model.state, mainColor);
        }

        const colors: ResolvedColors = {
            theme,
            semantic: SEMANTIC_DEFAULT,
            accent: mainColor,
            accentSoft: mix(mainColor, "#FFFFFF", 0.45) || ACCENT_SOFT_DEFAULT,
            track: s.colors.trackColor.value.value || theme.track,
            valueFill
        };

        // ---- high-contrast override ----------------------------------
        // Honor the OS/Power BI high-contrast palette for accessibility.
        if (hc) {
            const fg = cp.foreground.value as string;
            const bg = cp.background.value as string;
            theme = {
                ...theme,
                textPrimary: fg, textSecondary: fg, textTertiary: fg,
                bgSurface: bg, bgCanvas: bg, hairline: fg,
                glassBg: bg, glassBorder: fg
            };
            colors.theme = theme;
            colors.valueFill = fg;
            colors.track = bg;
        }

        // ---- formatters ----------------------------------------------
        const fmtOpts: FormatOptions = {
            formatType: val(s.value.formatType) as any,
            decimals: s.value.decimals.value,
            currencySymbol: s.value.currencySymbol.value || "€",
            negativeStyle: val(s.value.negativeStyle) as any,
            displayUnits: val(s.value.displayUnits) as any,
            locale: this.locale
        };
        const fmt = makeFormatter(fmtOpts);
        const fmtPct = makePercentFormatter(this.locale, Math.min(2, s.value.decimals.value));

        // ---- viewport -------------------------------------------------
        const reduced = matchReducedMotion();
        const ctx: RenderContext = {
            width: vp.width,
            height: vp.height,
            model,
            colors,
            thresholds,
            fmt,
            fmtPct,
            animate: s.animation.enabled.value && val(s.animation.loadStyle) !== "none",
            reducedMotion: reduced,
            durationMs: s.animation.duration.value
        };

        // ---- tooltips -------------------------------------------------
        this.tooltipItems = this.buildTooltipItems(dataView, model, fmt, fmtPct);

        // ---- render ---------------------------------------------------
        this.layout(ctx);
        this.routeEngine(ctx);
        renderChrome(this.refs, ctx, this.chromeFlags(hc));
        this.applySelectionState();

        // ---- signal completion ---------------------------------------
        // When animating, wait for the load animation to settle so the
        // exported PDF/PPTX captures the final frame, not the empty start.
        if (this.renderTimer !== undefined) window.clearTimeout(this.renderTimer);
        const willAnimate = ctx.animate && !ctx.reducedMotion && ctx.durationMs > 0;
        if (willAnimate) {
            this.renderTimer = window.setTimeout(
                () => this.events.renderingFinished(options), ctx.durationMs + 60);
        } else {
            this.events.renderingFinished(options);
        }
    }

    /** Right-click anywhere on the visual opens the Power BI context menu,
     *  scoped to the data point so "Include / Exclude" act on this value. */
    private bindContextMenu(): void {
        this.container.addEventListener("contextmenu", (ev: MouseEvent) => {
            const selArg = this.selectionId ?? {};
            this.selectionManager.showContextMenu(selArg, { x: ev.clientX, y: ev.clientY });
            ev.preventDefault();
        });
    }

    /** Wire click + keyboard activation so the gauge emits selection and
     *  cross-filters other visuals. Honors keyboard focus (declared in
     *  capabilities) and keeps state in sync with external selection clears. */
    private bindSelection(): void {
        const root = this.container;
        root.setAttribute("tabindex", "0");
        root.setAttribute("role", "button");
        root.setAttribute("aria-label", "Gauge value — activate to cross-filter the report");

        const toggle = () => {
            // Respect the report's "Edit interactions" setting for this visual.
            const interactive = this.host.hostCapabilities.allowInteractions !== false;
            if (!this.selectionId || !interactive) return;
            this.selectionManager.select(this.selectionId).then((ids) => {
                this.isSelected = ids.length > 0;
                this.applySelectionState();
            });
        };

        root.addEventListener("click", (ev: MouseEvent) => {
            toggle();
            ev.stopPropagation();
        });
        root.addEventListener("keydown", (ev: KeyboardEvent) => {
            if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
                toggle();
                ev.preventDefault();
            }
        });

        // When selection is cleared from elsewhere (or the canvas), resync.
        this.selectionManager.registerOnSelectCallback(
            (ids: powerbi.extensibility.ISelectionId[]) => {
                this.isSelected = ids.length > 0;
                this.applySelectionState();
            });
    }

    /** Dim the gauge when the report has an active selection that this data
     *  point is not part of; full opacity when selected or nothing selected. */
    private applySelectionState(): void {
        const anySelection = this.selectionManager.hasSelection();
        const dimmed = anySelection && !this.isSelected;
        this.gaugeLayer.style("opacity", dimmed ? 0.35 : 1);
        this.container.classList.toggle("sm2-selected", this.isSelected);
    }

    /** Build a measure-based selection id from the Value role column. */
    private buildSelectionId(
        dataView: powerbi.DataView | undefined
    ): powerbi.extensibility.ISelectionId | undefined {
        const cols = dataView?.categorical?.values;
        if (!cols || !cols.length) return undefined;
        const valueCol = cols.find(c => c.source.roles?.["value"]) ?? cols[0];
        const queryName = valueCol.source.queryName;
        if (!queryName) return undefined;
        return this.host.createSelectionIdBuilder()
            .withMeasure(queryName)
            .createSelectionId();
    }

    /** Show a tooltip while the pointer is over the visual. */
    private bindTooltips(): void {
        if (!this.tooltipService) return;
        const root = this.container;
        const coords = (ev: MouseEvent): number[] => {
            const r = root.getBoundingClientRect();
            return [ev.clientX - r.left, ev.clientY - r.top];
        };
        const payload = (ev: MouseEvent) => ({
            coordinates: coords(ev),
            isTouchEvent: false,
            dataItems: this.tooltipItems,
            identities: this.selectionId ? [this.selectionId] : []
        });
        root.addEventListener("mouseover", (ev) => {
            if (this.tooltipItems.length) this.tooltipService.show(payload(ev));
        });
        root.addEventListener("mousemove", (ev) => {
            if (this.tooltipItems.length) this.tooltipService.move(payload(ev));
        });
        root.addEventListener("mouseleave", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        });
    }

    /** Build the tooltip rows: hero value, target, achievement, then any
     *  measures the user dragged into the Tooltips field (each formatted
     *  with its own column format string). */
    private buildTooltipItems(
        dataView: powerbi.DataView | undefined,
        model: ReturnType<typeof buildModel>,
        fmt: (v: number | null, compact?: boolean) => string,
        fmtPct: (v: number | null, signed?: boolean) => string
    ): VisualTooltipDataItem[] {
        const items: VisualTooltipDataItem[] = [];
        const cols = dataView?.categorical?.values ?? [];
        const nameOf = (role: string, fallback: string) =>
            cols.find(c => c.source.roles?.[role])?.source.displayName || fallback;

        if (model.hasValue) items.push({ displayName: nameOf("value", "Value"), value: fmt(model.value) });
        if (model.target !== null) items.push({ displayName: nameOf("target", "Target"), value: fmt(model.target) });
        if (model.achievement !== null) items.push({ displayName: "Achievement", value: fmtPct(model.achievement, false) });

        for (const col of cols) {
            if (!col.source.roles?.["tooltips"]) continue;
            const raw = col.values[col.values.length - 1];
            const vf = valueFormatter.create({ format: col.source.format, cultureSelector: this.locale });
            items.push({ displayName: col.source.displayName, value: vf.format(raw) });
        }
        return items;
    }

    // ---- layout: size svg within the stage ---------------------------
    private layout(ctx: RenderContext): void {
        const gaugeH = Math.max(40, ctx.height - 24);

        const stage = stageOf(this.refs);
        stage.style.height = `${gaugeH}px`;
        this.svg.attr("width", ctx.width - 24).attr("height", gaugeH)
            .attr("viewBox", `0 0 ${ctx.width - 24} ${gaugeH}`);
        this.gaugeLayer.attr("transform", "translate(0,0)");

        // hand the actual drawable size to the engines via the context
        (ctx as any).width = ctx.width - 24;
        (ctx as any).height = gaugeH;
    }

    private routeEngine(ctx: RenderContext): void {
        const s = this.settings;
        const type = val(s.shape.gaugeType) as GaugeType;
        const showBands = s.colors.showBands.value && val(s.colors.mode) === "thresholds";

        if (type === "bullet" || type === "thermometer") {
            renderLinear(this.gaugeLayer, ctx, {
                vertical: type === "thermometer" || val(s.shape.orientation) === "vertical",
                thickness: type === "thermometer" ? 40 : Math.max(18, ctx.height * 0.22),
                showBands,
                showTarget: s.targets.showTarget.value,
                targetMarker: val(s.targets.targetMarker) as any,
                targetColor: s.targets.targetColor.value.value
            });
        } else {
            const sweep = type === "progress" ? 360 : type === "arc" ? 110 : s.shape.sweepAngle.value;
            renderArc(this.gaugeLayer, ctx, {
                sweepDeg: sweep,
                thickness: type === "arc" ? Math.max(8, s.shape.thickness.value * 0.7) : s.shape.thickness.value,
                showBands,
                showScaleLabels: s.shape.showScaleLabels.value && type !== "arc",
                showTarget: s.targets.showTarget.value,
                showTargetLabel: s.targets.showTargetLabel.value,
                targetMarker: val(s.targets.targetMarker) as any,
                targetColor: s.targets.targetColor.value.value
            });
        }
    }

    private resolveThresholds(): ThresholdStop[] {
        const t = this.settings.colors;
        const a1 = clamp01(t.t1.value / 100);
        const a2 = clamp01(t.t2.value / 100);
        const lo = Math.min(a1, a2), hi = Math.max(a1, a2);
        return [
            { at: lo, color: t.c1.value.value, label: "Low" },
            { at: hi, color: t.c2.value.value, label: "Mid" },
            { at: 1, color: t.c3.value.value, label: "High" }
        ];
    }

    private chromeFlags(hc: boolean): ChromeFlags {
        const s = this.settings;
        return {
            heroPosition: val(s.shape.heroPosition) as any,
            fontFamily: s.typography.fontFamily.value,
            tabular: s.typography.tabularNumbers.value,
            glass: s.theme.glass.value && !hc,
            elevation: hc ? 0 : s.theme.elevation.value,
            transparentBg: s.theme.transparentBg.value && !hc,
            // In high contrast, defer to the system background (theme.bgSurface
            // is overridden to the HC palette) by passing an empty color.
            backgroundColor: hc ? "" : s.theme.backgroundColor.value.value,
            showBorder: s.theme.showBorder.value
        };
    }

    private defineFilters(): void {
        const defs = this.svg.append("defs");
        const glow = defs.append("filter").attr("id", "sm2-glow")
            .attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
        glow.append("feGaussianBlur").attr("stdDeviation", "3.2").attr("result", "blur");
        const merge = glow.append("feMerge");
        merge.append("feMergeNode").attr("in", "blur");
        merge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fsService.buildFormattingModel(this.settings);
    }
}

// ---- helpers ----------------------------------------------------------
function val(slice: any): string {
    const v: any = slice?.value;
    return typeof v === "string" ? v : String(v?.value ?? "");
}
function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** Color of the threshold band the normalized value [0..1] falls into. */
function bandColorAt(pos: number, stops: ThresholdStop[], fallback: string): string {
    for (const s of stops) { if (pos <= s.at) return s.color; }
    return stops.length ? stops[stops.length - 1].color : fallback;
}

/** Automatic green / amber / red from the performance state vs the target. */
function autoStateColor(state: string, fallback: string): string {
    if (state === "positive") return SEMANTIC_DEFAULT.positive;
    if (state === "warning") return SEMANTIC_DEFAULT.warning;
    if (state === "negative") return SEMANTIC_DEFAULT.negative;
    return fallback;
}
function matchReducedMotion(): boolean {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch { return false; }
}

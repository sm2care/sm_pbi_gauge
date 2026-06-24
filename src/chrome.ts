/**
 * Chrome — the minimal HTML around the SVG gauge: the card surface and the
 * hero value. Pure DOM, themed via inline styles from tokens.
 */
import { RenderContext } from "./core/types";

export interface ChromeRefs {
    root: HTMLElement;
    hero: HTMLElement;
}

export interface ChromeFlags {
    heroPosition: "center" | "below" | "none";
    fontFamily: string;
    tabular: boolean;
    glass: boolean;
    elevation: number;
    transparentBg: boolean;
    backgroundColor: string;
    showBorder: boolean;
}

export function buildChrome(container: HTMLElement): ChromeRefs {
    container.replaceChildren();
    const root = el("div", "sm2-card");

    const stage = el("div", "sm2-stage"); // holds svg + centered hero
    const hero = el("div", "sm2-hero");
    stage.appendChild(hero);

    root.appendChild(stage);
    container.appendChild(root);

    return { root, hero };
}

/** Returns the stage element that should host the SVG. */
export function stageOf(refs: ChromeRefs): HTMLElement {
    return refs.root.querySelector(".sm2-stage") as HTMLElement;
}

export function renderChrome(refs: ChromeRefs, ctx: RenderContext, f: ChromeFlags): void {
    const t = ctx.colors.theme;

    // ---- card surface ------------------------------------------------
    // Transparent lets the visual blend into the report canvas; otherwise a
    // solid (or glass) fill with an optional border and elevation shadow.
    const bg = f.transparentBg
        ? "transparent"
        : f.glass ? t.glassBg : (f.backgroundColor || t.bgSurface);
    const useGlass = f.glass && !f.transparentBg;
    const border = f.transparentBg
        ? (f.showBorder ? `1px solid ${t.hairline}` : "none")
        : `1px solid ${useGlass ? t.glassBorder : (f.showBorder ? t.hairline : "transparent")}`;
    style(refs.root, {
        fontFamily: f.fontFamily,
        background: bg,
        backdropFilter: useGlass ? "blur(16px)" : "none",
        webkitBackdropFilter: useGlass ? "blur(16px)" : "none",
        border,
        boxShadow: f.transparentBg ? "none" : t.elevation[clampIdx(f.elevation)],
        color: t.textPrimary
    });

    // ---- hero value --------------------------------------------------
    refs.hero.style.display = f.heroPosition === "none" ? "none" : "flex";
    const centered = f.heroPosition === "center";
    // Align the centered value to the arc's optical anchor when the engine
    // supplied one; otherwise fall back to the stage center (CSS default).
    const anchor = ctx.heroAnchorPct;
    style(refs.hero, {
        color: t.textPrimary,
        fontFeatureSettings: f.tabular ? '"tnum" 1' : "normal",
        position: centered ? "absolute" : "static",
        top: centered && anchor ? `${anchor.y}%` : centered ? "50%" : "auto",
        left: centered && anchor ? `${anchor.x}%` : centered ? "50%" : "auto"
    });
    refs.hero.textContent = ctx.model.hasValue ? ctx.fmt(ctx.model.value) : "—";
}

// ---- tiny DOM utils ---------------------------------------------------
function el(tag: string, cls: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = cls;
    return e;
}
function style(e: HTMLElement, s: Record<string, string>): void {
    Object.assign(e.style, s as any);
}
function clampIdx(v: number): number { return Math.max(0, Math.min(3, Math.round(v))); }

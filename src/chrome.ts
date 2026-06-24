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
    style(refs.root, {
        fontFamily: f.fontFamily,
        background: f.glass ? t.glassBg : t.bgSurface,
        backdropFilter: f.glass ? "blur(16px)" : "none",
        webkitBackdropFilter: f.glass ? "blur(16px)" : "none",
        border: `1px solid ${f.glass ? t.glassBorder : t.hairline}`,
        boxShadow: t.elevation[clampIdx(f.elevation)],
        color: t.textPrimary
    });

    // ---- hero value --------------------------------------------------
    refs.hero.style.display = f.heroPosition === "none" ? "none" : "flex";
    style(refs.hero, {
        color: t.textPrimary,
        fontFeatureSettings: f.tabular ? '"tnum" 1' : "normal",
        position: f.heroPosition === "center" ? "absolute" : "static"
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

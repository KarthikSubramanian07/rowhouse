/**
 * Minimal typed vdom for Satori's PLAIN-OBJECT element form (no JSX).
 *
 * Satori consumes React-element-shaped objects: `{ type, props: { style, children } }`.
 * We model just enough of that shape to build cards with full type-safety, then
 * cast to Satori's parameter type at the single call site in render.ts.
 *
 * SATORI LAYOUT RULE (enforced by the helpers below): any element that renders
 * more than one child MUST declare `display: 'flex'` and an explicit
 * `flexDirection`. `col()` and `row()` set both for you; `box()` sets `display`
 * automatically when it receives multiple children.
 */

/** A CSS-in-JS style object. Values are camelCased CSS props Satori understands. */
export type Style = Record<string, string | number>;

export interface VNode {
  type: 'div' | 'span' | 'img' | 'p';
  props: {
    style: Style;
    /** Present only on <img>. Must be a data: URL on Workers. */
    src?: string;
    children?: VChild[];
  };
}

/** Falsy children are dropped so callers can inline `cond && node`. */
export type VChild = VNode | string | number | null | undefined | false;
export type VChildren = VChild | VChild[];

function normalize(children: VChildren | undefined): VChild[] {
  if (children === undefined) return [];
  const arr = Array.isArray(children) ? children : [children];
  return arr.filter(
    (c): c is VNode | string | number => c !== null && c !== undefined && c !== false,
  );
}

/**
 * Generic element. When given 2+ children it auto-sets `display: 'flex'`.
 * You still control `flexDirection` via `style` (defaults to `row` in flex).
 */
export function box(type: VNode['type'], style: Style, children?: VChildren): VNode {
  const kids = normalize(children);
  const finalStyle: Style =
    kids.length > 1 && style.display === undefined ? { display: 'flex', ...style } : style;
  return { type, props: { style: finalStyle, children: kids } };
}

/** Vertical flex container. Always sets display:flex + flexDirection:column. */
export function col(style: Style, children?: VChildren): VNode {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', ...style },
      children: normalize(children),
    },
  };
}

/** Horizontal flex container. Always sets display:flex + flexDirection:row. */
export function row(style: Style, children?: VChildren): VNode {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row', ...style },
      children: normalize(children),
    },
  };
}

/** A single run of text. Satori is happy with one string child and no flex. */
export function text(style: Style, value: string | number): VNode {
  return { type: 'div', props: { style, children: [String(value)] } };
}

/** An <img> — `src` MUST be a data: URL (Satori cannot fetch remote images on Workers). */
export function img(src: string, style: Style): VNode {
  return { type: 'img', props: { style, src } };
}

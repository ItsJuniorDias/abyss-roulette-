export const TAU = Math.PI * 2;
export const wrap = (angle: number) => ((angle % TAU) + TAU) % TAU;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);

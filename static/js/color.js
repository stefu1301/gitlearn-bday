/**
 * Colour helpers.
 *
 * Palettes cross-fade by interpolating in OKLab rather than sRGB: a direct
 * red-to-blue blend in sRGB passes through a muddy grey, while OKLab keeps
 * the transition bright the whole way across.
 */

const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);

/** Parse "#rrggbb" (or "#rgb") into 0-255 channel values. */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel) {
  const v = channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return clamp(Math.round(v * 255), 0, 255);
}

/** sRGB -> OKLab. */
export function rgbToOklab(rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** OKLab -> sRGB, clamped back into gamut. */
export function oklabToRgb(lab) {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r: linearToSrgb(lr), g: linearToSrgb(lg), b: linearToSrgb(lb) };
}

/** Blend two OKLab colours. */
export function mixLab(a, b, t) {
  return {
    L: a.L + (b.L - a.L) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** Format an OKLab colour as a CSS string. */
export function labToCss(lab) {
  const { r, g, b } = oklabToRgb(lab);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Format an OKLab colour as an rgba() string. */
export function labToRgba(lab, alpha = 1) {
  const { r, g, b } = oklabToRgb(lab);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Blend two CSS hex colours in sRGB. Used for one-off, non-animated bits. */
export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)}, ${Math.round(
    ca.g + (cb.g - ca.g) * t,
  )}, ${Math.round(ca.b + (cb.b - ca.b) * t)})`;
}

/**
 * Palette state.
 *
 * Holds every palette and cross-fades between them. The trick that makes the
 * fade feel seamless is that particles never store a fixed colour: they store
 * a *ramp slot* (a position between 0 and 1 along the palette's ramp) and the
 * engine resolves that slot against the live, animating ramp. Confetti that is
 * already in the air therefore changes colour along with the background
 * instead of popping from red to blue.
 */

import { hexToRgb, labToCss, labToRgba, mixLab, rgbToOklab } from './color.js';

const FADE_MS = 700;
const LUT_SIZE = 64;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Flatten a palette into an array of OKLab colours so a whole palette can be
 * lerped with one loop.
 * Order: bg0, bg1, text, accent, ramp[0..4].
 */
function paletteToLabs(palette) {
  const labs = [
    rgbToOklab(hexToRgb(palette.bg[0])),
    rgbToOklab(hexToRgb(palette.bg[1])),
    rgbToOklab(hexToRgb(palette.text)),
    rgbToOklab(hexToRgb(palette.accent)),
  ];
  for (const stop of palette.ramp) {
    labs.push(rgbToOklab(hexToRgb(stop)));
  }
  return labs;
}

export class PaletteState {
  constructor(palettes, startIndex = 0, storageKey = 'birthday.palette') {
    this.palettes = palettes;
    this.storageKey = storageKey;
    this.index = this._restoreIndex(startIndex);
    this.name = this.palettes[this.index].name;

    this._target = paletteToLabs(this.palettes[this.index]);
    this._from = this._target.map((lab) => ({ ...lab }));
    this._current = this._target.map((lab) => ({ ...lab }));
    this._elapsed = FADE_MS;
    this._transitioning = false;

    this._lut = new Array(LUT_SIZE);
    this._lutLabs = new Array(LUT_SIZE);
    this._rebuildLut();
  }

  _restoreIndex(fallback) {
    try {
      const stored = window.localStorage.getItem(this.storageKey);
      const parsed = stored === null ? NaN : Number.parseInt(stored, 10);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < this.palettes.length) {
        return parsed;
      }
    } catch {
      /* private mode / storage disabled -- fall through to the default */
    }
    return fallback;
  }

  _persist() {
    try {
      window.localStorage.setItem(this.storageKey, String(this.index));
    } catch {
      /* ignore storage failures, the theme still works for this visit */
    }
  }

  /** Lab indices of the ramp stops inside the flat colour array. */
  static get RAMP_OFFSET() {
    return 4;
  }

  /** Rebuild the colour lookup table used by the particle renderer. */
  _rebuildLut() {
    const ramp = this._current.slice(PaletteState.RAMP_OFFSET);
    const segments = ramp.length - 1;

    for (let i = 0; i < LUT_SIZE; i += 1) {
      const t = i / (LUT_SIZE - 1);
      const scaled = t * segments;
      const index = Math.min(segments - 1, Math.floor(scaled));
      const frac = scaled - index;
      const lab = mixLab(ramp[index], ramp[index + 1], frac);
      this._lutLabs[i] = lab;
      this._lut[i] = labToCss(lab);
    }
  }

  /** Advance an in-flight cross-fade. */
  update(deltaMs) {
    if (!this._transitioning) {
      return false;
    }

    this._elapsed += deltaMs;
    const raw = Math.min(1, this._elapsed / FADE_MS);
    const eased = easeInOutCubic(raw);

    for (let i = 0; i < this._current.length; i += 1) {
      this._current[i] = mixLab(this._from[i], this._target[i], eased);
    }

    if (raw >= 1) {
      this._transitioning = false;
      this._elapsed = FADE_MS;
    }

    this._rebuildLut();
    return true;
  }

  /** Start a cross-fade to the palette at `index`. */
  set(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.palettes.length) {
      return false;
    }
    if (index === this.index && !this._transitioning) {
      return false;
    }

    this.index = index;
    this.name = this.palettes[index].name;
    this._from = this._current.map((lab) => ({ ...lab }));
    this._target = paletteToLabs(this.palettes[index]);
    this._elapsed = 0;
    this._transitioning = true;
    this._persist();
    return true;
  }

  /** Step to the next palette, wrapping around. */
  cycle() {
    return this.set((this.index + 1) % this.palettes.length);
  }

  /** Skip the animation and land on the target palette immediately. */
  jumpTo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.palettes.length) {
      return false;
    }
    this.index = index;
    this.name = this.palettes[index].name;
    this._target = paletteToLabs(this.palettes[index]);
    this._current = this._target.map((lab) => ({ ...lab }));
    this._from = this._current.map((lab) => ({ ...lab }));
    this._elapsed = FADE_MS;
    this._transitioning = false;
    this._rebuildLut();
    this._persist();
    return true;
  }

  /** Colour at a position along the ramp (0 = darkest, 1 = brightest). */
  rampColor(t) {
    const index = Math.round(Math.min(1, Math.max(0, t)) * (LUT_SIZE - 1));
    return this._lut[index];
  }

  /** Ramp colour with an alpha channel, for canvas gradients. */
  rampRgba(t, alpha = 1) {
    const index = Math.round(Math.min(1, Math.max(0, t)) * (LUT_SIZE - 1));
    return labToRgba(this._lutLabs[index], alpha);
  }

  get backgroundCss() {
    return `linear-gradient(180deg, ${labToCss(this._current[0])} 0%, ${labToCss(
      this._current[1],
    )} 100%)`;
  }

  get backgroundTop() {
    return labToCss(this._current[0]);
  }

  get backgroundBottom() {
    return labToCss(this._current[1]);
  }

  get textColor() {
    return labToCss(this._current[2]);
  }

  get accentColor() {
    return labToCss(this._current[3]);
  }

  /** The accent colour with an alpha channel, for canvas gradients. */
  accentRgba(alpha = 1) {
    return labToRgba(this._current[3], alpha);
  }

  /** The five ramp stops as CSS colours. */
  get ramp() {
    const offset = PaletteState.RAMP_OFFSET;
    return this._current.slice(offset).map(labToCss);
  }

  /**
   * A dark silhouette colour for the landscape layers: the sky colour mixed
   * with the darkest ramp stop, so the hills stay shadowy instead of glowing.
   */
  hillColor(t = 0.3) {
    const sky = this._current[0];
    const darkest = this._current[PaletteState.RAMP_OFFSET];
    return labToCss(mixLab(sky, darkest, t));
  }
}

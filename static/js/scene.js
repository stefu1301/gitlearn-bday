/**
 * The static parts of the scene: the sky, the stars, the hills and the cake.
 * Everything here is drawn procedurally, so it retints automatically when the
 * palette changes.
 */

const TAU = Math.PI * 2;
const rand = (min, max) => min + Math.random() * (max - min);

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export class Scene {
  constructor() {
    this.stars = [];
    this.hills = [];
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.candlesLit = true;
    this._gradient = null;
    this._gradientKey = '';
  }

  resize(width, height) {
    this.width = width;
    this.height = height;

    const density = Math.min(1, (width * height) / 900000);
    const count = Math.round(70 + density * 130);
    this.stars = [];
    for (let i = 0; i < count; i += 1) {
      this.stars.push({
        x: rand(0, width),
        y: rand(0, height * 0.72),
        radius: rand(0.4, 1.7),
        depth: rand(0.15, 1),
        phase: rand(0, TAU),
        speed: rand(0.6, 2.2),
      });
    }

    // Two layers of hills, each a run of sine peaks.
    this.hills = [
      { y: height * 0.86, amp: height * 0.035, freq: 0.0022, phase: 0, tone: 0.22, speed: 0.006 },
      { y: height * 0.93, amp: height * 0.028, freq: 0.0034, phase: 1.7, tone: 0.42, speed: -0.004 },
    ];
  }

  update(delta) {
    this.time += delta;
  }

  /** Draw the sky, the glow, the stars and the hills. */
  drawBackground(ctx, palette, parallax) {
    const { width, height } = this;

    const key = `${palette.backgroundTop}|${palette.backgroundBottom}`;
    if (this._gradientKey !== key) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, palette.backgroundTop);
      gradient.addColorStop(0.55, palette.backgroundBottom);
      gradient.addColorStop(1, palette.backgroundTop);
      this._gradient = gradient;
      this._gradientKey = key;
    }

    ctx.fillStyle = this._gradient;
    ctx.fillRect(0, 0, width, height);

    // Warm glow sitting behind the cake.
    const glow = ctx.createRadialGradient(width / 2, height * 0.92, 0, width / 2, height * 0.92, width * 0.55);
    glow.addColorStop(0, palette.accentRgba(0.27));
    glow.addColorStop(1, palette.accentRgba(0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Stars.
    ctx.save();
    for (const star of this.stars) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * star.speed + star.phase));
      const x = star.x + parallax.x * star.depth * 26;
      const y = star.y + parallax.y * star.depth * 16;
      ctx.globalAlpha = twinkle * 0.85;
      ctx.fillStyle = palette.rampColor(0.95);
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Hills.
    for (const hill of this.hills) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = palette.hillColor(hill.tone);
      ctx.beginPath();
      ctx.moveTo(0, height);
      const drift = this.time * hill.speed * 100;
      for (let x = 0; x <= width; x += 12) {
        const y =
          hill.y +
          Math.sin((x + drift) * hill.freq + hill.phase) * hill.amp +
          Math.sin((x + drift) * hill.freq * 2.3) * hill.amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Where the cake sits, for hit testing. */
  cakeBounds() {
    const width = Math.min(230, Math.max(140, this.width * 0.3));
    const height = Math.min(120, Math.max(78, this.height * 0.16));
    return {
      x: this.width / 2 - width / 2,
      y: this.height - height - 26,
      width,
      height,
    };
  }

  /** The cake, its frosting, and three candles with live flames. */
  drawCake(ctx, palette) {
    const bounds = this.cakeBounds();
    const { x, y, width, height } = bounds;
    const bottom = y + height;

    // Plate.
    ctx.save();
    ctx.fillStyle = palette.rampColor(0.15);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, bottom + 6, width * 0.62, 11, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Cake body.
    const body = ctx.createLinearGradient(0, y, 0, bottom);
    body.addColorStop(0, palette.rampColor(0.78));
    body.addColorStop(1, palette.rampColor(0.42));
    ctx.fillStyle = body;
    roundRect(ctx, x, y, width, height, 16);
    ctx.fill();

    // Frosting cap with drips.
    ctx.fillStyle = palette.rampColor(0.97);
    roundRect(ctx, x - 4, y - 14, width + 8, 34, 12);
    ctx.fill();

    ctx.fillStyle = palette.rampColor(0.9);
    const drips = 7;
    for (let i = 0; i < drips; i += 1) {
      const dripX = x + 4 + ((width - 8) / (drips - 1)) * i;
      const dripRadius = 7 + Math.sin(i * 2.3) * 3;
      ctx.beginPath();
      ctx.ellipse(dripX, y + 20, dripRadius, dripRadius * 1.25, 0, 0, TAU);
      ctx.fill();
    }

    // Candles.
    const candleCount = 3;
    const candleWidth = 9;
    const candleHeight = 30;
    for (let i = 0; i < candleCount; i += 1) {
      const spacing = width / (candleCount + 1);
      const cx = x + spacing * (i + 1);
      const candleTop = y - 14 - candleHeight;

      const stripe = ctx.createLinearGradient(cx - candleWidth / 2, 0, cx + candleWidth / 2, 0);
      stripe.addColorStop(0, palette.rampColor(0.9));
      stripe.addColorStop(0.5, palette.rampColor(1));
      stripe.addColorStop(1, palette.rampColor(0.75));
      ctx.fillStyle = stripe;
      roundRect(ctx, cx - candleWidth / 2, candleTop, candleWidth, candleHeight, 3);
      ctx.fill();

      ctx.strokeStyle = palette.rampColor(0.2);
      ctx.lineWidth = 1.2;
      for (let s = 1; s < 4; s += 1) {
        const sy = candleTop + (candleHeight / 4) * s;
        ctx.beginPath();
        ctx.moveTo(cx - candleWidth / 2, sy);
        ctx.lineTo(cx + candleWidth / 2, sy);
        ctx.stroke();
      }

      if (this.candlesLit) {
        this._drawFlame(ctx, cx, candleTop - 2, palette, i);
      }
    }
  }

  _drawFlame(ctx, x, y, palette, index) {
    const flicker = Math.sin(this.time * 9 + index * 2.1) * 0.16 + Math.sin(this.time * 23 + index) * 0.06;
    const height = 17 * (1 + flicker);
    const width = 7 * (1 + flicker * 0.5);

    const glow = ctx.createRadialGradient(x, y - height * 0.4, 0, x, y - height * 0.4, height * 2.6);
    glow.addColorStop(0, palette.rampRgba(1, 0.4));
    glow.addColorStop(1, palette.rampRgba(1, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - height * 0.4, height * 2.6, 0, TAU);
    ctx.fill();

    const flame = ctx.createLinearGradient(x, y - height, x, y + 2);
    flame.addColorStop(0, palette.rampColor(1));
    flame.addColorStop(0.55, palette.rampColor(0.88));
    flame.addColorStop(1, palette.rampColor(0.65));
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.quadraticCurveTo(x + width, y - height * 0.35, x, y + 2);
    ctx.quadraticCurveTo(x - width, y - height * 0.35, x, y - height);
    ctx.closePath();
    ctx.fill();
  }
}

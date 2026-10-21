/**
 * The animation engine.
 *
 * One canvas, one requestAnimationFrame loop, one fixed-timestep physics step.
 * The fixed step matters: on a 144Hz display the simulation must evolve at
 * the same rate as on a 60Hz one, otherwise the confetti falls at a different
 * speed depending on the monitor.
 */

import {
  ParticleSystem,
  spawnBalloon,
  spawnConfetti,
  spawnDust,
  spawnFirework,
  spawnRing,
  spawnSmoke,
} from './particles.js';
import { Scene } from './scene.js';

const STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25;
const MAX_STEPS = 5;

export class Engine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.trailCanvas = document.createElement('canvas');
    this.trailCtx = this.trailCanvas.getContext('2d');

    this.palette = options.palette;
    this.particles = new ParticleSystem(options.maxParticles ?? 1600);
    this.scene = new Scene();
    this.events = options.events ?? {};

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.time = 0;
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.running = false;
    this.frameHandle = null;

    this.parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    this.quality = 1;
    this.qualityCap = 1;
    this.fps = 60;
    this._frameTimes = [];
    this._dustTimer = 0;

    this._onResize = () => this.resize();
    this._onVisibility = () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    };

    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);

    this.resize();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = width;
    this.height = height;
    this.dpr = dpr;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The trail layer runs at CSS resolution: half the pixels to fill, and
    // slightly softer streaks, which suits a glow.
    this.trailCanvas.width = width;
    this.trailCanvas.height = height;
    this.trailCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.trailCtx.clearRect(0, 0, width, height);

    this.scene.resize(width, height);
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTimestamp = performance.now();
    const frame = (timestamp) => {
      if (!this.running) {
        return;
      }
      this.frameHandle = requestAnimationFrame(frame);

      let delta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;
      if (delta > MAX_FRAME_TIME) {
        delta = MAX_FRAME_TIME;
      }

      this.accumulator += delta;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS) {
        this.update(STEP);
        this.accumulator -= STEP;
        steps += 1;
      }
      if (steps === MAX_STEPS) {
        this.accumulator = 0;
      }

      this.render();
      this._trackPerformance(delta);
    };
    this.frameHandle = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  /** Slow the animation down when the device is struggling. */
  _trackPerformance(delta) {
    this._frameTimes.push(delta * 1000);
    if (this._frameTimes.length < 60) {
      return;
    }
    const average = this._frameTimes.reduce((sum, value) => sum + value, 0) / this._frameTimes.length;
    this._frameTimes.length = 0;
    this.fps = 1000 / average;

    let next = this.quality;
    if (average > 21 && this.quality > 0.4) {
      next = Math.max(0.4, this.quality - 0.12);
    } else if (average < 13 && this.quality < 1) {
      next = Math.min(1, this.quality + 0.08);
    }
    next = Math.min(next, this.qualityCap);

    if (next !== this.quality) {
      this.quality = next;
      this.emit('quality', this.quality);
    }
  }

  emit(name, payload) {
    const handler = this.events[name];
    if (typeof handler === 'function') {
      handler(payload);
    }
  }

  update(delta) {
    this.time += delta;

    if (typeof this.events.frame === 'function') {
      this.events.frame(delta);
    }

    // Ease the parallax toward the pointer.
    this.parallax.x += (this.parallax.tx - this.parallax.x) * Math.min(1, delta * 4);
    this.parallax.y += (this.parallax.ty - this.parallax.y) * Math.min(1, delta * 4);

    this.scene.update(delta);

    this.particles.update(delta, {
      time: this.time,
      wind: Math.sin(this.time * 0.31) * 42 + Math.sin(this.time * 0.11) * 26,
      floorY: this.height - 4,
    });

    // Keep a haze of floating motes in the air.
    this._dustTimer -= delta;
    if (this._dustTimer <= 0) {
      this._dustTimer = 0.35 / Math.max(0.4, this.quality);
      const count = Math.round(2 * this.quality);
      for (let i = 0; i < count; i += 1) {
        spawnDust(this.particles, this.width, this.height, { life: 20 });
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const trail = this.trailCtx;
    const { width, height } = this;

    // Fade the previous frame's trails, then draw this frame's sparks onto it.
    trail.globalCompositeOperation = 'destination-out';
    trail.fillStyle = 'rgba(0, 0, 0, 0.17)';
    trail.fillRect(0, 0, width, height);
    trail.globalCompositeOperation = 'source-over';
    this.particles.drawTrail(trail, this.palette);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scene.drawBackground(ctx, this.palette, this.parallax);

    // Composite the glowing trails over the sky.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.95;
    ctx.drawImage(this.trailCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    this.particles.draw(ctx, this.palette);
    this.scene.drawCake(ctx, this.palette);
  }

  /* ------------------------------------------------------------ effects -- */

  /** A firework burst. */
  fireworkAt(x, y, options = {}) {
    spawnFirework(this.particles, x, y, { ...options, density: this.quality });
    spawnRing(this.particles, x, y, { slot: options.slot ?? 0.95 });
    this.emit('firework', { x, y });
  }

  /** A burst of confetti. */
  confettiAt(x, y, count = 26, options = {}) {
    spawnConfetti(this.particles, x, y, count, { ...options, density: this.quality });
  }

  /** A balloon drifting up from the bottom of the screen. */
  balloonAt(x, y) {
    spawnBalloon(this.particles, x, y);
  }

  /** Puff of smoke, used when the candles are blown out. */
  smokeAt(x, y, options = {}) {
    spawnSmoke(this.particles, x, y, options);
  }

  /** The grand finale: a run of fireworks over the cake. */
  finale() {
    const cx = this.width / 2;
    const timeline = [
      { delay: 0, x: cx, y: this.height * 0.28, size: 1 },
      { delay: 220, x: cx - this.width * 0.22, y: this.height * 0.36, size: 0.85 },
      { delay: 430, x: cx + this.width * 0.2, y: this.height * 0.33, size: 0.9 },
      { delay: 640, x: cx - this.width * 0.08, y: this.height * 0.2, size: 1.1 },
      { delay: 860, x: cx + this.width * 0.32, y: this.height * 0.28, size: 0.8 },
      { delay: 1080, x: cx, y: this.height * 0.16, size: 1.35 },
    ];

    for (const shot of timeline) {
      window.setTimeout(() => {
        this.fireworkAt(shot.x, shot.y, {
          count: Math.round(90 * shot.size),
          speed: 300 + shot.size * 90,
        });
      }, shot.delay);
    }

    // Confetti rain.
    for (let i = 0; i < 5; i += 1) {
      window.setTimeout(() => {
        this.confettiAt(this.width * (0.1 + Math.random() * 0.8), -20, 40, {
          angle: Math.PI / 2,
          speed: 240,
        });
      }, 200 + i * 180);
    }

    this.emit('finale');
  }
}

/**
 * Particle system.
 *
 * A fixed-size pool of plain objects, recycled in place so the animation
 * never triggers a garbage collection pause. Every particle stores a *ramp
 * slot* rather than a colour, which is what lets the palette cross-fade
 * recolour particles that are already in flight.
 */

export const TYPE = {
  CONFETTI: 'confetti',
  SPARK: 'spark',
  DUST: 'dust',
  BALLOON: 'balloon',
  SMOKE: 'smoke',
  RING: 'ring',
};

const GRAVITY = 900; // px / s^2
const TAU = Math.PI * 2;

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class ParticleSystem {
  constructor(max = 1600) {
    this.max = max;
    this.items = new Array(max);
    for (let i = 0; i < max; i += 1) {
      this.items[i] = { alive: false };
    }
    this.cursor = 0;
    this.aliveCount = 0;
    this.time = 0;
    this.wind = 0;
    this.floorY = 0;
  }

  /** Claim a slot from the pool, recycling the oldest if the pool is full. */
  _claim() {
    const { items, max } = this;
    for (let i = 0; i < max; i += 1) {
      const index = (this.cursor + i) % max;
      if (!items[index].alive) {
        this.cursor = (index + 1) % max;
        return items[index];
      }
    }
    // Pool exhausted: steal the slot at the cursor.
    const index = this.cursor;
    this.cursor = (index + 1) % max;
    return items[index];
  }

  clear() {
    for (const item of this.items) {
      item.alive = false;
    }
    this.aliveCount = 0;
  }

  update(delta, environment) {
    this.time = environment.time;
    this.wind = environment.wind;
    this.floorY = environment.floorY;

    const { items, max } = this;
    let alive = 0;

    for (let i = 0; i < max; i += 1) {
      const p = items[i];
      if (!p.alive) {
        continue;
      }

      p.life -= delta;

      switch (p.type) {
        case TYPE.CONFETTI: {
          p.vy += GRAVITY * p.gravity * delta;
          const flutter = Math.sin(this.time * p.flutterSpeed + p.phase) * p.flutterAmp;
          p.vx += (this.wind + flutter) * delta;
          const damping = 1 - Math.min(0.9, p.drag * delta);
          p.vx *= damping;
          p.vy *= 1 - Math.min(0.9, p.drag * 0.4 * delta);
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.rot += p.vrot * delta;
          p.spin += p.spinSpeed * delta;

          if (p.y > this.floorY) {
            p.y = this.floorY;
            if (p.vy > 60) {
              p.vy = -p.vy * 0.38;
              p.vx *= 0.62;
              p.vrot *= 0.55;
            } else {
              p.vy = 0;
              p.vx *= 0.9;
              p.vrot *= 0.8;
              p.settled = true;
            }
          }
          break;
        }

        case TYPE.SPARK: {
          p.vy += GRAVITY * 0.42 * delta;
          const damping = 1 - Math.min(0.9, p.drag * delta);
          p.vx *= damping;
          p.vy *= damping;
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          break;
        }

        case TYPE.DUST: {
          p.x += (p.vx + Math.sin(this.time * 0.7 + p.phase) * 8) * delta;
          p.y += p.vy * delta;
          p.twinkle += delta * p.twinkleSpeed;
          break;
        }

        case TYPE.BALLOON: {
          p.vy += (p.vy > -34 ? -90 : 0) * delta;
          p.vy *= 1 - Math.min(0.9, 0.9 * delta);
          p.x += (p.vx + Math.sin(this.time * p.swaySpeed + p.phase) * 26) * delta;
          p.y += p.vy * delta;
          p.rot = Math.sin(this.time * p.swaySpeed + p.phase) * 0.12;
          break;
        }

        case TYPE.SMOKE: {
          p.radius += p.grow * delta;
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.vy += 12 * delta;
          break;
        }

        case TYPE.RING: {
          p.radius += p.grow * delta;
          p.width = Math.max(0.5, p.width - p.fadeWidth * delta);
          break;
        }

        default:
          break;
      }

      if (p.life <= 0) {
        p.alive = false;
        continue;
      }

      alive += 1;
    }

    this.aliveCount = alive;
  }

  /** Draw the parts that belong on the glowing "trail" layer. */
  drawTrail(ctx, palette) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      if (!p.alive || p.type !== TYPE.SPARK) {
        continue;
      }
      const t = p.life / p.maxLife;
      const alpha = t * t;
      const color = palette.rampColor(p.slot);
      const size = p.size * (0.45 + t * 0.55);

      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, TAU);
      ctx.fill();

      // Soft halo.
      ctx.globalAlpha = alpha * 0.22;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 3.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Draw everything else straight onto the main canvas. */
  draw(ctx, palette) {
    for (const p of this.items) {
      if (!p.alive || p.type === TYPE.SPARK) {
        continue;
      }

      const t = p.life / p.maxLife;
      let alpha = 1;
      if (p.fadeIn) {
        alpha = Math.min(1, (1 - t) * 6);
      } else {
        alpha = Math.min(1, t * 3.2);
      }

      switch (p.type) {
        case TYPE.CONFETTI:
          this._drawConfetti(ctx, p, palette, alpha);
          break;
        case TYPE.DUST:
          this._drawDust(ctx, p, palette, alpha);
          break;
        case TYPE.BALLOON:
          this._drawBalloon(ctx, p, palette, alpha);
          break;
        case TYPE.SMOKE:
          this._drawSmoke(ctx, p, palette, alpha);
          break;
        case TYPE.RING:
          this._drawRing(ctx, p, palette, alpha);
          break;
        default:
          break;
      }
    }
  }

  _drawConfetti(ctx, p, palette, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    const w = p.width;
    const h = p.height;
    ctx.fillStyle = palette.rampColor(p.slot);
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Bright stripe so the pieces read as folded paper, not flat dots.
    ctx.fillStyle = palette.rampColor(Math.min(1, p.slot + 0.28));
    ctx.fillRect(-w / 2, -h / 2, w * 0.34, h);

    ctx.restore();
  }

  _drawDust(ctx, p, palette, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * (0.25 + 0.25 * Math.sin(p.twinkle)) * p.alphaScale;
    ctx.fillStyle = palette.rampColor(p.slot);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _drawBalloon(ctx, p, palette, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    const w = p.width;
    const h = p.height;

    ctx.strokeStyle = palette.rampColor(0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.quadraticCurveTo(p.sway * 6, h / 2 + 22, 0, h / 2 + 42);
    ctx.stroke();

    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, palette.rampColor(p.slot));
    grad.addColorStop(1, palette.rampColor(Math.min(1, p.slot + 0.3)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = palette.rampColor(1);
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.2, w * 0.13, h * 0.16, -0.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  _drawSmoke(ctx, p, palette, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = palette.rampColor(0.55);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _drawRing(ctx, p, palette, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = palette.rampColor(p.slot);
    ctx.lineWidth = p.width;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Spawners                                                           */
/* ------------------------------------------------------------------ */

/** A firework: radial sparks with randomised speed and colour slot. */
export function spawnFirework(system, x, y, options = {}) {
  const count = Math.round((options.count ?? 70) * (options.density ?? 1));
  const speed = options.speed ?? 320;
  const spread = options.spread ?? TAU;
  const baseAngle = options.angle ?? rand(0, TAU);

  for (let i = 0; i < count; i += 1) {
    const angle = baseAngle + rand(-spread / 2, spread / 2);
    const velocity = speed * rand(0.35, 1);
    const p = system._claim();
    p.alive = true;
    p.type = TYPE.SPARK;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * velocity;
    p.vy = Math.sin(angle) * velocity;
    p.size = rand(1.4, 3.4);
    p.slot = rand(0.45, 1);
    p.drag = rand(0.9, 1.7);
    p.maxLife = rand(0.5, 1.25);
    p.life = p.maxLife;
  }

  // A soft puff of smoke at the centre sells the explosion.
  spawnSmoke(system, x, y, { radius: 10, grow: 46, life: 0.7 });
}

/** A ring shockwave. */
export function spawnRing(system, x, y, options = {}) {
  const p = system._claim();
  p.alive = true;
  p.type = TYPE.RING;
  p.x = x;
  p.y = y;
  p.radius = options.radius ?? 4;
  p.grow = options.grow ?? 420;
  p.width = options.width ?? 3.5;
  p.fadeWidth = options.fadeWidth ?? 4.2;
  p.slot = options.slot ?? 0.9;
  p.maxLife = options.life ?? 0.55;
  p.life = p.maxLife;
}

/** Confetti thrown from a point. */
export function spawnConfetti(system, x, y, count = 24, options = {}) {
  const density = options.density ?? 1;
  const total = Math.max(1, Math.round(count * density));

  for (let i = 0; i < total; i += 1) {
    const angle = options.angle !== undefined ? options.angle + rand(-0.6, 0.6) : rand(0, TAU);
    const velocity = (options.speed ?? 420) * rand(0.4, 1);
    const p = system._claim();
    p.alive = true;
    p.type = TYPE.CONFETTI;
    p.x = x + rand(-6, 6);
    p.y = y + rand(-6, 6);
    p.vx = Math.cos(angle) * velocity;
    p.vy = Math.sin(angle) * velocity;
    p.width = rand(6, 11);
    p.height = rand(9, 16);
    p.rot = rand(0, TAU);
    p.vrot = rand(-7, 7);
    p.spin = rand(0, TAU);
    p.spinSpeed = rand(2, 6);
    p.slot = rand(0.3, 1);
    p.drag = rand(1.1, 2.2);
    p.gravity = rand(0.5, 0.95);
    p.flutterAmp = rand(20, 70);
    p.flutterSpeed = rand(2.5, 6);
    p.phase = rand(0, TAU);
    p.maxLife = rand(6, 12);
    p.life = p.maxLife;
  }
}

/** A soft puff of smoke. */
export function spawnSmoke(system, x, y, options = {}) {
  const p = system._claim();
  p.alive = true;
  p.type = TYPE.SMOKE;
  p.x = x;
  p.y = y;
  p.vx = options.vx ?? rand(-20, 20);
  p.vy = options.vy ?? rand(-30, 10);
  p.radius = options.radius ?? 6;
  p.grow = options.grow ?? 40;
  p.maxLife = options.life ?? 0.6;
  p.life = p.maxLife;
}

/** A balloon drifting up from the bottom. */
export function spawnBalloon(system, x, y, options = {}) {
  const p = system._claim();
  p.alive = true;
  p.type = TYPE.BALLOON;
  p.x = x;
  p.y = y;
  p.vx = options.vx ?? rand(-14, 14);
  p.vy = rand(-70, -40);
  p.width = rand(26, 42);
  p.height = rand(34, 54);
  p.slot = rand(0.3, 0.95);
  p.sway = rand(-1, 1);
  p.swaySpeed = rand(0.7, 1.6);
  p.phase = rand(0, TAU);
  p.rot = 0;
  p.maxLife = options.life ?? 22;
  p.life = p.maxLife;
}

/** Ambient floating motes. */
export function spawnDust(system, width, height, options = {}) {
  const p = system._claim();
  p.alive = true;
  p.type = TYPE.DUST;
  p.x = rand(0, width);
  p.y = rand(0, height);
  p.vx = rand(-8, 8);
  p.vy = rand(-16, -3);
  p.size = rand(0.7, 2.1);
  p.slot = rand(0.6, 1);
  p.twinkle = rand(0, TAU);
  p.twinkleSpeed = rand(1, 3);
  p.alphaScale = options.alphaScale ?? 1;
  p.maxLife = options.life ?? 16;
  p.life = p.maxLife;
}

export { rand, randInt, pick, GRAVITY };

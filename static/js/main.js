/**
 * Entry point: wires the palette, the engine, the audio and the DOM together.
 */

import { AudioEngine } from './audio.js';
import { Engine } from './engine.js';
import { attachInteractions } from './interactions.js';
import { PaletteState } from './palette.js';

const settings = window.__BIRTHDAY__ ?? {
  name: 'friend',
  age: 18,
  palettes: [],
  defaultPalette: 0,
  musicEnabled: true,
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('stage-canvas');
const paletteButton = document.getElementById('palette-button');
const paletteName = document.getElementById('palette-name');
const musicButton = document.getElementById('music-button');
const counterValue = document.getElementById('counter-value');

const palette = new PaletteState(settings.palettes, settings.defaultPalette ?? 0);
const audio = new AudioEngine({ enabled: settings.musicEnabled });

let fireworks = 0;
let themeDirty = true;

/* --------------------------------------------------------------- theme -- */

function applyThemeToDom() {
  const style = document.documentElement.style;
  style.setProperty('--bg-0', palette.backgroundTop);
  style.setProperty('--bg-1', palette.backgroundBottom);
  style.setProperty('--text', palette.textColor);
  style.setProperty('--accent', palette.accentColor);
  palette.ramp.forEach((color, index) => {
    style.setProperty(`--ramp-${index}`, color);
  });
}

function syncPaletteLabel() {
  if (paletteName) {
    paletteName.textContent = palette.name;
  }
}

/* -------------------------------------------------------------- engine -- */

const engine = new Engine(canvas, {
  palette,
  events: {
    frame: (delta) => {
      const changed = palette.update(delta * 1000);
      if (changed || themeDirty) {
        applyThemeToDom();
        themeDirty = false;
      }
    },
    firework: () => {
      fireworks += 1;
      if (counterValue) {
        counterValue.textContent = String(fireworks);
      }
      audio.crackle(0.75);
    },
    finale: () => {
      audio.boom();
    },
  },
});

/* ------------------------------------------------------------- actions -- */

function cyclePalette() {
  // With reduced motion the theme swaps instantly rather than cross-fading.
  const changed = reduceMotion
    ? palette.jumpTo((palette.index + 1) % palette.palettes.length)
    : palette.cycle();
  if (changed) {
    themeDirty = true;
    syncPaletteLabel();
    audio.ping();
  }
}

async function toggleMusic() {
  const enabled = await audio.toggle();
  updateMusicButton(enabled);
}

function updateMusicButton(enabled) {
  if (!musicButton) {
    return;
  }
  const icon = musicButton.querySelector('.hud-icon');
  const label = musicButton.querySelector('.hud-label');
  if (icon) {
    icon.textContent = enabled ? '🔊' : '🔇';
  }
  if (label) {
    label.textContent = enabled ? 'Music on' : 'Music';
  }
  musicButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

function blowCandles() {
  if (!engine.scene.candlesLit) {
    return;
  }
  engine.scene.candlesLit = false;

  const bounds = engine.scene.cakeBounds();
  const spacing = bounds.width / 4;
  for (let i = 0; i < 3; i += 1) {
    engine.smokeAt(bounds.x + spacing * (i + 1), bounds.y - 44, {
      radius: 7,
      grow: 46,
      life: 0.9,
    });
  }

  window.setTimeout(() => engine.finale(), 320);
  window.setTimeout(() => {
    engine.scene.candlesLit = true;
  }, 14000);
}

/* ---------------------------------------------------------------- DOM -- */

paletteButton?.addEventListener('click', cyclePalette);
musicButton?.addEventListener('click', toggleMusic);

attachInteractions(engine, {
  onCake: blowCandles,
  onPalette: cyclePalette,
  onMusic: toggleMusic,
});

/* The title letters drop in on a spring. */
function springDropIn(element, delay) {
  let offset = -170;
  let velocity = 0;
  let rotation = -24;
  let rotationVelocity = 0;
  let previous = performance.now();
  let elapsed = 0;

  const stiffness = 190;
  const damping = 17;

  const step = (now) => {
    const delta = Math.min(0.032, (now - previous) / 1000);
    previous = now;
    elapsed += delta * 1000;

    if (elapsed < delay) {
      requestAnimationFrame(step);
      return;
    }

    const acceleration = (-stiffness * offset - damping * velocity);
    velocity += acceleration * delta;
    offset += velocity * delta;

    const rotationAcceleration = (-stiffness * rotation - damping * rotationVelocity);
    rotationVelocity += rotationAcceleration * delta;
    rotation += rotationVelocity * delta;

    element.style.transform = `translateY(${offset.toFixed(2)}px) rotate(${rotation.toFixed(2)}deg)`;

    if (Math.abs(offset) < 0.05 && Math.abs(velocity) < 0.1 && Math.abs(rotation) < 0.05) {
      element.style.transform = 'translateY(0) rotate(0deg)';
      return;
    }
    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function buildTitle() {
  const words = document.querySelectorAll('.title-word');
  let index = 0;

  for (const word of words) {
    const text = word.textContent.trim();
    word.textContent = '';
    for (const character of text) {
      const span = document.createElement('span');
      span.className = 'title-char';
      span.textContent = character;
      word.appendChild(span);

      if (reduceMotion) {
        continue;
      }
      const delay = 120 + index * 42;
      springDropIn(span, delay);
      index += 1;
    }
  }
}

/* --------------------------------------------------------------- start -- */

function start() {
  applyThemeToDom();
  syncPaletteLabel();
  updateMusicButton(audio.preference);
  buildTitle();

  // Reduced motion still allows interaction, just with fewer particles.
  if (reduceMotion) {
    engine.qualityCap = 0.45;
    engine.quality = 0.45;
  }

  engine.start();

  if (!reduceMotion) {
    // A small welcome volley.
    const volley = [
      { delay: 900, x: 0.26, y: 0.3 },
      { delay: 1300, x: 0.72, y: 0.26 },
      { delay: 1750, x: 0.5, y: 0.2 },
    ];
    for (const shot of volley) {
      window.setTimeout(() => {
        engine.fireworkAt(engine.width * shot.x, engine.height * shot.y, { count: 60 });
      }, shot.delay);
    }

    // Occasional balloons drifting up.
    const balloonTimer = window.setInterval(() => {
      if (Math.random() < 0.7) {
        engine.balloonAt(engine.width * (0.08 + Math.random() * 0.84), engine.height + 40);
      }
    }, 2600);
    window.addEventListener('pagehide', () => window.clearInterval(balloonTimer), { once: true });
  }
}

// Autoplay is blocked until the user interacts with the page, so the music
// waits for the first gesture if it was switched on previously.
function autoStartAudio(event) {
  // If the gesture was on the music button, let the button handle it --
  // otherwise it would switch the music on and immediately straight back off.
  if (musicButton && musicButton.contains(event.target)) {
    return;
  }
  window.removeEventListener('pointerdown', autoStartAudio);
  if (audio.preference && !audio.enabled) {
    audio.enable().then((enabled) => updateMusicButton(enabled));
  }
}

window.addEventListener('pointerdown', autoStartAudio);

// Handy for poking around in the console.
window.__engine = engine;
window.__palette = palette;

start();

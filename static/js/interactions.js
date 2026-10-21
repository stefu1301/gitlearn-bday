/**
 * Pointer, touch and keyboard interaction.
 *
 * Clicks fire fireworks, drags spray confetti, and the cake can be tapped to
 * blow out the candles.
 */

export function attachInteractions(engine, options = {}) {
  const canvas = engine.canvas;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      rect,
    };
  };

  const isOnCake = (x, y) => {
    const bounds = engine.scene.cakeBounds();
    return (
      x >= bounds.x - 30 &&
      x <= bounds.x + bounds.width + 30 &&
      y >= bounds.y - 80 &&
      y <= bounds.y + bounds.height + 26
    );
  };

  const onPointerDown = (event) => {
    const { x, y } = localPoint(event);
    dragging = true;
    lastX = x;
    lastY = y;

    if (typeof canvas.setPointerCapture === 'function') {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* pointer already released -- ignore */
      }
    }

    if (isOnCake(x, y)) {
      options.onCake?.(x, y);
    } else {
      engine.fireworkAt(x, y);
    }
  };

  const onPointerMove = (event) => {
    const { x, y, rect } = localPoint(event);

    engine.parallax.tx = (x / rect.width) * 2 - 1;
    engine.parallax.ty = (y / rect.height) * 2 - 1;

    if (!dragging) {
      return;
    }

    const dx = x - lastX;
    const dy = y - lastY;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) {
      return;
    }

    const steps = Math.min(6, Math.max(1, Math.round(distance / 18)));
    for (let i = 1; i <= steps; i += 1) {
      const px = lastX + (dx * i) / steps;
      const py = lastY + (dy * i) / steps;
      engine.confettiAt(px, py, 4, { speed: 240 });
    }

    lastX = x;
    lastY = y;
  };

  const onPointerUp = (event) => {
    dragging = false;
    if (typeof canvas.releasePointerCapture === 'function') {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'c') {
      options.onPalette?.();
    } else if (key === 'm') {
      options.onMusic?.();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
  };
}

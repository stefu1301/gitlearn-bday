# 🎂 Happy Birthday — anofu

A birthday wish page built with **Flask**, featuring a hand-written canvas
engine: physics-driven confetti, firework bursts with real trail persistence,
a spring-animated headline, a cake you can blow out, and a set of colour
palettes that cross-fade through OKLab.

No build step, no bundler, no node_modules — the front end is plain ES
modules served straight from `static/`.

---

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python app.py                      # http://127.0.0.1:5000
```

Every dependency lives in the project-local `.venv/`, so nothing is installed
into your system Python.

---

## Features

**The animation**
- Fixed-timestep physics loop — identical behaviour at 60Hz and 144Hz
- Confetti with gravity, drag, wind and per-piece flutter
- Fireworks with additive glow and a persistent trail layer
- Streamers, floating balloons, ambient dust, shockwave rings, smoke
- A cake with live candle flames that snuff out when you tap it
- The headline drops in on a spring, letter by letter
- Adaptive quality — the particle budget shrinks on slower devices

**Interaction**
| Action | Result |
|---|---|
| Click / tap | Firework burst at the cursor |
| Drag | Confetti cannon |
| Tap the cake | Blow out the candles → the grand finale |
| Move the pointer | Parallax on the stars and hills |
| `C` | Cycle the colour palette |
| `M` | Toggle the music |

**Colour**
- Six palettes: Ember, Ocean, Neon, Pastel, Gold, Nova
- Cross-fade happens in **OKLab**, so red → blue never passes through mud
- Particles store a *ramp slot* instead of a colour, so confetti already in
  the air changes colour along with the background
- The chosen palette is remembered in `localStorage`

**Audio**
- The "Happy Birthday" melody is synthesised at runtime with the Web Audio
  API — there are no audio files in the repo
- Firework crackle and a finale boom, generated the same way
- Starts muted, because browsers block autoplay

---

## Customising it

Almost everything lives in **`config.py`**:

```python
@dataclass(frozen=True)
class BirthdayConfig:
    name: str = "anofu"
    age: int = 18
    message: str = "Here's to a year of bold dreams..."
    eyebrow: str = "Today is a special day"
    music_enabled: bool = True
    palettes: tuple[Palette, ...] = (EMBER, OCEAN, NEON, PASTEL, GOLD, NOVA)
    default_palette: int = 0
```

Changing the name, the age or the message is a one-line edit — the template
and the JavaScript pick the new values up automatically.

To add a palette, append a `Palette(...)` to the tuple:

```python
MINT = Palette(
    name="Mint",
    bg=("#04211c", "#0b5c4a"),
    ramp=("#062a22", "#0b7d5f", "#3fd0a9", "#a8f0d0", "#e8fff4"),
    text="#eafff6",
    accent="#3fd0a9",
)

PALETTES = (EMBER, OCEAN, NEON, PASTEL, GOLD, NOVA, MINT)
```

**Always append, never insert.** The browser remembers a chosen palette by its
index in this tuple, so dropping a new palette in the middle would silently
change the theme for anyone who has already visited the page.

Each palette has five ramp stops running from darkest to brightest. The
particle engine samples that ramp, so the stops decide the colour of
confetti, fireworks, smoke and highlights automatically.

---

## Project layout

```
app.py                  Flask app factory, routes, error handlers
config.py               The birthday details and the colour palettes
requirements.txt
templates/
  base.html             Page shell
  index.html            The celebration
  404.html
static/
  css/style.css         Page chrome; every colour is a custom property
  js/
    main.js             Entry point: wires everything together
    engine.js           The loop, the fixed timestep, the render pipeline
    particles.js        The particle pool and the spawners
    scene.js            Sky, stars, hills and the cake
    palette.js          Palette state and the cross-fade
    color.js            sRGB ⇄ OKLab conversion and blending
    interactions.js     Pointer, touch and keyboard input
    audio.js            Web Audio synthesis
tests/test_app.py
```

---

## Tests

```bash
source .venv/bin/activate
pytest -q
```

The suite covers the routes, the JSON API, the 404 page and — importantly —
that a name containing markup is escaped rather than rendered.

---

## Deployment

```bash
source .venv/bin/activate
gunicorn --bind 0.0.0.0:8000 app:app
```

`app.py` exposes a module-level `app`, which is what the `app:app` target
points at. `/healthz` returns a small JSON payload for load balancers.

Static files are served by Flask itself. For a busy deployment, put a reverse
proxy (nginx, Caddy) in front of gunicorn and let it serve `static/`.

---

## Accessibility

- `prefers-reduced-motion` is respected: the headline stops springing, the
  palette swaps instead of fading, and the particle budget drops
- The headline carries an `aria-label`, so the letter-splitting animation
  does not confuse a screen reader
- Keyboard shortcuts (`C`, `M`) sit alongside real buttons in the HUD
- All interactive controls are real `<button>` elements with focus styles

"""Personalisation for the birthday page.

Everything the visitor sees -- the name, the age, the message and the colour
palettes -- lives in this file. Editing this file is all that is needed to
re-theme the site; the templates and the JavaScript read these values at
render time.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class Palette:
    """A single colour theme.

    ``ramp`` holds five stops running from darkest to brightest. The particle
    engine samples the ramp to colour confetti, fireworks and smoke, so
    changing these stops re-themes the whole animation.
    """

    name: str
    bg: tuple[str, str]
    ramp: tuple[str, str, str, str, str]
    text: str
    accent: str

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "bg": list(self.bg),
            "ramp": list(self.ramp),
            "text": self.text,
            "accent": self.accent,
        }


EMBER = Palette(
    name="Ember",
    bg=("#1a0508", "#6b1a12"),
    ramp=("#7a1020", "#ff3d00", "#ff6d1f", "#ffa62b", "#ffd166"),
    text="#fff4e6",
    accent="#ff8a3d",
)

OCEAN = Palette(
    name="Ocean",
    bg=("#04121f", "#0b4a63"),
    ramp=("#06283d", "#0b6e8f", "#18a7b8", "#5fe1d6", "#b8fff1"),
    text="#eafcff",
    accent="#5fe1d6",
)

NEON = Palette(
    name="Neon",
    bg=("#12041f", "#3d0a52"),
    ramp=("#2b0a3d", "#8b00c7", "#ff00a8", "#00f0ff", "#c6ff00"),
    text="#fdf4ff",
    accent="#ff00a8",
)

PASTEL = Palette(
    name="Pastel",
    bg=("#241430", "#6b4468"),
    ramp=("#3e2a47", "#b983a8", "#f2b5d4", "#a8e6cf", "#fff3b0"),
    text="#fff6fb",
    accent="#f2b5d4",
)

GOLD = Palette(
    name="Gold",
    bg=("#1d1402", "#6b4a00"),
    ramp=("#3d2b00", "#9c6b00", "#e3a008", "#ffc93c", "#ffefad"),
    text="#fff8e1",
    accent="#ffc93c",
)

PALETTES: tuple[Palette, ...] = (EMBER, OCEAN, NEON, PASTEL, GOLD)


@dataclass(frozen=True)
class BirthdayConfig:
    """The person being celebrated."""

    name: str = "anofu"
    age: int = 18
    message: str = "Here's to a year of bold dreams, big wins and even better stories."
    eyebrow: str = "Today is a special day"
    music_enabled: bool = True
    palettes: tuple[Palette, ...] = field(default_factory=lambda: PALETTES)
    default_palette: int = 0

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "age": self.age,
            "message": self.message,
            "eyebrow": self.eyebrow,
            "musicEnabled": self.music_enabled,
            "defaultPalette": self.default_palette,
            "palettes": [p.as_dict() for p in self.palettes],
        }

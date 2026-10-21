"""Tests for the birthday application."""

import pytest

from app import create_app
from config import BirthdayConfig, Palette


@pytest.fixture()
def client():
    application = create_app()
    application.config.update(TESTING=True)
    return application.test_client()


def test_index_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert "anofu" in body
    assert "18" in body


def test_index_embeds_the_config_as_json(client):
    body = client.get("/").get_data(as_text=True)
    assert "window.__BIRTHDAY__" in body
    assert '"name": "anofu"' in body
    assert '"age": 18' in body


def test_index_includes_every_palette(client):
    body = client.get("/").get_data(as_text=True)
    for name in ("Ember", "Ocean", "Neon", "Pastel", "Gold"):
        assert name in body


def test_api_config(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "anofu"
    assert payload["age"] == 18
    assert len(payload["palettes"]) == 5
    assert payload["palettes"][0]["name"] == "Ember"


def test_healthz(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_unknown_page_returns_404(client):
    response = client.get("/nope")
    assert response.status_code == 404
    assert "404" in response.get_data(as_text=True)


def test_config_is_escaped_in_the_page():
    """A name containing markup must not be rendered as markup."""
    nasty = BirthdayConfig(name="<script>alert(1)</script>")
    application = create_app(nasty)
    client = application.test_client()
    body = client.get("/").get_data(as_text=True)
    assert "<script>alert(1)</script>" not in body
    assert "&lt;script&gt;" in body


def test_custom_palette_is_used():
    palette = Palette(
        name="Test",
        bg=("#000000", "#111111"),
        ramp=("#111111", "#222222", "#333333", "#444444", "#555555"),
        text="#ffffff",
        accent="#ff0000",
    )
    details = BirthdayConfig(palettes=(palette,), default_palette=0)
    application = create_app(details)
    client = application.test_client()
    payload = client.get("/api/config").get_json()
    assert payload["palettes"][0]["name"] == "Test"

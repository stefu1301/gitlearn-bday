"""Flask application for the birthday page.

The server does very little: it reads the birthday details from ``config.py``
and hands them to the template. All of the animation happens in the browser.
"""

from __future__ import annotations

from flask import Flask, jsonify, render_template

from config import BirthdayConfig


def create_app(birthday: BirthdayConfig | None = None) -> Flask:
    """Build the Flask application.

    Args:
        birthday: Optional override, mostly useful for tests.
    """
    app = Flask(__name__)
    details = birthday or BirthdayConfig()
    app.config["BIRTHDAY"] = details

    @app.get("/")
    def index():
        return render_template("index.html", birthday=details)

    @app.get("/api/config")
    def api_config():
        """The birthday details as JSON, for any client that wants them."""
        return jsonify(details.as_dict())

    @app.get("/healthz")
    def healthz():
        """Liveness probe for deployments."""
        return jsonify(status="ok", name=details.name)

    @app.errorhandler(404)
    def not_found(error):
        return render_template("404.html", birthday=details), 404

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)

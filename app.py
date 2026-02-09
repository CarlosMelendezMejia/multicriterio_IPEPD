# app.py
import os
from flask import Flask
from flask_cors import CORS
from config import Config

# Blueprints
from routes.auth import bp as auth_bp
from routes.eval import bp as eval_bp
from routes.api import bp as api_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS (si lo estás usando)
    cors_origins = app.config.get("CORS_ORIGINS", "*")
    CORS(app, resources={r"/api/*": {"origins": cors_origins}})

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(eval_bp)
    app.register_blueprint(api_bp, url_prefix="/api")

    # Healthcheck simple
    @app.get("/health")
    def health():
        return {"ok": True}

    return app


# >>> Esto es clave: instancia global para Flask CLI y para wsgi.py
app = create_app()


# >>> Opción 2: ejecutar directamente
if __name__ == "__main__":
    # Puedes controlar con env vars si quieres
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"

    app.run(host=host, port=port, debug=debug)

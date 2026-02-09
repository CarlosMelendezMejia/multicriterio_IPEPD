# app.py
# ------------------------------------------------------------
# Aplicación Flask para el sistema multicriterio IPEPD.
# - Frontend: HTML/CSS/JS + Bootstrap (templates + static)
# - Backend: Flask + MySQL 5.7 (mysqlclient / MySQLdb)
# - Incluye: create_app(), registro de blueprints, teardown DB, sesión, errores.
# ------------------------------------------------------------

import os
from flask import Flask, redirect, url_for
from flask_cors import CORS

# ============================================================
# Configuración
# ============================================================

class Config:
    # Seguridad / sesión
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    # Si estás detrás de HTTPS en producción, activa:
    # SESSION_COOKIE_SECURE = True

    # Base de datos
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "multicriterio_IPEPD")

    # App
    JSON_SORT_KEYS = False


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS (útil si en algún momento consumes API desde otro origen)
    CORS(app)

    # ============================================================
    # DB teardown
    # ============================================================
    # Nota: db.py debe exponer close_db(e=None)
    try:
        from db import close_db
        app.teardown_appcontext(close_db)
    except Exception:
        # Si db.py aún no existe, no rompemos el arranque.
        # En cuanto lo agregues, esto quedará activo.
        pass

    # ============================================================
    # Blueprints
    # ============================================================
    # Nota: estos módulos se crearán en pasos posteriores.
    # Se registran condicionalmente para permitir desarrollo incremental.
    try:
        from routes.auth import bp as auth_bp
        app.register_blueprint(auth_bp)
    except Exception:
        pass

    try:
        from routes.eval import bp as eval_bp
        app.register_blueprint(eval_bp)
    except Exception:
        pass

    try:
        from routes.api import bp as api_bp
        app.register_blueprint(api_bp, url_prefix="/api")
    except Exception:
        pass

    # ============================================================
    # Rutas base
    # ============================================================
    @app.get("/")
    def index():
        # Primer punto de entrada: login
        # (auth.login se definirá en routes/auth.py)
        try:
            return redirect(url_for("auth.login"))
        except Exception:
            # Si aún no existe blueprint auth, manda a una ruta placeholder.
            return redirect("/login")

    # Placeholder mínimo para no fallar si aún no creas templates/login
    @app.get("/login")
    def login_placeholder():
        return (
            "Login aún no implementado. "
            "Crea routes/auth.py y templates/login.html.",
            200,
            {"Content-Type": "text/plain; charset=utf-8"},
        )

    # ============================================================
    # Error handlers (básicos)
    # ============================================================
    @app.errorhandler(404)
    def not_found(_):
        return (
            "404 - Recurso no encontrado",
            404,
            {"Content-Type": "text/plain; charset=utf-8"},
        )

    @app.errorhandler(500)
    def server_error(_):
        return (
            "500 - Error interno del servidor",
            500,
            {"Content-Type": "text/plain; charset=utf-8"},
        )

    return app


# Permite:
#   flask --app app run --debug
app = create_app()

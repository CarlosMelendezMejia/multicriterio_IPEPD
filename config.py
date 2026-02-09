# config.py
# ------------------------------------------------------------
# Configuración centralizada para multicriterio IPEPD.
# Se alimenta por variables de entorno (.env recomendado).
# Compatible con MySQL 5.7 y despliegue con wsgi/gunicorn.
# ------------------------------------------------------------

import os


def _get_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "y", "on")


class Config:
    # =========================
    # Seguridad / Sesión
    # =========================
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")

    # Actívalo en producción si usas HTTPS
    SESSION_COOKIE_SECURE = _get_bool("SESSION_COOKIE_SECURE", False)

    # =========================
    # Base de datos (MySQL 5.7)
    # =========================
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "multicriterio_IPEPD")

    # =========================
    # App
    # =========================
    ENV = os.getenv("FLASK_ENV", "production")
    DEBUG = _get_bool("FLASK_DEBUG", False)

    JSON_SORT_KEYS = False

    # Rol admin (por nombre)
    # Recomendación: rol.nombre = 'ADMIN'
    ADMIN_ROLE_NAME = os.getenv("ADMIN_ROLE_NAME", "ADMIN")

    # Permite restringir CORS si lo necesitas; por ahora permite todo.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

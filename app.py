"""
Multicriterio IPEPD - FES Aragón
Aplicación Flask para ranking multicriterio (categorías e ítems) por instrumento.
Adaptado al patrón de tu app funcional (logging + mysql.connector pooling).
"""

import os
import logging
from logging.handlers import TimedRotatingFileHandler
from contextlib import contextmanager

from flask import Flask, request, redirect, url_for, session
from flask_cors import CORS
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling, Error as MySQLError

# Blueprints (tu estructura modular)
from routes.auth import bp as auth_bp
from routes.eval import bp as eval_bp
from routes.api import bp as api_bp


# -----------------------------------------------------------------------------
# Logging (idéntico enfoque al de tu otra app)
# -----------------------------------------------------------------------------
def configure_logging():
    level_name = (os.getenv("LOG_LEVEL") or "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_log_dir = os.path.join(base_dir, "logs")
    log_dir = os.getenv("LOG_DIR") or default_log_dir
    log_file = os.getenv("LOG_FILE") or os.path.join(log_dir, "app.log")

    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)s pid=%(process)d %(name)s: %(message)s"
    )

    root = logging.getLogger()
    root.setLevel(level)

    has_file_handler = any(isinstance(h, TimedRotatingFileHandler) for h in root.handlers)
    if not has_file_handler:
        file_handler = TimedRotatingFileHandler(
            log_file,
            when="midnight",
            backupCount=int(os.getenv("LOG_BACKUP_COUNT", "14")),
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(fmt)
        root.addHandler(file_handler)

    has_stream_handler = any(isinstance(h, logging.StreamHandler) for h in root.handlers)
    if not has_stream_handler:
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(level)
        stream_handler.setFormatter(fmt)
        root.addHandler(stream_handler)

    logging.getLogger("werkzeug").setLevel(level)


# -----------------------------------------------------------------------------
# Cargar env + logging
# -----------------------------------------------------------------------------
load_dotenv()
configure_logging()
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Flask app
# -----------------------------------------------------------------------------
app = Flask(__name__)

# Soportar tanto SECRET_KEY como FLASK_SECRET_KEY (igual que tu otra app)
app.secret_key = os.getenv("SECRET_KEY") or os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-production")

# CORS (si lo necesitas; en general solo para /api)
cors_origins = os.getenv("CORS_ORIGINS", "*")
CORS(app, resources={r"/api/*": {"origins": cors_origins}})


@app.get("/")
def index():
    """Entrada por defecto: redirige a login o dashboard."""
    if session.get("usuario_id"):
        return redirect(url_for("eval.dashboard"))
    return redirect(url_for("auth.login"))


@app.before_request
def log_request_summary():
    """Log de monitoreo: solo rutas relevantes."""
    try:
        path = request.path or ""
        if path.startswith("/api/") or path.startswith("/admin"):
            ip = request.headers.get("X-Forwarded-For", request.remote_addr)
            logger.info("HTTP %s %s ip=%s", request.method, path, ip)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# DB Config + Pool (mysql.connector)
# -----------------------------------------------------------------------------
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "multicriterio_IPEPD"),
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    "autocommit": True,
}

connection_pool = None


def init_connection_pool():
    """Inicializa el pool una vez por proceso."""
    global connection_pool
    if connection_pool is not None:
        return connection_pool

    try:
        pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
        connection_pool = pooling.MySQLConnectionPool(
            pool_name=os.getenv("DB_POOL_NAME", "multicriterio_pool"),
            pool_size=pool_size,
            pool_reset_session=True,
            **DB_CONFIG,
        )
        logger.info(
            "Pool MySQL listo (pool_size=%s host=%s port=%s db=%s user=%s)",
            pool_size,
            DB_CONFIG.get("host"),
            DB_CONFIG.get("port"),
            DB_CONFIG.get("database"),
            DB_CONFIG.get("user"),
        )
        return connection_pool
    except MySQLError:
        logger.exception(
            "Error al crear pool MySQL (host=%s port=%s db=%s user=%s)",
            DB_CONFIG.get("host"),
            DB_CONFIG.get("port"),
            DB_CONFIG.get("database"),
            DB_CONFIG.get("user"),
        )
        connection_pool = None
        return None


# Intento inicial
init_connection_pool()


def db_conn():
    pool = init_connection_pool()
    if not pool:
        raise Exception("Pool de conexiones no disponible")
    return pool.get_connection()


@contextmanager
def db_cursor(dictionary=False):
    """Cursor protegido: cierra cursor y regresa conexión al pool."""
    conn = None
    cursor = None
    try:
        conn = db_conn()
        cursor = conn.cursor(dictionary=dictionary)
        yield conn, cursor
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                logger.exception("Error al cerrar cursor")
        if conn is not None:
            try:
                conn.close()
            except Exception:
                logger.exception("Error al cerrar conexión")


@contextmanager
def db_transaction(dictionary=False):
    """Transacción protegida: commit/rollback y cierre seguro."""
    conn = None
    cursor = None
    try:
        conn = db_conn()
        cursor = conn.cursor(dictionary=dictionary)
        yield conn, cursor
        conn.commit()
    except Exception:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                logger.exception("Error al hacer rollback")
        raise
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                logger.exception("Error al cerrar cursor")
        if conn is not None:
            try:
                conn.close()
            except Exception:
                logger.exception("Error al cerrar conexión")


# -----------------------------------------------------------------------------
# Exponer helpers DB al resto del proyecto
# (para que routes/* puedan hacer: from app import db_cursor, db_transaction)
# -----------------------------------------------------------------------------
app.db_cursor = db_cursor
app.db_transaction = db_transaction


# -----------------------------------------------------------------------------
# Blueprints
# -----------------------------------------------------------------------------
app.register_blueprint(auth_bp)            # /login, /logout, etc.
app.register_blueprint(eval_bp)            # /dashboard, /evaluar/...
app.register_blueprint(api_bp, url_prefix="/api")  # /api/*


# -----------------------------------------------------------------------------
# Healthcheck
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True, "db": DB_CONFIG.get("database")}


# -----------------------------------------------------------------------------
# Entry point (Opción 2: python app.py)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "1") == "1",
    )

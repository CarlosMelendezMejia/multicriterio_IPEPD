# db.py
# ------------------------------------------------------------
# Capa DB para Multicriterio IPEPD
# - Compatible con Windows (sin MySQLdb/mysqlclient)
# - Usa mysql.connector + pooling
# - Mantiene API: query_one, query_all, execute, executemany, commit, rollback
# ------------------------------------------------------------

import os
import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling, Error as MySQLError

load_dotenv()
logger = logging.getLogger(__name__)

# -----------------------------
# Configuración
# -----------------------------
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "multicriterio_IPEPD"),
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    # Ojo: autocommit=False para permitir commit/rollback explícitos
    "autocommit": False,
}

_POOL_NAME = os.getenv("DB_POOL_NAME", "multicriterio_pool")
_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))

_pool: Optional[pooling.MySQLConnectionPool] = None

# Conexión "actual" (simple, global por proceso)
# Nota: esto funciona bien para desarrollo. Para producción multi-thread,
# lo ideal es usar conexión por request (podemos hacerlo después).
_conn = None


def _init_pool() -> pooling.MySQLConnectionPool:
    global _pool
    if _pool is not None:
        return _pool

    try:
        _pool = pooling.MySQLConnectionPool(
            pool_name=_POOL_NAME,
            pool_size=_POOL_SIZE,
            pool_reset_session=True,
            **DB_CONFIG,
        )
        logger.info(
            "MySQL pool listo pool=%s size=%s host=%s port=%s db=%s user=%s",
            _POOL_NAME, _POOL_SIZE, DB_CONFIG["host"], DB_CONFIG["port"],
            DB_CONFIG["database"], DB_CONFIG["user"]
        )
        return _pool
    except MySQLError:
        logger.exception("No se pudo inicializar el pool MySQL")
        raise


def get_connection():
    """
    Regresa una conexión reutilizable. Para desarrollo, mantenemos una conexión
    global abierta y la reutilizamos. Si se cae, se recrea.
    """
    global _conn
    if _conn is not None:
        try:
            if _conn.is_connected():
                return _conn
        except Exception:
            _conn = None

    pool = _init_pool()
    _conn = pool.get_connection()
    return _conn


def _cursor(dictionary: bool = True):
    conn = get_connection()
    return conn.cursor(dictionary=dictionary)


# -----------------------------
# API pública (compatible)
# -----------------------------
def query_one(sql: str, params: Optional[Sequence[Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Ejecuta SELECT y retorna 1 fila (dict) o None.
    """
    cur = None
    try:
        cur = _cursor(dictionary=True)
        cur.execute(sql, params or ())
        row = cur.fetchone()
        return row
    except MySQLError:
        logger.exception("DB query_one error")
        raise
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


def query_all(sql: str, params: Optional[Sequence[Any]] = None) -> List[Dict[str, Any]]:
    """
    Ejecuta SELECT y retorna lista de filas (dict).
    """
    cur = None
    try:
        cur = _cursor(dictionary=True)
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        return rows or []
    except MySQLError:
        logger.exception("DB query_all error")
        raise
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


def execute(sql: str, params: Optional[Sequence[Any]] = None) -> int:
    """
    Ejecuta INSERT/UPDATE/DELETE.
    Retorna:
      - lastrowid si es INSERT y existe,
      - si no, retorna rowcount.
    """
    cur = None
    try:
        cur = _cursor(dictionary=False)
        cur.execute(sql, params or ())
        # mysql.connector expone lastrowid
        last_id = getattr(cur, "lastrowid", None)
        if last_id:
            return int(last_id)
        return int(cur.rowcount)
    except MySQLError:
        logger.exception("DB execute error")
        raise
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


def executemany(sql: str, seq_params: Sequence[Sequence[Any]]) -> int:
    """
    Ejecuta múltiples filas (bulk).
    Retorna rowcount total aproximado.
    """
    cur = None
    try:
        cur = _cursor(dictionary=False)
        cur.executemany(sql, seq_params)
        return int(cur.rowcount)
    except MySQLError:
        logger.exception("DB executemany error")
        raise
    finally:
        if cur is not None:
            try:
                cur.close()
            except Exception:
                pass


def commit():
    """
    Commit explícito.
    """
    conn = get_connection()
    try:
        conn.commit()
    except MySQLError:
        logger.exception("DB commit error")
        raise


def rollback():
    """
    Rollback explícito.
    """
    conn = get_connection()
    try:
        conn.rollback()
    except MySQLError:
        logger.exception("DB rollback error")
        raise


def close_connection():
    """
    Cierra la conexión global (útil en shutdown).
    """
    global _conn
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
        _conn = None

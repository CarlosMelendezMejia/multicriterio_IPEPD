# db.py
# ------------------------------------------------------------
# Capa simple de acceso a MySQL (MySQL 5.7) usando mysqlclient (MySQLdb).
# - Una conexión por request (Flask g)
# - Helpers: query_one, query_all, execute, executemany, commit, rollback
# ------------------------------------------------------------

from flask import current_app, g
import MySQLdb


def get_db():
    """
    Obtiene (o crea) una conexión MySQL asociada al request actual.
    """
    if "db_conn" not in g:
        cfg = current_app.config
        g.db_conn = MySQLdb.connect(
            host=cfg["DB_HOST"],
            user=cfg["DB_USER"],
            passwd=cfg["DB_PASSWORD"],
            db=cfg["DB_NAME"],
            port=cfg["DB_PORT"],
            charset="utf8mb4",
            use_unicode=True,
            autocommit=False,  # control explícito de transacciones
        )
    return g.db_conn


def close_db(e=None):
    """
    Cierra la conexión MySQL al finalizar el request.
    Flask llama esto via app.teardown_appcontext(close_db).
    """
    conn = g.pop("db_conn", None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


def _dict_cursor(conn):
    return conn.cursor(MySQLdb.cursors.DictCursor)


def query_all(sql: str, params=None):
    """
    Ejecuta un SELECT y regresa lista de dicts.
    """
    conn = get_db()
    cur = _dict_cursor(conn)
    try:
        cur.execute(sql, params or ())
        return cur.fetchall()
    finally:
        cur.close()


def query_one(sql: str, params=None):
    """
    Ejecuta un SELECT y regresa un dict o None.
    """
    conn = get_db()
    cur = _dict_cursor(conn)
    try:
        cur.execute(sql, params or ())
        return cur.fetchone()
    finally:
        cur.close()


def execute(sql: str, params=None):
    """
    Ejecuta INSERT/UPDATE/DELETE y regresa lastrowid cuando aplica.
    """
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(sql, params or ())
        return cur.lastrowid
    finally:
        cur.close()


def executemany(sql: str, seq_params):
    """
    Ejecuta bulk inserts/updates.
    """
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.executemany(sql, seq_params)
        return cur.rowcount
    finally:
        cur.close()


def commit():
    get_db().commit()


def rollback():
    get_db().rollback()

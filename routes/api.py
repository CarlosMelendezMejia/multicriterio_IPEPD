# routes/api.py
# ------------------------------------------------------------
# API JSON para flujo multicriterio IPEPD (MySQL 5.7)
#
# Endpoints:
#   POST /api/evaluacion/<instrumento_id>/init
#   GET  /api/catalogo/<instrumento_id>/categorias
#   GET  /api/catalogo/<instrumento_id>/items/<categoria_code>
#   POST /api/evaluacion/<evaluacion_id>/categorias
#   POST /api/evaluacion/<evaluacion_id>/items/<categoria_code>
#   GET  /api/evaluacion/<evaluacion_id>/resumen
#   POST /api/evaluacion/<evaluacion_id>/submit
#   POST /api/admin/evaluacion/<evaluacion_id>/reopen
#
# Notas clave:
# - "submitted" es solo lectura para usuario normal; admin puede reabrir.
# - Guardado idempotente: DELETE + INSERT (en transacción).
# - Restricciones UNIQUE en DB aseguran no repetición de ranks.
# ------------------------------------------------------------

from flask import Blueprint, jsonify, request, session, current_app
from db import query_one, query_all, execute, executemany, commit, rollback

bp = Blueprint("api", __name__)


# =========================
# Helpers
# =========================

def _require_login():
    return "usuario_id" in session


def _usuario_id() -> int:
    return int(session["usuario_id"])


def _is_admin() -> bool:
    return bool(session.get("is_admin", False))


def _json_error(msg: str, code: int = 400, extra=None):
    payload = {"error": msg}
    if extra:
        payload.update(extra)
    return jsonify(payload), code


def _is_duplicate_error(exc: Exception) -> bool:
    # MySQLdb IntegrityError -> args: (1062, "Duplicate entry ...")
    try:
        return hasattr(exc, "args") and len(exc.args) > 0 and int(exc.args[0]) == 1062
    except Exception:
        return False


def _get_eval(evaluacion_id: int):
    return query_one(
        "SELECT evaluacion_id, instrumento_id, usuario_id, status, submitted_at "
        "FROM evaluacion WHERE evaluacion_id=%s",
        (evaluacion_id,)
    )


def _ensure_editable(ev) -> bool:
    """
    Devuelve True si es editable con la sesión actual.
    - Si status=draft => editable
    - Si status=submitted => solo editable si admin
    """
    if not ev:
        return False
    if ev["status"] == "draft":
        return True
    return _is_admin()


def _snapshot_role(usuario_id: int):
    """
    Obtiene rol_id y peso actuales del usuario para snapshot.
    """
    row = query_one(
        "SELECT u.rol_id, r.peso "
        "FROM usuario u JOIN rol r ON r.rol_id = u.rol_id "
        "WHERE u.usuario_id=%s",
        (usuario_id,)
    )
    if not row:
        return None
    return int(row["rol_id"]), int(row["peso"])


def _count_categorias(instrumento_id: int) -> int:
    row = query_one(
        "SELECT COUNT(*) AS total FROM categoria WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )
    return int(row["total"]) if row else 0


def _categoria_code_por_orden(instrumento_id: int, orden: int):
    row = query_one(
        "SELECT categoria_code FROM categoria "
        "WHERE instrumento_id=%s AND orden=%s AND is_active=1",
        (instrumento_id, orden)
    )
    return row["categoria_code"] if row else None


# =========================
# Catálogo
# =========================

@bp.get("/catalogo/<int:instrumento_id>/categorias")
def catalogo_categorias(instrumento_id: int):
    if not _require_login():
        return _json_error("unauthorized", 401)

    rows = query_all(
        "SELECT categoria_code, orden, nombre, objetivo "
        "FROM categoria WHERE instrumento_id=%s AND is_active=1 "
        "ORDER BY orden",
        (instrumento_id,)
    )
    return jsonify(rows)


@bp.get("/catalogo/<int:instrumento_id>/items/<categoria_code>")
def catalogo_items(instrumento_id: int, categoria_code: str):
    if not _require_login():
        return _json_error("unauthorized", 401)

    rows = query_all(
        "SELECT item_id, orden, codigo_visible, contenido, parent_item_id "
        "FROM item "
        "WHERE instrumento_id=%s AND categoria_code=%s AND is_active=1 "
        "ORDER BY orden",
        (instrumento_id, categoria_code)
    )
    # Coerce parent_item_id to int or null for JSON
    for r in rows:
        r["parent_item_id"] = int(r["parent_item_id"]) if r.get("parent_item_id") else None
    return jsonify(rows)


# =========================
# Evaluación: init
# =========================

@bp.post("/evaluacion/<int:instrumento_id>/init")
def init_evaluacion(instrumento_id: int):
    """
    Crea o recupera evaluación para (usuario_id, instrumento_id).
    Devuelve:
      - evaluacion_id
      - status
      - total_categorias
      - next_step: {view: 'categorias'|'items'|'resumen', categoria_orden?}
    """
    if not _require_login():
        return _json_error("unauthorized", 401)

    uid = _usuario_id()

    # Validar instrumento existe
    ins = query_one(
        "SELECT instrumento_id FROM instrumento WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )
    if not ins:
        return _json_error("instrumento_not_found", 404)

    # Buscar evaluación existente
    ev = query_one(
        "SELECT evaluacion_id, status FROM evaluacion WHERE usuario_id=%s AND instrumento_id=%s",
        (uid, instrumento_id)
    )

    total_cats = _count_categorias(instrumento_id)

    if not ev:
        snap = _snapshot_role(uid)
        if not snap:
            return _json_error("usuario_rol_not_found", 400)

        rol_id_snap, peso_snap = snap
        try:
            eval_id = execute(
                "INSERT INTO evaluacion (instrumento_id, usuario_id, rol_id_snapshot, rol_peso_snapshot, status) "
                "VALUES (%s,%s,%s,%s,'draft')",
                (instrumento_id, uid, rol_id_snap, peso_snap)
            )
            commit()
            ev = {"evaluacion_id": eval_id, "status": "draft"}
        except Exception:
            rollback()
            return _json_error("db_error_init", 500)

    evaluacion_id = int(ev["evaluacion_id"])
    status = ev["status"]

    # Determinar siguiente paso:
    # 1) si no hay ranking de categorías -> categorias
    # 2) si hay categorías, verificar progreso en ítems por categoría
    # 3) si completo -> resumen
    cat_rank_count = query_one(
        "SELECT COUNT(*) AS cnt FROM evaluacion_categoria WHERE evaluacion_id=%s",
        (evaluacion_id,)
    )["cnt"]

    if int(cat_rank_count) < total_cats:
        next_step = {"view": "categorias"}
        return jsonify({
            "evaluacion_id": evaluacion_id,
            "status": status,
            "total_categorias": total_cats,
            "next_step": next_step
        })

    # categorías ya completas, buscar primera categoría incompleta en ítems
    # calculamos por catálogo cuántos ítems tiene cada categoría y comparamos con evaluacion_item
    cats = query_all(
        "SELECT categoria_code, orden FROM categoria WHERE instrumento_id=%s AND is_active=1 ORDER BY orden",
        (instrumento_id,)
    )

    for c in cats:
        code = c["categoria_code"]
        orden = int(c["orden"])

        # Total rankeable items (main items + sub-items) for this category
        total_items = query_one(
            "SELECT COUNT(*) AS total FROM item WHERE instrumento_id=%s AND categoria_code=%s AND is_active=1",
            (instrumento_id, code)
        )["total"]

        # Count only items that are NOT parent-headers (i.e. items with no children)
        # Parent-headers have children, so they are still ranked in the main group.
        # Actually all items get ranked, so total_items is correct.

        saved_items = query_one(
            "SELECT COUNT(*) AS total FROM evaluacion_item WHERE evaluacion_id=%s AND categoria_code=%s",
            (evaluacion_id, code)
        )["total"]

        if int(saved_items) < int(total_items):
            next_step = {"view": "items", "categoria_orden": orden}
            break
    else:
        next_step = {"view": "resumen"}

    return jsonify({
        "evaluacion_id": evaluacion_id,
        "status": status,
        "total_categorias": total_cats,
        "next_step": next_step
    })


# =========================
# Guardar ranking de categorías
# =========================

@bp.post("/evaluacion/<int:evaluacion_id>/categorias")
def guardar_ranking_categorias(evaluacion_id: int):
    if not _require_login():
        return _json_error("unauthorized", 401)

    ev = _get_eval(evaluacion_id)
    if not ev:
        return _json_error("evaluacion_not_found", 404)

    # Solo dueño o admin
    if int(ev["usuario_id"]) != _usuario_id() and not _is_admin():
        return _json_error("forbidden", 403)

    if not _ensure_editable(ev):
        return _json_error("evaluacion_submitted_readonly", 403)

    data = request.get_json(silent=True) or {}
    ranks = data.get("ranks", [])

    if not isinstance(ranks, list) or len(ranks) == 0:
        return _json_error("payload_invalid", 400)

    instrumento_id = int(ev["instrumento_id"])

    # Validar que todas las categorías existan y pertenezcan al instrumento
    valid_codes = {r["categoria_code"] for r in query_all(
        "SELECT categoria_code FROM categoria WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )}

    # Normalizar y validar
    rows = []
    for r in ranks:
        code = (r.get("categoria_code") or "").strip()
        val = r.get("rank_value")
        if not code or not isinstance(val, int):
            return _json_error("payload_invalid_rank", 400)
        if code not in valid_codes:
            return _json_error("categoria_invalida", 400, {"categoria_code": code})
        if val < 1:
            return _json_error("rank_value_min_1", 400, {"categoria_code": code})
        rows.append((evaluacion_id, instrumento_id, code, val))

    # Idempotente: borrar e insertar todo
    try:
        execute("DELETE FROM evaluacion_categoria WHERE evaluacion_id=%s", (evaluacion_id,))
        executemany(
            "INSERT INTO evaluacion_categoria (evaluacion_id, instrumento_id, categoria_code, rank_value) "
            "VALUES (%s,%s,%s,%s)",
            rows
        )
        commit()
        return jsonify({"ok": True})
    except Exception as e:
        rollback()
        if _is_duplicate_error(e):
            return _json_error(
                "rank_duplicado",
                400,
                {"detalle": "Los valores deben ser únicos del 1 al N (sin repetición)."}
            )
        return _json_error("db_error_guardar_categorias", 500)


# =========================
# Guardar ranking de ítems por categoría
# =========================

@bp.post("/evaluacion/<int:evaluacion_id>/items/<categoria_code>")
def guardar_ranking_items(evaluacion_id: int, categoria_code: str):
    if not _require_login():
        return _json_error("unauthorized", 401)

    ev = _get_eval(evaluacion_id)
    if not ev:
        return _json_error("evaluacion_not_found", 404)

    # Solo dueño o admin
    if int(ev["usuario_id"]) != _usuario_id() and not _is_admin():
        return _json_error("forbidden", 403)

    if not _ensure_editable(ev):
        return _json_error("evaluacion_submitted_readonly", 403)

    data = request.get_json(silent=True) or {}
    ranks = data.get("ranks", [])

    if not isinstance(ranks, list) or len(ranks) == 0:
        return _json_error("payload_invalid", 400)

    instrumento_id = int(ev["instrumento_id"])
    categoria_code = categoria_code.strip()

    # Validar categoría existe y pertenece al instrumento
    cat = query_one(
        "SELECT categoria_code FROM categoria WHERE instrumento_id=%s AND categoria_code=%s AND is_active=1",
        (instrumento_id, categoria_code)
    )
    if not cat:
        return _json_error("categoria_not_found", 404)

    # Validar items válidos de esa categoría
    items_validos = query_all(
        "SELECT item_id, parent_item_id FROM item WHERE instrumento_id=%s AND categoria_code=%s AND is_active=1",
        (instrumento_id, categoria_code)
    )
    valid_item_map = {int(x["item_id"]): (int(x["parent_item_id"]) if x.get("parent_item_id") else None) for x in items_validos}
    if not valid_item_map:
        return _json_error("categoria_sin_items", 400)

    rows = []
    for r in ranks:
        item_id = r.get("item_id")
        val = r.get("rank_value")
        rg = r.get("rank_group", 0)
        if not isinstance(item_id, int) or not isinstance(val, int):
            return _json_error("payload_invalid_rank", 400)
        if item_id not in valid_item_map:
            return _json_error("item_invalido", 400, {"item_id": item_id})
        if val < 1:
            return _json_error("rank_value_min_1", 400, {"item_id": item_id})
        # Derive rank_group from item’s parent_item_id (0 for main items, parent_id for sub-items)
        parent = valid_item_map[item_id]
        rank_group = parent if parent else 0
        rows.append((evaluacion_id, item_id, categoria_code, rank_group, val))

    # Validate uniqueness per rank_group
    from collections import Counter
    group_vals = Counter()
    for (_eid, _iid, _cc, rg, rv) in rows:
        key = (rg, rv)
        group_vals[key] += 1
        if group_vals[key] > 1:
            return _json_error(
                "rank_duplicado", 400,
                {"detalle": f"Valor {rv} repetido en grupo de ranking {rg}."}
            )

    try:
        # Idempotente por categoría
        execute(
            "DELETE FROM evaluacion_item WHERE evaluacion_id=%s AND categoria_code=%s",
            (evaluacion_id, categoria_code)
        )
        executemany(
            "INSERT INTO evaluacion_item (evaluacion_id, item_id, categoria_code, rank_group, rank_value) "
            "VALUES (%s,%s,%s,%s,%s)",
            rows
        )
        commit()
        return jsonify({"ok": True})
    except Exception as e:
        rollback()
        if _is_duplicate_error(e):
            return _json_error(
                "rank_duplicado",
                400,
                {"detalle": "Los valores deben ser únicos (sin repetición) dentro de cada grupo de ranking."}
            )
        return _json_error("db_error_guardar_items", 500)


# =========================
# Resumen
# =========================

@bp.get("/evaluacion/<int:evaluacion_id>/resumen")
def resumen(evaluacion_id: int):
    if not _require_login():
        return _json_error("unauthorized", 401)

    ev = _get_eval(evaluacion_id)
    if not ev:
        return _json_error("evaluacion_not_found", 404)

    if int(ev["usuario_id"]) != _usuario_id() and not _is_admin():
        return _json_error("forbidden", 403)

    instrumento_id = int(ev["instrumento_id"])

    instrumento = query_one(
        "SELECT instrumento_id, nombre FROM instrumento WHERE instrumento_id=%s",
        (instrumento_id,)
    )

    # Categorías con rank
    categorias = query_all(
        "SELECT c.categoria_code, c.orden, c.nombre, c.objetivo, ec.rank_value "
        "FROM categoria c "
        "LEFT JOIN evaluacion_categoria ec "
        "  ON ec.evaluacion_id=%s AND ec.categoria_code=c.categoria_code "
        "WHERE c.instrumento_id=%s AND c.is_active=1 "
        "ORDER BY c.orden",
        (evaluacion_id, instrumento_id)
    )

    # Ítems con rank (ordenados por categoria/orden)
    items = query_all(
        "SELECT c.categoria_code, c.orden AS categoria_orden, c.nombre AS categoria_nombre, "
        "       i.item_id, i.orden AS item_orden, i.codigo_visible, i.contenido, "
        "       i.parent_item_id, ei.rank_value, ei.rank_group "
        "FROM categoria c "
        "JOIN item i ON i.instrumento_id=c.instrumento_id AND i.categoria_code=c.categoria_code AND i.is_active=1 "
        "LEFT JOIN evaluacion_item ei ON ei.evaluacion_id=%s AND ei.item_id=i.item_id "
        "WHERE c.instrumento_id=%s AND c.is_active=1 "
        "ORDER BY c.orden, i.orden",
        (evaluacion_id, instrumento_id)
    )
    # Coerce parent_item_id
    for it in items:
        it["parent_item_id"] = int(it["parent_item_id"]) if it.get("parent_item_id") else None
        it["rank_group"] = int(it["rank_group"]) if it.get("rank_group") is not None else 0

    return jsonify({
        "evaluacion": {
            "evaluacion_id": int(ev["evaluacion_id"]),
            "instrumento_id": instrumento_id,
            "instrumento_nombre": instrumento["nombre"] if instrumento else None,
            "usuario_id": int(ev["usuario_id"]),
            "status": ev["status"],
            "submitted_at": ev["submitted_at"],
        },
        "categorias": categorias,
        "items": items
    })


# =========================
# Submit
# =========================

@bp.post("/evaluacion/<int:evaluacion_id>/submit")
def submit(evaluacion_id: int):
    if not _require_login():
        return _json_error("unauthorized", 401)

    ev = _get_eval(evaluacion_id)
    if not ev:
        return _json_error("evaluacion_not_found", 404)

    # Solo dueño o admin
    if int(ev["usuario_id"]) != _usuario_id() and not _is_admin():
        return _json_error("forbidden", 403)

    if ev["status"] == "submitted":
        return jsonify({"ok": True, "status": "submitted"})

    instrumento_id = int(ev["instrumento_id"])

    # Validación mínima: que categorías estén completas y que cada categoría tenga ítems completos
    total_cats = _count_categorias(instrumento_id)
    cat_rank_count = query_one(
        "SELECT COUNT(*) AS cnt FROM evaluacion_categoria WHERE evaluacion_id=%s",
        (evaluacion_id,)
    )["cnt"]

    if int(cat_rank_count) < total_cats:
        return _json_error("faltan_ranks_categorias", 400)

    cats = query_all(
        "SELECT categoria_code FROM categoria WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )
    for c in cats:
        code = c["categoria_code"]
        total_items = query_one(
            "SELECT COUNT(*) AS total FROM item WHERE instrumento_id=%s AND categoria_code=%s AND is_active=1",
            (instrumento_id, code)
        )["total"]
        saved_items = query_one(
            "SELECT COUNT(*) AS total FROM evaluacion_item WHERE evaluacion_id=%s AND categoria_code=%s",
            (evaluacion_id, code)
        )["total"]
        if int(saved_items) < int(total_items):
            return _json_error("faltan_ranks_items", 400, {"categoria_code": code})

    try:
        execute(
            "UPDATE evaluacion SET status='submitted', submitted_at=NOW() WHERE evaluacion_id=%s",
            (evaluacion_id,)
        )
        commit()
        return jsonify({"ok": True, "status": "submitted"})
    except Exception:
        rollback()
        return _json_error("db_error_submit", 500)


# =========================
# Admin: reopen
# =========================

@bp.post("/admin/evaluacion/<int:evaluacion_id>/reopen")
def admin_reopen(evaluacion_id: int):
    if not _require_login():
        return _json_error("unauthorized", 401)
    if not _is_admin():
        return _json_error("forbidden", 403)

    ev = _get_eval(evaluacion_id)
    if not ev:
        return _json_error("evaluacion_not_found", 404)

    if ev["status"] != "submitted":
        return jsonify({"ok": True, "status": ev["status"]})

    # Variante compatible sin columnas reopened_*:
    # - status=draft
    # - submitted_at=NULL
    # Si agregaste columnas reopened_at/reopened_by en schema, puedes habilitarlo aquí.

    try:
        # Intento con trazabilidad si existen columnas (sin romper si no existen):
        # 1) probamos update extendido; si falla por columna, hacemos update simple.
        try:
            execute(
                "UPDATE evaluacion "
                "SET status='draft', submitted_at=NULL, reopened_at=NOW(), reopened_by=%s "
                "WHERE evaluacion_id=%s",
                (_usuario_id(), evaluacion_id)
            )
        except Exception:
            execute(
                "UPDATE evaluacion SET status='draft', submitted_at=NULL WHERE evaluacion_id=%s",
                (evaluacion_id,)
            )

        commit()
        return jsonify({"ok": True, "status": "draft"})
    except Exception:
        rollback()
        return _json_error("db_error_reopen", 500)

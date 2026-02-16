# routes/eval.py
# ------------------------------------------------------------
# Vistas HTML del flujo de evaluación:
# - GET  /dashboard
# - GET  /evaluar/<instrumento_id>/categorias
# - GET  /evaluar/<instrumento_id>/items/<categoria_orden>
# - GET  /evaluar/<instrumento_id>/resumen
#
# Nota:
# - Persistencia/guardado se hará vía API (routes/api.py) usando fetch en JS.
# - Aquí solo renderizamos vistas y pasamos contexto mínimo (ids, flags, etc.).
# - "submitted" será solo lectura para usuario; admin podrá reabrir via API.
# ------------------------------------------------------------

from flask import Blueprint, render_template, session, redirect, url_for, abort, flash
from db import query_all, query_one

bp = Blueprint("eval", __name__)


def require_login():
    return "usuario_id" in session


def get_usuario_id() -> int:
    return int(session["usuario_id"])


def is_admin() -> bool:
    return bool(session.get("is_admin", False))


def _block_admin():
    """Redirige admins al panel de administración; ellos no evalúan."""
    if is_admin():
        flash("Los administradores no pueden realizar evaluaciones.", "warning")
        return redirect(url_for("admin.panel"))
    return None


@bp.get("/dashboard")
def dashboard():
    if not require_login():
        return redirect(url_for("auth.login"))

    blocked = _block_admin()
    if blocked:
        return blocked

    usuario_id = get_usuario_id()

    # Instrumentos del menú (por ahora: los que estén cargados en DB)
    instrumentos = query_all(
        "SELECT instrumento_id, nombre "
        "FROM instrumento "
        "WHERE is_active=1 "
        "ORDER BY instrumento_id"
    )

    # Estado por instrumento para este usuario (no iniciado / draft / submitted)
    evals = query_all(
        "SELECT instrumento_id, status, created_at, submitted_at, evaluacion_id "
        "FROM evaluacion "
        "WHERE usuario_id=%s",
        (usuario_id,)
    )
    eval_by_instr = {int(e["instrumento_id"]): e for e in evals}

    # Construir lista enriquecida para template
    instrumentos_view = []
    for ins in instrumentos:
        iid = int(ins["instrumento_id"])
        ev = eval_by_instr.get(iid)
        if not ev:
            estado = "no_iniciado"
        else:
            estado = ev["status"]  # 'draft' | 'submitted'
        instrumentos_view.append({
            "instrumento_id": iid,
            "nombre": ins["nombre"],
            "estado": estado,
            "evaluacion_id": ev["evaluacion_id"] if ev else None,
            "created_at": ev["created_at"] if ev else None,
            "submitted_at": ev["submitted_at"] if ev else None,
        })

    return render_template(
        "dashboard.html",
        instrumentos=instrumentos_view,
        is_admin=is_admin()
    )


@bp.get("/evaluar/<int:instrumento_id>/categorias")
def categorias(instrumento_id: int):
    """
    Primera pantalla del instrumento: ranking de categorías.
    El JS llamará /api/evaluacion/<instrumento_id>/init para obtener evaluacion_id
    y /api/catalogo/<instrumento_id>/categorias para cargar catálogo.
    """
    if not require_login():
        return redirect(url_for("auth.login"))

    blocked = _block_admin()
    if blocked:
        return blocked

    ins = query_one(
        "SELECT instrumento_id, nombre FROM instrumento WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )
    if not ins:
        abort(404)

    return render_template(
        "categorias.html",
        instrumento_id=int(ins["instrumento_id"]),
        instrumento_nombre=ins["nombre"],
        is_admin=is_admin()
    )


@bp.get("/evaluar/<int:instrumento_id>/items/<int:categoria_orden>")
def items(instrumento_id: int, categoria_orden: int):
    """
    Pantalla de ranking de ítems por categoría (una categoría por página).
    categoria_orden es el orden oficial 1..N, usado para avanzar secuencialmente.
    JS:
      - init evaluacion
      - obtener categoria_code por orden
      - cargar items
      - guardar y navegar a la siguiente
    """
    if not require_login():
        return redirect(url_for("auth.login"))

    blocked = _block_admin()
    if blocked:
        return blocked

    ins = query_one(
        "SELECT instrumento_id, nombre FROM instrumento WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )
    if not ins:
        abort(404)

    # Validar que exista esa categoría en ese instrumento
    cat = query_one(
        "SELECT categoria_code, orden, nombre "
        "FROM categoria "
        "WHERE instrumento_id=%s AND orden=%s AND is_active=1",
        (instrumento_id, categoria_orden)
    )
    if not cat:
        abort(404)

    # Total de categorías para navegación (progreso)
    total_categorias = query_one(
        "SELECT COUNT(*) AS total FROM categoria WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )["total"]

    return render_template(
        "items.html",
        instrumento_id=int(ins["instrumento_id"]),
        instrumento_nombre=ins["nombre"],
        categoria_orden=int(cat["orden"]),
        categoria_code=cat["categoria_code"],
        categoria_nombre=cat["nombre"],
        total_categorias=int(total_categorias),
        is_admin=is_admin()
    )


@bp.get("/evaluar/<int:instrumento_id>/resumen")
def resumen(instrumento_id: int):
    """
    Vista de confirmación:
    - El JS consumirá /api/evaluacion/<evaluacion_id>/resumen
    - Se mostrará resumen de respuestas y botón Enviar.
    - Si admin: botón Reabrir (cuando esté submitted).
    """
    if not require_login():
        return redirect(url_for("auth.login"))

    blocked = _block_admin()
    if blocked:
        return blocked

    ins = query_one(
        "SELECT instrumento_id, nombre FROM instrumento WHERE instrumento_id=%s AND is_active=1",
        (instrumento_id,)
    )
    if not ins:
        abort(404)

    # Para facilitar, intentamos obtener evaluacion_id (si existe)
    ev = query_one(
        "SELECT evaluacion_id, status, submitted_at "
        "FROM evaluacion "
        "WHERE usuario_id=%s AND instrumento_id=%s",
        (get_usuario_id(), instrumento_id)
    )

    return render_template(
        "resumen.html",
        instrumento_id=int(ins["instrumento_id"]),
        instrumento_nombre=ins["nombre"],
        evaluacion_id=int(ev["evaluacion_id"]) if ev else None,
        evaluacion_status=ev["status"] if ev else None,
        submitted_at=ev["submitted_at"] if ev else None,
        is_admin=is_admin()
    )

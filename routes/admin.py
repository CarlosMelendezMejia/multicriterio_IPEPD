# routes/admin.py
# ------------------------------------------------------------
# Panel de Administración:
# - GET /admin       : panel principal con tabs (Usuarios, Resultados)
#
# Solo accesible para usuarios con is_admin=True en sesión.
# ------------------------------------------------------------

from flask import Blueprint, render_template, session, redirect, url_for, flash

bp = Blueprint("admin", __name__)


def _require_admin():
    """Verifica que el usuario esté autenticado y sea admin."""
    if not session.get("usuario_id"):
        return redirect(url_for("auth.login"))
    if not session.get("is_admin"):
        flash("Acceso restringido a administradores.", "danger")
        return redirect(url_for("eval.dashboard"))
    return None


@bp.get("/admin")
def panel():
    blocked = _require_admin()
    if blocked:
        return blocked

    return render_template("admin.html")

# routes/auth.py
# ------------------------------------------------------------
# Autenticación:
# - GET  /login  : formulario
# - POST /login  : valida usuario + password_sha256 (hex SHA-256)
# - GET  /logout : cierra sesión
#
# Sesión:
#   session["usuario_id"], session["rol_id"], session["is_admin"]
# Admin se determina por rol.nombre == Config.ADMIN_ROLE_NAME (default: "ADMIN")
# ------------------------------------------------------------

import hashlib
from flask import (
    Blueprint, render_template, request, redirect,
    url_for, session, flash, current_app
)
from db import query_one

bp = Blueprint("auth", __name__)


def sha256_hex(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _is_admin_role_name(role_name: str) -> bool:
    admin_name = (current_app.config.get("ADMIN_ROLE_NAME") or "ADMIN").strip().upper()
    return (role_name or "").strip().upper() == admin_name


@bp.get("/login")
def login():
    # Si ya hay sesión, manda al panel correcto
    if session.get("usuario_id"):
        if session.get("is_admin"):
            return redirect(url_for("admin.panel"))
        return redirect(url_for("eval.dashboard"))
    return render_template("login.html")


@bp.post("/login")
def login_post():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")

    if not username or not password:
        flash("Por favor ingresa usuario y contraseña.", "warning")
        return redirect(url_for("auth.login"))

    # Trae el usuario
    user = query_one(
        "SELECT usuario_id, nombre_usuario, password_sha256, rol_id, is_active "
        "FROM usuario WHERE nombre_usuario=%s",
        (username,)
    )

    if not user or int(user["is_active"]) != 1:
        flash("Usuario no válido o inactivo.", "danger")
        return redirect(url_for("auth.login"))

    # Validar SHA-256 (hex)
    if sha256_hex(password) != user["password_sha256"]:
        flash("Credenciales incorrectas.", "danger")
        return redirect(url_for("auth.login"))

    # Determinar admin por rol.nombre
    rol = query_one("SELECT nombre FROM rol WHERE rol_id=%s", (user["rol_id"],))
    is_admin = _is_admin_role_name(rol["nombre"] if rol else "")

    # Guardar sesión
    session.clear()
    session["usuario_id"] = int(user["usuario_id"])
    session["rol_id"] = int(user["rol_id"])
    session["is_admin"] = bool(is_admin)

    # Admin va al panel de administración, evaluador al dashboard
    if is_admin:
        return redirect(url_for("admin.panel"))
    return redirect(url_for("eval.dashboard"))


@bp.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))

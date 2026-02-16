/* static/js/admin_users.js
 * ------------------------------------------------------------
 * CRUD de usuarios para el panel de administración.
 * Usa la API:
 *   GET    /api/admin/users
 *   POST   /api/admin/users
 *   PUT    /api/admin/users/:id
 *   DELETE /api/admin/users/:id
 *   GET    /api/admin/roles
 * ------------------------------------------------------------ */

(function () {
  const { qs, qsa, fetchJson, showAlert, escapeHtml } = window.API;

  let allRoles = [];
  let allUsers = [];

  // ---------- Bootstrap modal ----------
  let modalEl, modal;

  function getModal() {
    if (!modal) {
      modalEl = qs("#userModal");
      modal = new bootstrap.Modal(modalEl);
    }
    return modal;
  }

  // ---------- Cargar roles ----------
  async function loadRoles() {
    try {
      allRoles = await fetchJson("/api/admin/roles");
      const sel = qs("#uf_rol");
      sel.innerHTML = '<option value="">Seleccionar…</option>';
      allRoles.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.rol_id;
        opt.textContent = `${r.nombre} (peso ${r.peso})`;
        sel.appendChild(opt);
      });
    } catch (e) {
      showAlert("Error al cargar roles: " + e.message);
    }
  }

  // ---------- Cargar usuarios ----------
  async function loadUsers() {
    try {
      allUsers = await fetchJson("/api/admin/users");
      renderTable();
    } catch (e) {
      showAlert("Error al cargar usuarios: " + e.message);
    }
  }

  function renderTable() {
    const tbody = qs("#tblUsers tbody");
    if (!allUsers.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = allUsers.map(u => {
      const fullName = [u.grado, u.nombre, u.apellido_paterno, u.apellido_materno]
        .filter(Boolean).join(" ");
      const statusBadge = parseInt(u.is_active)
        ? '<span class="badge text-bg-success">Activo</span>'
        : '<span class="badge text-bg-secondary">Inactivo</span>';
      const rolBadge = (u.rol_nombre || "").toUpperCase() === "ADMIN"
        ? `<span class="badge text-bg-warning">${escapeHtml(u.rol_nombre)}</span>`
        : `<span class="badge text-bg-info">${escapeHtml(u.rol_nombre)}</span>`;

      return `<tr>
        <td>${u.usuario_id}</td>
        <td><strong>${escapeHtml(u.nombre_usuario)}</strong></td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(u.grado || "—")}</td>
        <td>${rolBadge}</td>
        <td>${statusBadge}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1 btn-edit" data-id="${u.usuario_id}" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
              <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
            </svg>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${u.usuario_id}" data-name="${escapeHtml(u.nombre_usuario)}" title="Desactivar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5z"/>
            </svg>
          </button>
        </td>
      </tr>`;
    }).join("");
  }

  // ---------- Abrir modal para NUEVO usuario ----------
  function openNewUser() {
    qs("#userModalLabel").textContent = "Nuevo usuario";
    qs("#uf_id").value = "";
    qs("#uf_username").value = "";
    qs("#uf_password").value = "";
    qs("#uf_nombre").value = "";
    qs("#uf_ap").value = "";
    qs("#uf_am").value = "";
    qs("#uf_grado").value = "";
    qs("#uf_rol").value = "";
    qs("#uf_active").value = "1";
    qs("#uf_password").setAttribute("required", "");
    qs("#pwdReq").classList.remove("d-none");
    qs("#pwdHint").textContent = "Mínimo 4 caracteres.";
    getModal().show();
  }

  // ---------- Abrir modal para EDITAR usuario ----------
  function openEditUser(userId) {
    const u = allUsers.find(x => x.usuario_id === userId);
    if (!u) return;

    qs("#userModalLabel").textContent = "Editar usuario";
    qs("#uf_id").value = u.usuario_id;
    qs("#uf_username").value = u.nombre_usuario;
    qs("#uf_password").value = "";
    qs("#uf_nombre").value = u.nombre;
    qs("#uf_ap").value = u.apellido_paterno;
    qs("#uf_am").value = u.apellido_materno || "";
    qs("#uf_grado").value = u.grado || "";
    qs("#uf_rol").value = u.rol_id;
    qs("#uf_active").value = parseInt(u.is_active) ? "1" : "0";
    qs("#uf_password").removeAttribute("required");
    qs("#pwdReq").classList.add("d-none");
    qs("#pwdHint").textContent = "Dejar vacío para mantener la contraseña actual.";
    getModal().show();
  }

  // ---------- Guardar usuario (crear o editar) ----------
  async function saveUser() {
    const id = qs("#uf_id").value;
    const isNew = !id;

    const payload = {
      nombre_usuario: qs("#uf_username").value.trim(),
      nombre: qs("#uf_nombre").value.trim(),
      apellido_paterno: qs("#uf_ap").value.trim(),
      apellido_materno: qs("#uf_am").value.trim(),
      grado: qs("#uf_grado").value.trim(),
      rol_id: parseInt(qs("#uf_rol").value) || null,
      is_active: parseInt(qs("#uf_active").value),
    };

    const pwd = qs("#uf_password").value;
    if (isNew) {
      if (!pwd || pwd.length < 4) {
        showAlert("La contraseña debe tener al menos 4 caracteres.", "warning");
        return;
      }
      payload.password = pwd;
    } else if (pwd) {
      if (pwd.length < 4) {
        showAlert("La contraseña debe tener al menos 4 caracteres.", "warning");
        return;
      }
      payload.password = pwd;
    }

    if (!payload.nombre_usuario || !payload.nombre || !payload.apellido_paterno || !payload.rol_id) {
      showAlert("Completa los campos obligatorios.", "warning");
      return;
    }

    const btn = qs("#btnSaveUser");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando…';

    try {
      if (isNew) {
        await fetchJson("/api/admin/users", { method: "POST", body: payload });
        showAlert("Usuario creado exitosamente.", "success");
      } else {
        await fetchJson(`/api/admin/users/${id}`, { method: "PUT", body: payload });
        showAlert("Usuario actualizado exitosamente.", "success");
      }
      getModal().hide();
      await loadUsers();
    } catch (e) {
      showAlert("Error: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  }

  // ---------- Desactivar usuario ----------
  async function deleteUser(userId, userName) {
    if (!confirm(`¿Desactivar al usuario "${userName}"?\nEl usuario no podrá iniciar sesión.`)) {
      return;
    }

    try {
      await fetchJson(`/api/admin/users/${userId}`, { method: "DELETE" });
      showAlert(`Usuario "${userName}" desactivado.`, "success");
      await loadUsers();
    } catch (e) {
      showAlert("Error: " + e.message);
    }
  }

  // ---------- Event delegation ----------
  function wireEvents() {
    qs("#btnNewUser").addEventListener("click", openNewUser);
    qs("#btnSaveUser").addEventListener("click", saveUser);

    qs("#tblUsers").addEventListener("click", e => {
      const editBtn = e.target.closest(".btn-edit");
      if (editBtn) {
        openEditUser(parseInt(editBtn.dataset.id));
        return;
      }
      const delBtn = e.target.closest(".btn-delete");
      if (delBtn) {
        deleteUser(parseInt(delBtn.dataset.id), delBtn.dataset.name);
      }
    });

    // Submit form on Enter key inside modal
    qs("#userForm").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveUser();
      }
    });
  }

  // ---------- Init ----------
  async function init() {
    wireEvents();
    await loadRoles();
    await loadUsers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

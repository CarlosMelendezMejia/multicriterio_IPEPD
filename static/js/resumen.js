/* static/js/resumen.js
 * ------------------------------------------------------------
 * Vista: templates/resumen.html
 * - Carga evaluación (init si hace falta), y luego GET resumen
 * - Render categorías + ítems
 * - Enviar: POST submit
 * - Admin: Reabrir si status=submitted
 * ------------------------------------------------------------ */

(async function () {
  const { fetchJson, qs, showAlert, escapeHtml } = window.API;
  const ctx = window.IPEPD_CTX || {};

  const instrumentoId = ctx.instrumentoId;
  let evaluacionId = ctx.evaluacionId; // puede venir null si no existía
  const isAdmin = String(ctx.isAdmin) === "true";

  const statusText = qs("#statusText");
  const evalIdText = qs("#evalIdText");
  const container = qs("#resumenContainer");
  const btnEnviar = qs("#btnEnviar");
  const btnReabrir = qs("#btnReabrir");

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }

  function setEvalId(id) {
    if (evalIdText) evalIdText.textContent = id ? `Evaluación #${id}` : "";
  }

  function groupItemsByCategoria(items) {
    const map = new Map();
    for (const it of items) {
      const key = it.categoria_code;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return map;
  }

  function renderResumen(data) {
    const ev = data.evaluacion || {};
    const categorias = data.categorias || [];
    const items = data.items || [];

    const itemsByCat = groupItemsByCategoria(items);

    let html = `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2">
          <span class="badge ${ev.status === "submitted" ? "text-bg-success" : "text-bg-info"}">
            ${escapeHtml(ev.status || "draft")}
          </span>
          ${ev.submitted_at ? `<span class="text-muted small">Enviado: ${escapeHtml(ev.submitted_at)}</span>` : ""}
        </div>
      </div>

      <h2 class="h6">Ranking de categorías</h2>
      <div class="table-responsive mb-4">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th style="width:80px;">Rank</th>
              <th>Categoría</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const c of categorias) {
      html += `
        <tr>
          <td><span class="badge text-bg-dark">${c.rank_value ?? "—"}</span></td>
          <td>
            <div class="fw-semibold">${escapeHtml(c.nombre)}</div>
            <div class="text-muted small">${escapeHtml(c.categoria_code)}</div>
          </td>
        </tr>
      `;
    }

    html += `</tbody></table></div>`;

    // Ítems por categoría
    html += `<h2 class="h6">Ranking de ítems por categoría</h2>`;

    for (const c of categorias) {
      const code = c.categoria_code;
      const lista = itemsByCat.get(code) || [];

      // Separate main items and sub-items
      const mainItems = lista.filter(it => !it.parent_item_id);
      const subByParent = new Map();
      for (const it of lista) {
        if (it.parent_item_id) {
          const pid = it.parent_item_id;
          if (!subByParent.has(pid)) subByParent.set(pid, []);
          subByParent.get(pid).push(it);
        }
      }

      html += `
        <div class="mt-3">
          <div class="fw-semibold">${escapeHtml(c.nombre)} <span class="text-muted small">(${escapeHtml(code)})</span></div>
          <div class="table-responsive mt-2">
            <table class="table table-sm align-middle">
              <thead>
                <tr>
                  <th style="width:80px;">Rank</th>
                  <th>Ítem</th>
                </tr>
              </thead>
              <tbody>
      `;

      for (const it of mainItems) {
        html += `
          <tr>
            <td><span class="badge text-bg-dark">${it.rank_value ?? "—"}</span></td>
            <td>
              <div class="text-muted small">${escapeHtml(it.codigo_visible || "")}</div>
              <div>${escapeHtml(it.contenido || "")}</div>
            </td>
          </tr>
        `;

        // Render sub-items indented
        const subs = subByParent.get(it.item_id) || [];
        for (const sub of subs) {
          html += `
            <tr class="sub-item-row">
              <td><span class="badge text-bg-secondary">${sub.rank_value ?? "—"}</span></td>
              <td class="sub-item-cell">
                <div class="text-muted small">${escapeHtml(sub.codigo_visible || "")}</div>
                <div>${escapeHtml(sub.contenido || "")}</div>
              </td>
            </tr>
          `;
        }
      }

      html += `</tbody></table></div></div>`;
    }

    container.innerHTML = html;

    // Admin: mostrar botón reabrir solo si está submitted
    if (isAdmin && btnReabrir) {
      if (ev.status === "submitted") {
        btnReabrir.classList.remove("d-none");
      } else {
        btnReabrir.classList.add("d-none");
      }
    }

    // Si está submitted y NO admin, deshabilitar enviar (solo lectura)
    if (btnEnviar) {
      btnEnviar.disabled = (ev.status === "submitted" && !isAdmin);
      if (ev.status === "submitted" && !isAdmin) {
        btnEnviar.textContent = "Enviado";
      } else {
        btnEnviar.textContent = "Enviar";
      }
    }

    setStatus("Listo.");
  }

  async function initIfNeeded() {
    if (evaluacionId) return evaluacionId;
    const initResp = await fetchJson(`/api/evaluacion/${instrumentoId}/init`, { method: "POST" });
    evaluacionId = initResp.evaluacion_id;
    return evaluacionId;
  }

  async function loadResumen() {
    try {
      setStatus("Inicializando...");
      const id = await initIfNeeded();
      setEvalId(id);

      setStatus("Cargando resumen...");
      const data = await fetchJson(`/api/evaluacion/${id}/resumen`);
      renderResumen(data);
    } catch (e) {
      console.error(e);
      showAlert(e.message || "No se pudo cargar el resumen.");
      setStatus("Error.");
    }
  }

  async function enviar() {
    try {
      if (!evaluacionId) return;
      btnEnviar.disabled = true;
      btnEnviar.textContent = "Enviando...";

      await fetchJson(`/api/evaluacion/${evaluacionId}/submit`, { method: "POST" });
      showAlert("Evaluación enviada correctamente.", "success");

      // Regresar al menú
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch (e) {
      console.error(e);
      showAlert(e.message || "No se pudo enviar la evaluación.");
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
    }
  }

  async function reabrir() {
    try {
      if (!evaluacionId) return;
      btnReabrir.disabled = true;
      btnReabrir.textContent = "Reabriendo...";

      await fetchJson(`/api/admin/evaluacion/${evaluacionId}/reopen`, { method: "POST" });
      showAlert("Evaluación reabierta. Ahora es editable.", "warning");

      // Regresar al inicio del flujo del instrumento
      setTimeout(() => {
        window.location.href = `/evaluar/${instrumentoId}/categorias`;
      }, 500);
    } catch (e) {
      console.error(e);
      showAlert(e.message || "No se pudo reabrir la evaluación.");
    } finally {
      btnReabrir.disabled = false;
      btnReabrir.textContent = "Reabrir (Admin)";
    }
  }

  btnEnviar?.addEventListener("click", enviar);
  btnReabrir?.addEventListener("click", reabrir);

  if (!instrumentoId) {
    showAlert("Falta contexto del instrumento.", "danger");
    return;
  }

  await loadResumen();
})();

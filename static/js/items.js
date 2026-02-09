/* static/js/items.js
 * ------------------------------------------------------------
 * Vista: templates/items.html
 * Flujo:
 *  1) POST /api/evaluacion/<instrumento_id>/init -> evaluacion_id
 *  2) GET  /api/catalogo/<instrumento_id>/items/<categoria_code>
 *  3) GET  /api/evaluacion/<evaluacion_id>/resumen (prefill ranks de esa categoría)
 *  4) Render ranking 1..M (sin repetición)
 *  5) POST /api/evaluacion/<evaluacion_id>/items/<categoria_code>
 *  6) Navega a siguiente categoría o /resumen
 * ------------------------------------------------------------ */

(async function () {
  const { fetchJson, qs, showAlert, escapeHtml } = window.API;
  const ctx = window.IPEPD_CTX || {};

  const instrumentoId = ctx.instrumentoId;
  const categoriaOrden = ctx.categoriaOrden;
  const categoriaCode = ctx.categoriaCode;
  const totalCategorias = ctx.totalCategorias;

  const statusText = qs("#statusText");
  const evalIdText = qs("#evalIdText");
  const container = qs("#itemsContainer");
  const btnGuardar = qs("#btnGuardarContinuar");

  let evaluacionId = null;
  let items = [];
  let existingRanks = new Map(); // item_id -> rank_value

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }

  function setEvalId(id) {
    if (evalIdText) evalIdText.textContent = id ? `Evaluación #${id}` : "";
  }

  function buildOptions(n, selected) {
    let html = `<option value="">—</option>`;
    for (let i = 1; i <= n; i++) {
      const sel = (selected === i) ? "selected" : "";
      html += `<option value="${i}" ${sel}>${i}</option>`;
    }
    return html;
  }

  function collectSelections() {
    const selects = Array.from(container.querySelectorAll("select[data-item]"));
    const ranks = [];

    for (const s of selects) {
      const itemId = Number(s.getAttribute("data-item"));
      const v = s.value ? Number(s.value) : null;
      if (!v || Number.isNaN(v)) {
        return { ok: false, error: "Debes asignar un valor a todos los ítems de la categoría." };
      }
      ranks.push({ item_id: itemId, rank_value: v });
    }

    const used = new Set();
    for (const r of ranks) {
      if (used.has(r.rank_value)) {
        return { ok: false, error: "Los valores deben ser únicos (sin repetición) dentro de la categoría." };
      }
      used.add(r.rank_value);
    }
    return { ok: true, ranks };
  }

  function render() {
    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `<div class="text-muted">No hay ítems para esta categoría.</div>`;
      return;
    }

    const m = items.length;

    let html = `
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Ítem</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const it of items) {
      const selected = existingRanks.has(it.item_id)
        ? Number(existingRanks.get(it.item_id))
        : null;

      html += `
        <tr>
          <td>
            <select class="form-select form-select-sm" data-item="${it.item_id}">
              ${buildOptions(m, selected)}
            </select>
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(it.codigo_visible || "")}</div>
            <div>${escapeHtml(it.contenido)}</div>
          </td>
        </tr>
      `;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  async function init() {
    try {
      setStatus("Inicializando evaluación...");
      const initResp = await fetchJson(`/api/evaluacion/${instrumentoId}/init`, { method: "POST" });
      evaluacionId = initResp.evaluacion_id;
      setEvalId(evaluacionId);

      setStatus("Cargando ítems...");
      items = await fetchJson(`/api/catalogo/${instrumentoId}/items/${encodeURIComponent(categoriaCode)}`);

      setStatus("Cargando respuestas previas...");
      const resumen = await fetchJson(`/api/evaluacion/${evaluacionId}/resumen`);
      existingRanks.clear();

      // Prellenar solo ranks de esta categoría
      for (const it of (resumen.items || [])) {
        if (it.categoria_code === categoriaCode && it.rank_value !== null && it.rank_value !== undefined) {
          existingRanks.set(Number(it.item_id), Number(it.rank_value));
        }
      }

      render();
      setStatus("Listo. Asigna valores 1..M (sin repetición).");
    } catch (e) {
      console.error(e);
      showAlert(e.message || "Error al cargar la pantalla de ítems.");
      setStatus("Error.");
    }
  }

  async function guardarYContinuar() {
    try {
      const res = collectSelections();
      if (!res.ok) {
        showAlert(res.error, "warning");
        return;
      }

      btnGuardar.disabled = true;
      btnGuardar.textContent = "Guardando...";

      await fetchJson(`/api/evaluacion/${evaluacionId}/items/${encodeURIComponent(categoriaCode)}`, {
        method: "POST",
        body: { ranks: res.ranks },
      });

      // Navegar a la siguiente categoría o resumen
      const nextOrden = categoriaOrden + 1;
      if (nextOrden <= totalCategorias) {
        window.location.href = `/evaluar/${instrumentoId}/items/${nextOrden}`;
      } else {
        window.location.href = `/evaluar/${instrumentoId}/resumen`;
      }
    } catch (e) {
      console.error(e);
      showAlert(e.message || "No se pudo guardar el ranking de ítems.");
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Guardar y continuar";
    }
  }

  if (!instrumentoId || !categoriaCode) {
    showAlert("Falta contexto del instrumento/categoría.", "danger");
    return;
  }

  btnGuardar?.addEventListener("click", guardarYContinuar);
  await init();
})();

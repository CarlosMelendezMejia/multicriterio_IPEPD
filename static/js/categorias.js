/* static/js/categorias.js
 * ------------------------------------------------------------
 * Vista: templates/categorias.html
 * Flujo:
 *  1) POST /api/evaluacion/<instrumento_id>/init  -> evaluacion_id
 *  2) GET  /api/catalogo/<instrumento_id>/categorias
 *  3) GET  /api/evaluacion/<evaluacion_id>/resumen (para prellenar ranks ya guardados)
 *  4) Render tabla con select 1..N (sin repetición)
 *  5) POST /api/evaluacion/<evaluacion_id>/categorias
 *  6) Redirect -> /evaluar/<instrumento_id>/items/1
 * ------------------------------------------------------------ */

(async function () {
  const { fetchJson, qs, showAlert, escapeHtml } = window.API;
  const instrumentoId = window.IPEPD_CTX?.instrumentoId;

  const statusText = qs("#statusText");
  const evalIdText = qs("#evalIdText");
  const container = qs("#categoriasContainer");
  const btnGuardar = qs("#btnGuardarContinuar");

  let evaluacionId = null;
  let categorias = [];
  let existingRanks = new Map(); // categoria_code -> rank_value
  let lastConflictAt = 0;

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
    const selects = Array.from(container.querySelectorAll("select[data-cat]"));
    const ranks = [];
    for (const s of selects) {
      const code = s.getAttribute("data-cat");
      const v = s.value ? Number(s.value) : null;
      if (!v || Number.isNaN(v)) {
        return { ok: false, error: "Debes asignar un valor a todas las categorías." };
      }
      ranks.push({ categoria_code: code, rank_value: v });
    }

    // validar no repetición
    const used = new Set();
    for (const r of ranks) {
      if (used.has(r.rank_value)) {
        return { ok: false, error: "Los valores deben ser únicos (sin repetición)." };
      }
      used.add(r.rank_value);
    }
    return { ok: true, ranks };
  }

  function refreshUniqueOptions() {
    const selects = Array.from(container.querySelectorAll("select[data-cat]"));
    const used = new Map(); // value -> select

    for (const s of selects) {
      if (s.value) used.set(String(s.value), s);
    }

    for (const s of selects) {
      for (const opt of Array.from(s.options)) {
        if (!opt.value) continue;
        const owner = used.get(String(opt.value));
        opt.disabled = Boolean(owner && owner !== s);
      }
    }
  }

  function wireUniqueSelects() {
    container.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.tagName !== "SELECT") return;
      if (!target.matches("select[data-cat]")) return;

      // Si el valor ya está elegido en otro select, lo limpiamos.
      if (target.value) {
        const val = String(target.value);
        const other = Array.from(container.querySelectorAll("select[data-cat]"))
          .find(s => s !== target && String(s.value) === val);
        if (other) {
          target.value = "";
          const now = Date.now();
          if (now - lastConflictAt > 800) {
            showAlert("Ese valor ya está asignado a otra categoría. Elige un valor distinto.", "warning");
            lastConflictAt = now;
          }
        }
      }

      refreshUniqueOptions();
    });
  }

  function render() {
    if (!Array.isArray(categorias) || categorias.length === 0) {
      container.innerHTML = `<div class="text-muted">No hay categorías para este instrumento.</div>`;
      return;
    }

    const n = categorias.length;

    let html = `
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Categoría</th>
              <th class="d-none d-md-table-cell">Objetivo</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const c of categorias) {
      const selected = existingRanks.has(c.categoria_code)
        ? Number(existingRanks.get(c.categoria_code))
        : null;

      html += `
        <tr>
          <td>
            <select class="form-select form-select-sm" data-cat="${escapeHtml(c.categoria_code)}">
              ${buildOptions(n, selected)}
            </select>
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(c.nombre)}</div>
            <div class="text-muted small">${escapeHtml(c.categoria_code)}</div>
          </td>
          <td class="d-none d-md-table-cell">
            <div class="text-muted small">${escapeHtml(c.objetivo || "")}</div>
          </td>
        </tr>
      `;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    refreshUniqueOptions();
  }

  async function init() {
    try {
      setStatus("Inicializando evaluación...");
      const initResp = await fetchJson(`/api/evaluacion/${instrumentoId}/init`, { method: "POST" });
      evaluacionId = initResp.evaluacion_id;
      setEvalId(evaluacionId);

      setStatus("Cargando categorías...");
      categorias = await fetchJson(`/api/catalogo/${instrumentoId}/categorias`);

      // Prefill desde resumen (si ya había guardado algo)
      setStatus("Cargando respuestas previas...");
      const resumen = await fetchJson(`/api/evaluacion/${evaluacionId}/resumen`);
      existingRanks.clear();
      for (const c of (resumen.categorias || [])) {
        if (c.rank_value !== null && c.rank_value !== undefined) {
          existingRanks.set(c.categoria_code, Number(c.rank_value));
        }
      }

      render();
      wireUniqueSelects();
      setStatus("Listo. Asigna valores 1..N (sin repetición).");
    } catch (e) {
      console.error(e);
      showAlert(e.message || "Error al cargar la pantalla de categorías.");
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

      await fetchJson(`/api/evaluacion/${evaluacionId}/categorias`, {
        method: "POST",
        body: { ranks: res.ranks },
      });

      // Redirigir a primera categoría de ítems
      window.location.href = `/evaluar/${instrumentoId}/items/1`;
    } catch (e) {
      console.error(e);
      showAlert(e.message || "No se pudo guardar el ranking de categorías.");
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Guardar y continuar";
    }
  }

  if (!instrumentoId) {
    showAlert("Falta contexto del instrumento.", "danger");
    return;
  }

  btnGuardar?.addEventListener("click", guardarYContinuar);
  await init();
})();

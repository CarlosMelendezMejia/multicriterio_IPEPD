/* static/js/items.js
 * ------------------------------------------------------------
 * Vista: templates/items.html
 * Flujo:
 *  1) POST /api/evaluacion/<instrumento_id>/init -> evaluacion_id
 *  2) GET  /api/catalogo/<instrumento_id>/items/<categoria_code>
 *  3) GET  /api/evaluacion/<evaluacion_id>/resumen (prefill ranks)
 *  4) Render ranking 1..N para ítems principales
 *     + ranking independiente 1..M para cada grupo de sub-ítems
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
  let allItems = [];            // raw from API (with parent_item_id)
  let existingRanks = new Map(); // item_id -> rank_value
  let lastConflictAt = 0;

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }

  function setEvalId(id) {
    if (evalIdText) evalIdText.textContent = id ? `Evaluación #${id}` : "";
  }

  // ── helpers ──────────────────────────────────────────

  /** Items that participate in the main ranking (no parent_item_id). */
  function mainItems() {
    return allItems.filter(it => !it.parent_item_id);
  }

  /** Sub-items that belong to a given parent. */
  function subItemsOf(parentId) {
    return allItems.filter(it => it.parent_item_id === parentId);
  }

  /** Set of parent_item_ids that actually have children. */
  function parentIdsWithChildren() {
    const set = new Set();
    for (const it of allItems) {
      if (it.parent_item_id) set.add(it.parent_item_id);
    }
    return set;
  }

  function buildOptions(n, selected) {
    let html = `<option value="">—</option>`;
    for (let i = 1; i <= n; i++) {
      const sel = (selected === i) ? "selected" : "";
      html += `<option value="${i}" ${sel}>${i}</option>`;
    }
    return html;
  }

  // ── collect all selections ──────────────────────────

  function collectSelections() {
    const allSelects = Array.from(container.querySelectorAll("select[data-item]"));
    const ranks = [];

    for (const s of allSelects) {
      const itemId = Number(s.getAttribute("data-item"));
      const v = s.value ? Number(s.value) : null;
      if (!v || Number.isNaN(v)) {
        return { ok: false, error: "Debes asignar un valor a todos los ítems y sub-ítems." };
      }
      const group = s.getAttribute("data-group"); // "main" or parent item id
      const rankGroup = group === "main" ? 0 : Number(group);
      ranks.push({ item_id: itemId, rank_value: v, rank_group: rankGroup });
    }

    // Validate uniqueness per group
    const groupUsed = {};
    for (const r of ranks) {
      const key = String(r.rank_group);
      if (!groupUsed[key]) groupUsed[key] = new Set();
      if (groupUsed[key].has(r.rank_value)) {
        return { ok: false, error: "Los valores deben ser únicos (sin repetición) dentro de cada grupo de ranking." };
      }
      groupUsed[key].add(r.rank_value);
    }

    return { ok: true, ranks };
  }

  // ── unique-options logic (scoped per group) ─────────

  function refreshUniqueOptions() {
    // Group selects by their data-group attribute
    const groups = new Map();
    for (const s of Array.from(container.querySelectorAll("select[data-item]"))) {
      const g = s.getAttribute("data-group") || "main";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(s);
    }

    for (const [, selects] of groups) {
      const used = new Map();
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
  }

  function wireUniqueSelects() {
    container.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.tagName !== "SELECT") return;
      if (!target.matches("select[data-item]")) return;

      if (target.value) {
        const val = String(target.value);
        const group = target.getAttribute("data-group") || "main";
        const siblings = Array.from(
          container.querySelectorAll(`select[data-item][data-group="${group}"]`)
        );
        const other = siblings.find(s => s !== target && String(s.value) === val);
        if (other) {
          target.value = "";
          const now = Date.now();
          if (now - lastConflictAt > 800) {
            showAlert("Ese valor ya está asignado. Elige un valor distinto.", "warning");
            lastConflictAt = now;
          }
        }
      }

      refreshUniqueOptions();
    });
  }

  // ── render ──────────────────────────────────────────

  function render() {
    if (!Array.isArray(allItems) || allItems.length === 0) {
      container.innerHTML = `<div class="text-muted">No hay ítems para esta categoría.</div>`;
      return;
    }

    const mains = mainItems();
    const parentsWithKids = parentIdsWithChildren();
    const n = mains.length;

    let html = `
      <div class="table-responsive">
        <table class="table align-middle items-rank-table">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Ítem</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const it of mains) {
      const selected = existingRanks.has(it.item_id)
        ? Number(existingRanks.get(it.item_id))
        : null;

      const hasChildren = parentsWithKids.has(it.item_id);

      html += `
        <tr class="main-item-row">
          <td>
            <select class="form-select form-select-sm" data-item="${it.item_id}" data-group="main">
              ${buildOptions(n, selected)}
            </select>
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(it.codigo_visible || "")}</div>
            <div>${escapeHtml(it.contenido)}</div>
          </td>
        </tr>
      `;

      // If this item has children → render sub-item rows
      if (hasChildren) {
        const subs = subItemsOf(it.item_id);
        const m = subs.length;

        for (const sub of subs) {
          const subSel = existingRanks.has(sub.item_id)
            ? Number(existingRanks.get(sub.item_id))
            : null;

          html += `
            <tr class="sub-item-row">
              <td>
                <select class="form-select form-select-sm sub-select" data-item="${sub.item_id}" data-group="${it.item_id}">
                  ${buildOptions(m, subSel)}
                </select>
              </td>
              <td class="sub-item-cell">
                <div class="fw-semibold text-muted">${escapeHtml(sub.codigo_visible || "")}</div>
                <div>${escapeHtml(sub.contenido)}</div>
              </td>
            </tr>
          `;
        }
      }
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    refreshUniqueOptions();
  }

  // ── init ────────────────────────────────────────────

  async function init() {
    try {
      setStatus("Inicializando evaluación...");
      const initResp = await fetchJson(`/api/evaluacion/${instrumentoId}/init`, { method: "POST" });
      evaluacionId = initResp.evaluacion_id;
      setEvalId(evaluacionId);

      setStatus("Cargando ítems...");
      allItems = await fetchJson(`/api/catalogo/${instrumentoId}/items/${encodeURIComponent(categoriaCode)}`);

      setStatus("Cargando respuestas previas...");
      const resumen = await fetchJson(`/api/evaluacion/${evaluacionId}/resumen`);
      existingRanks.clear();

      for (const it of (resumen.items || [])) {
        if (it.categoria_code === categoriaCode && it.rank_value !== null && it.rank_value !== undefined) {
          existingRanks.set(Number(it.item_id), Number(it.rank_value));
        }
      }

      render();
      wireUniqueSelects();
      setStatus("Listo. Asigna valores (sin repetición) a cada grupo de ranking.");
    } catch (e) {
      console.error(e);
      showAlert(e.message || "Error al cargar la pantalla de ítems.");
      setStatus("Error.");
    }
  }

  // ── save ────────────────────────────────────────────

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

  // ── boot ────────────────────────────────────────────

  if (!instrumentoId || !categoriaCode) {
    showAlert("Falta contexto del instrumento/categoría.", "danger");
    return;
  }

  btnGuardar?.addEventListener("click", guardarYContinuar);
  await init();
})();

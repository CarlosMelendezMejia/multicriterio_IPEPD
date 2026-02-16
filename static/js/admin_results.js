/* static/js/admin_results.js
 * ------------------------------------------------------------
 * Dashboard de resultados para el panel de administración.
 * Usa la API:
 *   GET /api/admin/instruments
 *   GET /api/admin/results/:instrumento_id
 * ------------------------------------------------------------ */

(function () {
  const { qs, qsa, fetchJson, showAlert, escapeHtml } = window.API;

  let instrumentsLoaded = false;

  // ---------- Cargar instrumentos al entrar al tab ----------
  async function loadInstruments() {
    if (instrumentsLoaded) return;

    const container = qs("#instrumentCards");
    try {
      const instruments = await fetchJson("/api/admin/instruments");
      instrumentsLoaded = true;

      if (!instruments.length) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-4">No hay instrumentos registrados.</div>`;
        return;
      }

      container.innerHTML = instruments.map(ins => {
        const totalEvals = (parseInt(ins.total_submitted) || 0) + (parseInt(ins.total_draft) || 0);
        return `
          <div class="col-md-4">
            <div class="app-card border-top-c1 cursor-pointer card-instrument" data-id="${ins.instrumento_id}" role="button">
              <div class="card-body">
                <h6 class="fw-bold mb-2" style="color:var(--c3);">${escapeHtml(ins.nombre)}</h6>
                <div class="d-flex gap-3">
                  <span class="badge text-bg-success">${ins.total_submitted} enviadas</span>
                  <span class="badge text-bg-warning">${ins.total_draft} borrador</span>
                </div>
                <small class="text-muted d-block mt-2">${totalEvals} evaluaciones en total</small>
              </div>
            </div>
          </div>`;
      }).join("");
    } catch (e) {
      container.innerHTML = `<div class="col-12 text-center text-danger py-4">Error al cargar instrumentos: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ---------- Cargar resultados de un instrumento ----------
  async function loadResults(instrumentoId) {
    qs("#instrumentCards").classList.add("d-none");
    const detail = qs("#resultsDetail");
    detail.classList.remove("d-none");

    qs("#resultsTitle").textContent = "Cargando…";

    try {
      const data = await fetchJson(`/api/admin/results/${instrumentoId}`);
      renderResults(data);
    } catch (e) {
      qs("#resultsTitle").textContent = "Error";
      showAlert("Error al cargar resultados: " + e.message);
    }
  }

  function renderResults(data) {
    const inst = data.instrumento;
    qs("#resultsTitle").textContent = inst.nombre;

    // ----- Evaluadores -----
    const tbodyEval = qs("#tblEvaluadores tbody");
    if (!data.evaluadores.length) {
      tbodyEval.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin evaluaciones aún.</td></tr>`;
    } else {
      tbodyEval.innerHTML = data.evaluadores.map(ev => {
        const name = [ev.grado, ev.nombre, ev.apellido_paterno, ev.apellido_materno].filter(Boolean).join(" ");
        const statusBadge = ev.status === "submitted"
          ? '<span class="badge text-bg-success">Enviada</span>'
          : '<span class="badge text-bg-warning">Borrador</span>';
        const fecha = ev.submitted_at
          ? new Date(ev.submitted_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
          : "—";
        return `<tr>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(ev.grado || "—")}</td>
          <td>${escapeHtml(ev.rol_nombre)}</td>
          <td><span class="badge text-bg-info">${ev.rol_peso_snapshot}</span></td>
          <td>${statusBadge}</td>
          <td>${fecha}</td>
        </tr>`;
      }).join("");
    }

    // ----- Categorías -----
    const tbodyCat = qs("#tblCatRanking tbody");
    if (!data.categorias.length) {
      tbodyCat.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin datos de categorías.</td></tr>`;
    } else {
      tbodyCat.innerHTML = data.categorias.map((c, idx) => {
        const rp = c.rank_ponderado ?? "—";
        const ra = c.rank_promedio ?? "—";
        const total = parseInt(c.total_respuestas) || 0;
        const highlight = idx === 0 ? 'style="background:rgba(191,135,31,0.08);"' : "";
        return `<tr ${highlight}>
          <td><span class="badge text-bg-primary">${idx + 1}</span></td>
          <td><strong>${escapeHtml(c.nombre)}</strong></td>
          <td class="text-center fw-bold">${rp}</td>
          <td class="text-center">${ra}</td>
          <td class="text-center">${total}</td>
        </tr>`;
      }).join("");
    }

    // ----- Ítems por categoría -----
    const container = qs("#itemRankingContainer");
    if (!data.items.length) {
      container.innerHTML = `<p class="text-muted">Sin datos de ítems.</p>`;
      return;
    }

    // Agrupar por categoria_code
    const byCategory = {};
    data.items.forEach(it => {
      const key = it.categoria_code;
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(it);
    });

    let html = "";
    for (const [catCode, items] of Object.entries(byCategory)) {
      // Nombre de la categoría (buscar en data.categorias)
      const catInfo = data.categorias.find(c => c.categoria_code === catCode);
      const catName = catInfo ? catInfo.nombre : catCode;

      // Separar main items (parent_item_id == null) vs sub-items
      const mainItems = items.filter(it => !it.parent_item_id);
      const subItems = items.filter(it => it.parent_item_id);

      // Agrupar sub-items por parent
      const subByParent = {};
      subItems.forEach(si => {
        const pid = si.parent_item_id;
        if (!subByParent[pid]) subByParent[pid] = [];
        subByParent[pid].push(si);
      });

      // Ordenar main items por rank_ponderado (desc - mayor a menor)
      mainItems.sort((a, b) => (b.rank_ponderado || 999999) - (a.rank_ponderado || 999999));

      html += `
        <div class="mb-3">
          <h6 class="fw-semibold" style="color:var(--c1);">${escapeHtml(catName)}</h6>
          <div class="table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead>
                <tr>
                  <th style="width:4rem;">#</th>
                  <th>Código</th>
                  <th>Contenido</th>
                  <th class="text-center">Rank Pond.</th>
                  <th class="text-center">Rank Prom.</th>
                  <th class="text-center">Resp.</th>
                </tr>
              </thead>
              <tbody>`;

      let pos = 1;
      mainItems.forEach(it => {
        const rp = it.rank_ponderado ?? "—";
        const ra = it.rank_promedio ?? "—";
        const total = parseInt(it.total_respuestas) || 0;

        html += `<tr>
          <td><span class="badge text-bg-primary">${pos}</span></td>
          <td><strong>${escapeHtml(it.codigo_visible)}</strong></td>
          <td>${escapeHtml(truncate(it.contenido, 100))}</td>
          <td class="text-center fw-bold">${rp}</td>
          <td class="text-center">${ra}</td>
          <td class="text-center">${total}</td>
        </tr>`;
        pos++;

        // Sub-items for this parent
        const subs = subByParent[it.item_id];
        if (subs && subs.length) {
          subs.sort((a, b) => (b.rank_ponderado || 999999) - (a.rank_ponderado || 999999));
          subs.forEach((si, sIdx) => {
            const srp = si.rank_ponderado ?? "—";
            const sra = si.rank_promedio ?? "—";
            const st = parseInt(si.total_respuestas) || 0;
            html += `<tr class="sub-item-row">
              <td><span class="badge" style="background:var(--c2);color:#333;">${sIdx + 1}</span></td>
              <td class="sub-item-cell"><strong>${escapeHtml(si.codigo_visible)}</strong></td>
              <td>${escapeHtml(truncate(si.contenido, 100))}</td>
              <td class="text-center fw-bold">${srp}</td>
              <td class="text-center">${sra}</td>
              <td class="text-center">${st}</td>
            </tr>`;
          });
        }
      });

      html += `</tbody></table></div></div>`;
    }

    container.innerHTML = html;
  }

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.substring(0, max) + "…" : str;
  }

  // ---------- Volver a la lista de instrumentos ----------
  function backToInstruments() {
    qs("#resultsDetail").classList.add("d-none");
    qs("#instrumentCards").classList.remove("d-none");
  }

  // ---------- Event wiring ----------
  function wireEvents() {
    // Lazy-load instruments when results tab is shown
    qs("#tab-results").addEventListener("shown.bs.tab", () => {
      loadInstruments();
    });

    // Click on instrument card
    qs("#instrumentCards").addEventListener("click", e => {
      const card = e.target.closest(".card-instrument");
      if (card) {
        loadResults(parseInt(card.dataset.id));
      }
    });

    // Back button
    qs("#btnBackInstruments").addEventListener("click", backToInstruments);
  }

  // ---------- Init ----------
  function init() {
    wireEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

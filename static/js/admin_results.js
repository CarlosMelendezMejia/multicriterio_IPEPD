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

  // ---------- Paleta institucional para gráficas ----------
  const CHART_PALETTE = [
    { bg: "rgba(191, 135, 31, 0.18)",  border: "#BF871F" },  // dorado
    { bg: "rgba(242, 188, 87, 0.18)",  border: "#F2BC57" },  // dorado claro
    { bg: "rgba(115, 101, 77, 0.18)",  border: "#73654D" },  // café
    { bg: "rgba(114, 108, 110, 0.18)", border: "#726C6E" },  // gris
    { bg: "rgba(74, 137, 220, 0.18)",  border: "#4A89DC" },  // azul
    { bg: "rgba(72, 175, 110, 0.18)",  border: "#48AF6E" },  // verde
  ];

  // Instancias de Chart activas (para destruir al recargar)
  let activeCharts = [];

  function destroyCharts() {
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
  }

  /**
   * Crea una gráfica de radar con estilo institucional.
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} labels
   * @param {number[]} values
   * @param {string} datasetLabel
   * @param {number} paletteIdx  Índice de paleta (0-5)
   * @returns {Chart}
   */
  function createRadarChart(canvas, labels, values, datasetLabel, paletteIdx = 0, fixedMax = null) {
    const pal = CHART_PALETTE[paletteIdx % CHART_PALETTE.length];
    // Escala fija: si no se pasa, usa la cantidad de ejes (ranking 1..N)
    const scaleMax = fixedMax || labels.length;

    const chart = new Chart(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: datasetLabel,
          data: values,
          backgroundColor: pal.bg,
          borderColor: pal.border,
          borderWidth: 2,
          pointBackgroundColor: pal.border,
          pointBorderColor: "#fff",
          pointRadius: 3.5,
          pointHoverRadius: 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(115, 101, 77, 0.92)",
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 8,
            cornerRadius: 8,
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: scaleMax,
            startAngle: 0,
            angleLines: { color: "rgba(115, 101, 77, 0.10)" },
            grid: { color: "rgba(115, 101, 77, 0.10)" },
            pointLabels: {
              font: { size: 11, family: "Poppins, sans-serif" },
              color: "#73654D",
              padding: 6,
              callback: function (label) {
                return label.length > 22 ? label.substring(0, 20) + "…" : label;
              }
            },
            ticks: {
              backdropColor: "transparent",
              font: { size: 9 },
              color: "#999",
              stepSize: scaleMax > 10 ? Math.ceil(scaleMax / 5) : 1,
            }
          }
        },
        animation: {
          duration: 600,
          easing: "easeOutQuart"
        }
      }
    });

    activeCharts.push(chart);
    return chart;
  }

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
    destroyCharts();
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

    // ----- Categorías (ordenadas por 'orden' ascendente) -----
    const tbodyCat = qs("#tblCatRanking tbody");
    if (!data.categorias.length) {
      tbodyCat.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin datos de categorías.</td></tr>`;
    } else {
      const catsByOrden = [...data.categorias].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      tbodyCat.innerHTML = catsByOrden.map((c, idx) => {
        const rp = c.rank_ponderado ?? "—";
        const ra = c.rank_promedio ?? "—";
        const total = parseInt(c.total_respuestas) || 0;
        const highlight = idx === 0 ? 'style="background:rgba(191,135,31,0.08);"' : "";
        return `<tr ${highlight}>
          <td><span class="badge text-bg-primary">C.${c.orden || (idx + 1)}</span></td>
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

    // ===== GRÁFICAS DE RADAR =====
    renderRadarCharts(data);
  }

  /**
   * Construye las gráficas de radar:
   *  1. Una para el ranking de categorías
   *  2. Una por cada categoría con sus ítems principales
   */
  function renderRadarCharts(data) {
    // --- 1. Radar de Categorías (ordenadas por 'orden', no por rank) ---
    if (data.categorias.length >= 3) {
      // Copiar y ordenar por 'orden' ascendente para posición fija en el radar
      const catsSorted = [...data.categorias].sort((a, b) => (a.orden || 0) - (b.orden || 0));
      const labels = catsSorted.map((c, i) => `C.${c.orden || (i + 1)}`);
      const values = catsSorted.map(c => parseFloat(c.rank_ponderado) || 0);
      const fixedMax = catsSorted.length;
      const canvas = qs("#radarCategorias");
      if (canvas) {
        createRadarChart(canvas, labels, values, "Rank Ponderado", 0, fixedMax);
      }
    } else {
      // No tiene sentido un radar con <3 ejes
      const wrap = qs("#radarCategorias");
      if (wrap && wrap.parentElement) {
        wrap.parentElement.innerHTML = '<p class="text-muted text-center small mt-3">Se requieren al menos 3 categorías para la gráfica de radar.</p>';
      }
    }

    // --- 2. Radares por categoría (ítems principales) ---
    const radarSection = qs("#radarItemsSection");
    const radarContainer = qs("#radarItemsContainer");
    if (!radarContainer) return;

    // Agrupar ítems principales por categoría
    const byCategory = {};
    data.items.forEach(it => {
      if (it.parent_item_id) return; // sólo main items
      const key = it.categoria_code;
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(it);
    });

    const entries = Object.entries(byCategory);
    if (!entries.length) {
      radarSection.classList.add("d-none");
      return;
    }

    radarSection.classList.remove("d-none");
    let radarHtml = "";
    let canvasIds = [];

    entries.forEach(([catCode, items], idx) => {
      if (items.length < 3) return; // radar necesita ≥3 puntos

      const catInfo = data.categorias.find(c => c.categoria_code === catCode);
      const catName = catInfo ? catInfo.nombre : catCode;
      const canvasId = `radarCat_${catCode}`;
      canvasIds.push({ canvasId, items, catName, idx });

      radarHtml += `
        <div class="col-md-6 col-lg-4">
          <div class="radar-chart-card">
            <p class="radar-chart-title">${escapeHtml(catName)}</p>
            <div class="radar-chart-wrapper radar-chart-wrapper--sm">
              <canvas id="${canvasId}"></canvas>
            </div>
          </div>
        </div>`;
    });

    if (!canvasIds.length) {
      radarSection.classList.add("d-none");
      return;
    }

    radarContainer.innerHTML = radarHtml;

    // Renderizar cada radar una vez que el DOM tiene los canvas
    requestAnimationFrame(() => {
      canvasIds.forEach(({ canvasId, items, catName, idx }) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Ordenar por 'orden' ascendente (posición fija: 1.° arriba, 2.° a la derecha…)
        items.sort((a, b) => (a.orden || 0) - (b.orden || 0));

        const labels = items.map(it => it.codigo_visible);
        const values = items.map(it => parseFloat(it.rank_ponderado) || 0);
        const fixedMax = items.length;

        createRadarChart(canvas, labels, values, catName, idx % CHART_PALETTE.length, fixedMax);
      });
    });
  }

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.substring(0, max) + "…" : str;
  }

  // ---------- Volver a la lista de instrumentos ----------
  function backToInstruments() {
    destroyCharts();
    qs("#resultsDetail").classList.add("d-none");
    qs("#radarItemsSection").classList.add("d-none");
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

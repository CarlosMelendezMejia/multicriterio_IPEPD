/* static/js/api.js
 * ------------------------------------------------------------
 * Helpers para consumir la API JSON del sistema multicriterio IPEPD
 * - fetchJson: maneja JSON, errores HTTP, y muestra mensajes útiles
 * - qs: helper querySelector
 * - showAlert: alertas Bootstrap dinámicas
 * ------------------------------------------------------------ */

(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function showAlert(message, type = "danger", containerSel = "main.container") {
    const container = qs(containerSel) || document.body;
    const wrapper = document.createElement("div");
    wrapper.className = `alert alert-${type} alert-dismissible fade show`;
    wrapper.role = "alert";
    wrapper.innerHTML = `
      <div>${escapeHtml(message)}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
    `;
    container.prepend(wrapper);
    return wrapper;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function fetchJson(url, opts = {}) {
    const options = {
      method: opts.method || "GET",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        opts.headers || {}
      ),
      credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    };

    const res = await fetch(url, options);

    // Intentar parsear JSON siempre que se pueda
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      const txt = await res.text();
      data = { raw: txt };
    }

    if (!res.ok) {
      const errMsg =
        (data && (data.error || data.message)) ||
        `Error HTTP ${res.status} al consumir API`;
      const error = new Error(errMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // Export global
  window.API = {
    qs,
    qsa,
    showAlert,
    escapeHtml,
    fetchJson,
  };
})();

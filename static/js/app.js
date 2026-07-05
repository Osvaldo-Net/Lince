function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken":  getCsrfToken()
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ══════════════════════════════════════════
// FILTRO CONFIANZA
// ══════════════════════════════════════════
let filtroConfianza    = "";
let filtroConfianzaKey = "filterAll";

// ══════════════════════════════════════════
// EDICIÓN DE NOMBRE — pausa el refresco automático
// Mientras el usuario edita un nombre en la tabla, un escaneo en
// segundo plano no debe reconstruir la tabla (perdería el input abierto).
// Se guarda el último dato recibido y se aplica apenas termine de editar.
// ══════════════════════════════════════════
let _editandoNombre = false;
let _tablaPendiente = null;

function actualizarLabelFiltro() {
  const label = document.getElementById("trustLabel");
  if (!label) return;
  label.textContent = t(filtroConfianzaKey);
  label.setAttribute("data-i18n", filtroConfianzaKey);
}

// ══════════════════════════════════════════
// NOTIFICACIONES
// ══════════════════════════════════════════
const COLORES_NOTI = {
  info:    "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-dark3 dark:text-slate-200 dark:border-slate-700",
  success: "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40",
  error:   "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40",
  warning: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40"
};
let _notiTimer = null;

function mostrarNotificacion(html, tipo = "info") {
  const noti = document.getElementById("notificacion");
  if (!noti) return;
  noti.innerHTML = html;
  noti.className = `fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-xl z-[70]
    text-xs font-medium max-w-xs w-full transition-all duration-300 ${COLORES_NOTI[tipo]}`;
  noti.classList.remove("hidden");
  if (typeof lucide !== "undefined") lucide.createIcons();
  clearTimeout(_notiTimer);
  _notiTimer = setTimeout(() => noti.classList.add("hidden"), 4000);
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {

  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  // ── Idioma: sincronizar bandera/label con el idioma guardado ─────────────
  // SUPPORTED_LANGS ya existe de forma síncrona (i18n.js se carga antes que
  // app.js), así que esto no necesita esperar a que baje el JSON de
  // traducciones — solo corrige el ícono/texto que estaban hardcodeados
  // en español en el HTML.
  (() => {
    const lang = localStorage.getItem("lang") || "es";
    const info = SUPPORTED_LANGS[lang];
    if (!info) return;
    const flag  = $("langFlag");
    const label = $("langLabel");
    if (flag)  flag.className    = `fi fi-${info.country} w-3.5 h-2.5 rounded-sm flex-shrink-0`;
    if (label) label.textContent = info.label;
  })();

  // ── Modo oscuro ───────────────────────────────────────────────────────────
  const aplicarTema = () => {
    const dark = localStorage.getItem("modoOscuro") === "true";
    root.classList.toggle("dark", dark);
    actualizarIcono();
  };
  const actualizarIcono = () => {
    const dark = root.classList.contains("dark");
    $("icono-luna")?.classList.toggle("hidden", dark);
    $("icono-sol")?.classList.toggle("hidden", !dark);
  };
  window.toggleDarkMode = () => {
    localStorage.setItem("modoOscuro", root.classList.toggle("dark"));
    actualizarIcono();
  };
  aplicarTema();

  // ── Modal puertos ─────────────────────────────────────────────────────────
  window.cerrarModal = () => $("modal-puertos")?.classList.add("hidden");

  // ── Agregar MAC ───────────────────────────────────────────────────────────
  $("form-agregar")?.addEventListener("submit", async e => {
    e.preventDefault();
    const mac = $("input-mac").value.trim();
    if (!mac) return;
    mostrarNotificacion(`<span class="flex items-center gap-1.5"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> ${t("adding")}</span>`);
    try {
      const data = await postJSON("/api/agregar", { mac });
      mostrarNotificacion(
        data.success ? `✓ ${t("success")}` : `✕ ${esc(data.message || t("error"))}`,
        data.success ? "success" : "error"
      );
      if (data.success) {
        $("input-mac").value = "";
        const lista = $("lista-macs");
        if (lista) {
          const li = document.createElement("li");
          li.dataset.mac = mac.toLowerCase();
          li.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-dark3/30 hover:border-slate-200 dark:hover:border-slate-700/60 transition group";
          li.innerHTML = `
            <span class="relative flex w-1.5 h-1.5 flex-shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500"></span>
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="nombre-confiable font-medium text-slate-700 dark:text-slate-200 text-xs truncate">${t("noName")}</p>
                <button onclick="editarNombreConfiable('${esc(mac)}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition flex-shrink-0">
                  <i data-lucide="pencil" class="w-3 h-3"></i>
                </button>
              </div>
              <p class="font-mono text-slate-400" style="font-size:10px">${esc(mac)}</p>
            </div>
            <button onclick="eliminarMAC('${esc(mac)}')" class="text-slate-300 hover:text-rose-500 transition p-1 flex-shrink-0">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>`;
          lista.appendChild(li);
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
      }
    } catch {
      mostrarNotificacion(`✕ ${t("connectionError")}`, "error");
    }
  });

  // ── Eliminar MAC ──────────────────────────────────────────────────────────
  window.eliminarMAC = async mac => {
    mostrarNotificacion(`<span class="flex items-center gap-1.5"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> ${t("eliminando")}</span>`);
    try {
      const data = await postJSON("/api/eliminar", { mac });
      mostrarNotificacion(
        data.success ? `✓ ${t("eliminado")}` : `✕ ${t("connectionError")}`,
        data.success ? "success" : "error"
      );
      if (data.success) {
        $("lista-macs")?.querySelector(`li[data-mac="${esc(mac.toLowerCase())}"]`)?.remove();
        const tr = document.querySelector(`tr[data-mac="${esc(mac.toLowerCase())}"]`);
        if (tr) {
          tr.dataset.confianza = "no-confiable";
          const tdConf = tr.querySelector("td:nth-child(5)");
          if (tdConf) tdConf.innerHTML = `<span class="badge badge-red"><span data-i18n="untrusted">${t("untrusted")}</span></span>`;
          const tdAct = tr.querySelector("td:nth-child(6)");
          if (tdAct) tdAct.innerHTML = `<button onclick="marcarConfiable('${esc(mac)}',true,this)" class="btn-action btn-trust"><i data-lucide="shield-check" class="w-3 h-3"></i> <span data-i18n="trust_btn">${t("trust_btn")}</span></button>`;
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
      }
    } catch {
      mostrarNotificacion(`✕ ${t("connectionError")}`, "error");
    }
  };

  // ── Marcar confiable / no confiable ──────────────────────────────────────
  window.marcarConfiable = async (mac, confiable, btn) => {
    try {
      const endpoint = confiable ? "/api/agregar" : "/api/eliminar";
      const data = await postJSON(endpoint, { mac });
      if (data.success) {
        const devs = await fetch("/api/scan").then(r => r.json());
        if (Array.isArray(devs)) actualizarTabla(devs);
      }
    } catch {
      mostrarNotificacion(`✕ ${t("connectionError")}`, "error");
    }
  };

  // ── Editar nombre en tabla principal ──────────────────────────────────────
  window.editarNombre = mac => {
    const fila  = document.querySelector(`tr[data-mac="${esc(mac.toLowerCase())}"]`);
    const celda = fila?.querySelector("td:nth-child(3)");
    if (!celda) return;
    const actual = celda.querySelector("span")?.innerText.trim() || "";
    const sid    = mac.replace(/:/g, "");

    _editandoNombre = true;

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-1.5";

    const inp = document.createElement("input");
    inp.id = `inp-${sid}`;
    inp.className = "input-base w-28";
    inp.style.cssText = "padding:4px 8px;font-size:12px";
    inp.value = (actual === "?" ? "" : actual);
    inp.placeholder = t("noName");
    inp.maxLength = 64;

    const btn = document.createElement("button");
    btn.id = `btn-${sid}`;
    btn.className = "px-2 py-1 rounded-lg text-white text-xs font-medium";
    btn.style.cssText = "background:#0891B2;font-size:11px";
    btn.textContent = t("guardar");

    wrapper.appendChild(inp);
    wrapper.appendChild(btn);
    celda.replaceChildren(wrapper);
    inp.focus();
    inp.select();

    let _saved = false;
    const guardar = async () => {
      if (_saved) return;
      _saved = true;
      const nombre = inp.value.trim().slice(0, 64) || t("noName");

      const newWrapper = document.createElement("div");
      newWrapper.className = "flex items-center gap-1.5";
      const span = document.createElement("span");
      span.className = "text-slate-700 dark:text-slate-200 font-medium";
      span.textContent = nombre;
      const editBtn = document.createElement("button");
      editBtn.onclick = () => editarNombre(mac);
      editBtn.className = "text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition";
      editBtn.innerHTML = `<i data-lucide="pencil" class="w-3 h-3"></i>`;
      newWrapper.appendChild(span);
      newWrapper.appendChild(editBtn);
      celda.replaceChildren(newWrapper);

      if (fila) fila.dataset.nombre = nombre.toLowerCase();
      const li = $("lista-macs")?.querySelector(`li[data-mac="${esc(mac.toLowerCase())}"]`);
      const sp = li?.querySelector(".nombre-confiable");
      if (sp) sp.textContent = nombre;
      if (typeof lucide !== "undefined") lucide.createIcons();

      _editandoNombre = false;
      _aplicarTablaPendienteSiHay();

      try {
        const d = await postJSON("/api/nombrar", { mac, nombre });
        mostrarNotificacion(
          d.success ? `✓ ${t("nombre_guardado")}` : `✕ ${t("error_guardar_nombre")}`,
          d.success ? "success" : "error"
        );
      } catch {
        mostrarNotificacion(`✕ ${t("error_guardar_nombre")}`, "error");
      }
    };

    btn.onclick = guardar;
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter")  { e.preventDefault(); inp.removeEventListener("blur", guardar); guardar(); }
      if (e.key === "Escape") {
        _saved = true;
        _editandoNombre = false;
        const rw = document.createElement("div");
        rw.className = "flex items-center gap-1.5";
        const rs = document.createElement("span");
        rs.className = "text-slate-700 dark:text-slate-200 font-medium";
        rs.textContent = actual || "?";
        const rb = document.createElement("button");
        rb.onclick = () => editarNombre(mac);
        rb.className = "text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition";
        rb.innerHTML = `<i data-lucide="pencil" class="w-3 h-3"></i>`;
        rw.appendChild(rs);
        rw.appendChild(rb);
        celda.replaceChildren(rw);
        if (typeof lucide !== "undefined") lucide.createIcons();
        _aplicarTablaPendienteSiHay();
      }
    });
    inp.addEventListener("blur", guardar);
  };

  // ── Hora actual ───────────────────────────────────────────────────────────
  const actualizarHora = () => {
    const now    = new Date();
    const lang   = localStorage.getItem("lang") || "es";
    const locale = lang === "en" ? "en-US" : "es-CO";
    const timeEl = $("horaActual-time");
    const dateEl = $("horaActual-date");
    if (timeEl) timeEl.textContent = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    if (dateEl) dateEl.textContent = now.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" });
  };
  setInterval(actualizarHora, 1000);
  actualizarHora();

  // ── Escaneo manual ────────────────────────────────────────────────────────
  window.escanearAhora = async () => {
    mostrarNotificacion(`<span class="flex items-center gap-1.5"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> ${t("scanning")}</span>`);
    const t0 = Date.now();
    try {
      const data = await fetch("/api/scan").then(r => r.json());
      const wait = 1200 - (Date.now() - t0);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (!Array.isArray(data)) throw new Error();
      mostrarNotificacion(`✓ ${t("scanDone")}`, "success");
      actualizarTabla(data);
    } catch {
      const wait = 1200 - (Date.now() - t0);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      mostrarNotificacion(`✕ ${t("scanError")}`, "error");
    }
  };

  // ── Tabla ─────────────────────────────────────────────────────────────────
  function crearFila(d) {
    const tr = document.createElement("tr");
    tr.className = "dev-row hover:bg-slate-50/80 dark:hover:bg-dark3/40 dispositivo-row transition";
    tr.dataset.nombre    = (d.nombre || "").toLowerCase();
    tr.dataset.mac       = d.mac.toLowerCase();
    tr.dataset.confianza = d.confiable ? "confiable" : "no-confiable";

    const badgeConf = d.confiable
      ? `<span class="badge badge-green"><span data-i18n="trusted">${t("trusted")}</span></span>`
      : `<span class="badge badge-red"><span data-i18n="untrusted">${t("untrusted")}</span></span>`;

    const btnAccion = d.confiable
      ? `<button onclick="marcarConfiable('${esc(d.mac)}',false,this)" class="btn-action btn-untrust"><i data-lucide="shield-off" class="w-3 h-3"></i> <span data-i18n="untrust_btn">${t("untrust_btn")}</span></button>`
      : `<button onclick="marcarConfiable('${esc(d.mac)}',true,this)"  class="btn-action btn-trust"><i data-lucide="shield-check" class="w-3 h-3"></i> <span data-i18n="trust_btn">${t("trust_btn")}</span></button>`;

    tr.innerHTML = `
      <td class="px-4 font-mono text-slate-500 dark:text-slate-400 text-xs">${esc(d.ip)}</td>
      <td class="px-4 font-mono text-slate-400 dark:text-slate-500 text-xs">${esc(d.mac)}</td>
      <td class="px-4">
        <div class="flex items-center gap-1.5">
          <span class="text-slate-700 dark:text-slate-200 font-medium">${esc(d.nombre || "?")}</span>
          <button onclick="editarNombre('${esc(d.mac)}')" class="text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition">
            <i data-lucide="pencil" class="w-3 h-3"></i>
          </button>
        </div>
      </td>
      <td class="px-4 text-slate-500 dark:text-slate-400 text-xs">${esc(d.fabricante || "?")}</td>
      <td class="px-4">${badgeConf}</td>
      <td class="px-4">${btnAccion}</td>
      <td class="px-4">
        <button onclick="verPuertos('${esc(d.ip)}')" class="btn-action btn-neutral">
          <i data-lucide="scan-search" class="w-3 h-3"></i> <span data-i18n="view_ports">${t("view_ports")}</span>
        </button>
      </td>`;
    return tr;
  }

  function actualizarTabla(devs) {
    // Si el usuario está editando un nombre, no reconstruir la tabla ahora
    // (perdería el <input> abierto). Se guarda para aplicarlo al terminar.
    if (_editandoNombre) { _tablaPendiente = devs; return; }
    const tbody = $("tabla-dispositivos");
    if (!tbody) return;
    const frag = document.createDocumentFragment();
    devs.forEach(d => frag.appendChild(crearFila(d)));
    tbody.replaceChildren(frag);
    if (typeof lucide !== "undefined") lucide.createIcons();
    aplicarFiltros();
  }

  function _aplicarTablaPendienteSiHay() {
    if (_tablaPendiente) {
      const data = _tablaPendiente;
      _tablaPendiente = null;
      actualizarTabla(data);
    }
  }

  // ── Puertos ───────────────────────────────────────────────────────────────
  window.verPuertos = ip => {
    const modal = $("modal-puertos");
    const cont  = $("contenido-puertos");
    cont.innerHTML = `<div class="flex flex-col items-center gap-2 py-4 text-xs text-slate-400">
      <i data-lucide="scan-search" class="animate-pulse w-6 h-6 text-slate-400"></i>
      ${t("scanning_ports").replace("{{ip}}", esc(ip))}
    </div>`;
    modal.classList.remove("hidden");
    if (typeof lucide !== "undefined") lucide.createIcons();

    postJSON("/api/puertos", { ip })
      .then(data => {
        if (!data.success) throw new Error(data.message);
        cont.innerHTML = data.puertos.length === 0
          ? `<div class="p-3 rounded-lg text-xs flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
               <i data-lucide="check-circle" class="w-4 h-4 flex-shrink-0"></i> ${t("no_ports").replace("{{ip}}", esc(ip))}
             </div>`
          : `<p class="font-mono text-xs text-slate-400 mb-2">${esc(ip)}</p>
             <div class="space-y-1">
               ${data.puertos.map(p =>
                 `<div class="flex items-center justify-between p-2 border border-slate-100 dark:border-slate-800 rounded-lg bg-white dark:bg-dark3 text-xs">
                   <span class="font-mono text-slate-700 dark:text-slate-300">${esc(p.puerto)}</span>
                   <span class="text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">${esc(p.servicio)}</span>
                  </div>`
               ).join("")}
             </div>`;
        if (typeof lucide !== "undefined") lucide.createIcons();
      })
      .catch(() => {
        cont.innerHTML = `<div class="p-3 rounded-lg text-xs flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-900/30">
          <i data-lucide="x-circle" class="w-4 h-4 flex-shrink-0"></i> ${t("error_ports").replace("{{ip}}", esc(ip))}
        </div>`;
        if (typeof lucide !== "undefined") lucide.createIcons();
      });
  };

  // ── Idioma ────────────────────────────────────────────────────────────────
  $("langBtn")?.addEventListener("click", () => $("langMenu")?.classList.toggle("hidden"));

  window.setLang = async lang => {
    await setLanguage(lang);
    const info = SUPPORTED_LANGS[lang];
    if (info) {
      const flag  = $("langFlag");
      const label = $("langLabel");
      if (flag)  flag.className    = `fi fi-${info.country} w-3.5 h-2.5 rounded-sm flex-shrink-0`;
      if (label) label.textContent = info.label;
    }
    $("langMenu")?.classList.add("hidden");

    // NUEVO: persistir el idioma en el servidor para que las alertas
    // de Telegram (enviadas desde el hilo en segundo plano, sin sesión
    // ni request de por medio) usen el mismo idioma que la interfaz.
    try {
      await postJSON("/api/idioma", { idioma: lang });
    } catch {
      // Silencioso: si falla, las alertas simplemente se quedan en el
      // último idioma guardado; no bloqueamos el cambio de idioma en la UI.
    }
  };

  // ── Filtro confianza ──────────────────────────────────────────────────────
  $("trustBtn")?.addEventListener("click", () => $("trustMenu")?.classList.toggle("hidden"));

  window.setTrustFilter = valor => {
    const map = {
      all:       { valor: "",             key: "filterAll",       dot: "bg-slate-400" },
      trusted:   { valor: "confiable",    key: "filterTrusted",   dot: "bg-emerald-500" },
      untrusted: { valor: "no-confiable", key: "filterUntrusted", dot: "bg-rose-500" }
    };
    const conf = map[valor];
    if (!conf) return;
    filtroConfianza    = conf.valor;
    filtroConfianzaKey = conf.key;
    const dot = $("trust-dot");
    if (dot) dot.className = `inline-block w-2 h-2 rounded-full ${conf.dot} flex-shrink-0`;
    aplicarFiltros();
    actualizarLabelFiltro();
    $("trustMenu")?.classList.add("hidden");
  };

  // ── Filtros texto ─────────────────────────────────────────────────────────
  const aplicarFiltros = () => {
    const nombre = $("filtro-nombre")?.value.toLowerCase() || "";
    const mac    = $("filtro-mac")?.value.toLowerCase()    || "";
    document.querySelectorAll(".dispositivo-row").forEach(fila => {
      const ok = fila.dataset.nombre.includes(nombre)
        && fila.dataset.mac.includes(mac)
        && (!filtroConfianza || fila.dataset.confianza === filtroConfianza);
      fila.style.display = ok ? "" : "none";
    });
  };
  $("filtro-nombre")?.addEventListener("input", aplicarFiltros);
  $("filtro-mac")?.addEventListener("input",    aplicarFiltros);

  // ── Cerrar menús con click exterior ──────────────────────────────────────
  document.addEventListener("click", e => {
    ["langMenu", "trustMenu", "histEventoMenu"].forEach(id => {
      const menu = $(id);
      const btnMap = { langMenu: "langBtn", trustMenu: "trustBtn", histEventoMenu: "histEventoBtn" };
      const btn  = $(btnMap[id]);
      if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });
  });

  // ── Menú responsive ───────────────────────────────────────────────────────
  $("toggleMenu")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("-translate-x-full");
    $("overlay")?.classList.toggle("hidden");
  });
  $("overlay")?.addEventListener("click", () => {
    $("sidebar")?.classList.add("-translate-x-full");
    $("overlay")?.classList.add("hidden");
  });

  // ── Escaneo automático ────────────────────────────────────────────────────
  (async () => {
    let intervalo = 120000;
    try {
      const cfg = await fetch("/api/configuracion").then(r => r.json());
      intervalo = (parseInt(cfg.intervalo_monitoreo) || 120) * 1000;
    } catch {}
    setInterval(() => window.escanearAhora(), intervalo);
  })();

  if (typeof lucide !== "undefined") lucide.createIcons();
});

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
// PLANTILLA: fila de MAC confiable (compartida con panel.js)
// Debe coincidir con el <li> de partials/_panel_confiables.html
// ══════════════════════════════════════════
const CLASE_LI_CONFIABLE = "flex items-center gap-3 px-3.5 py-3 rounded-[10px] border border-slate-200/80 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-dark3/40 transition group";

function htmlLiConfiable(mac) {
  return `
    <span class="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0"></span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5">
        <p class="nombre-confiable font-medium text-solid truncate" style="font-size:14px">${t("noName")}</p>
        <button onclick="editarNombreConfiable('${esc(mac)}')" aria-label="Editar nombre" class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition flex-shrink-0">
          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <p class="tabular-nums text-slate-400 mt-0.5" style="font-size:12px">${esc(mac)}</p>
    </div>
    <button onclick="eliminarMAC('${esc(mac)}')" aria-label="Eliminar" class="text-slate-300 hover:text-rose-500 transition p-1 flex-shrink-0">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>`;
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
// NOTIFICACIONES (tonos apagados)
// ══════════════════════════════════════════
const COLORES_NOTI = {
  info:    "bg-white text-slate-700 border border-slate-200 dark:bg-dark3 dark:text-slate-200 dark:border-slate-700",
  success: "bg-brand-50 text-brand-700 border border-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/20",
  error:   "bg-[#fdf4f5] text-[#9f3a4a] border border-[#f3d9dd] dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
  warning: "bg-[#fcf9f2] text-[#8a6a1f] border border-[#efe3c6] dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
};
let _notiTimer = null;

function mostrarNotificacion(html, tipo = "info") {
  const noti = document.getElementById("notificacion");
  if (!noti) return;
  noti.innerHTML = html;
  noti.className = `fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-lg z-[70]
    text-[13px] font-medium max-w-xs w-full transition-all duration-300 ${COLORES_NOTI[tipo]}`;
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
  (() => {
    const lang = localStorage.getItem("lang") || "es";
    const info = SUPPORTED_LANGS[lang];
    if (!info) return;
    const flag  = $("langFlag");
    const label = $("langLabel");
    if (flag)  flag.className    = `fi fi-${info.country} rounded-sm flex-shrink-0`;
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
          li.className = CLASE_LI_CONFIABLE;
          li.innerHTML = htmlLiConfiable(mac);
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
          if (tdAct) tdAct.innerHTML = `<button onclick="marcarConfiable('${esc(mac)}',true,this)" class="btn-action btn-trust"><i data-lucide="shield-check"></i> <span data-i18n="trust_btn">${t("trust_btn")}</span></button>`;
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
  const htmlLapiz = `<i data-lucide="pencil" class="w-3.5 h-3.5"></i>`;
  const CLASE_LAPIZ = "text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300 transition";

  window.editarNombre = mac => {
    const fila  = document.querySelector(`tr[data-mac="${esc(mac.toLowerCase())}"]`);
    const celda = fila?.querySelector("td:nth-child(3)");
    if (!celda) return;
    const actual = celda.querySelector("span")?.innerText.trim() || "";
    const sid    = mac.replace(/:/g, "");

    _editandoNombre = true;

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-2";

    const inp = document.createElement("input");
    inp.id = `inp-${sid}`;
    inp.className = "pn-input";
    inp.style.cssText = "width:150px;height:32px;font-size:13px";
    inp.value = (actual === "?" ? "" : actual);
    inp.placeholder = t("noName");
    inp.maxLength = 64;

    const btn = document.createElement("button");
    btn.id = `btn-${sid}`;
    btn.className = "pn-btn";
    btn.style.cssText = "height:32px;padding:0 12px;font-size:13px";
    btn.textContent = t("guardar");

    wrapper.appendChild(inp);
    wrapper.appendChild(btn);
    celda.replaceChildren(wrapper);
    inp.focus();
    inp.select();

    const volverANombre = texto => {
      const w = document.createElement("div");
      w.className = "flex items-center gap-2";
      const span = document.createElement("span");
      span.className = "text-solid font-medium";
      span.textContent = texto;
      const editBtn = document.createElement("button");
      editBtn.onclick = () => editarNombre(mac);
      editBtn.className = CLASE_LAPIZ;
      editBtn.setAttribute("aria-label", "Editar nombre");
      editBtn.innerHTML = htmlLapiz;
      w.appendChild(span);
      w.appendChild(editBtn);
      celda.replaceChildren(w);
      if (typeof lucide !== "undefined") lucide.createIcons();
    };

    let _saved = false;
    const guardar = async () => {
      if (_saved) return;
      _saved = true;
      const nombre = inp.value.trim().slice(0, 64) || t("noName");

      volverANombre(nombre);

      if (fila) fila.dataset.nombre = nombre.toLowerCase();
      const li = $("lista-macs")?.querySelector(`li[data-mac="${esc(mac.toLowerCase())}"]`);
      const sp = li?.querySelector(".nombre-confiable");
      if (sp) sp.textContent = nombre;

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
        volverANombre(actual || "?");
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

  // ── Tabla (debe coincidir con partials/_device_table.html) ───────────────
  function crearFila(d) {
    const tr = document.createElement("tr");
    tr.className = "dev-row dispositivo-row transition-colors";
    tr.dataset.nombre    = (d.nombre || "").toLowerCase();
    tr.dataset.mac       = d.mac.toLowerCase();
    tr.dataset.confianza = d.confiable ? "confiable" : "no-confiable";

    const badgeConf = d.confiable
      ? `<span class="badge badge-green"><span data-i18n="trusted">${t("trusted")}</span></span>`
      : `<span class="badge badge-red"><span data-i18n="untrusted">${t("untrusted")}</span></span>`;

    const btnAccion = d.confiable
      ? `<button onclick="marcarConfiable('${esc(d.mac)}',false,this)" class="btn-action btn-untrust"><i data-lucide="shield-off"></i> <span data-i18n="untrust_btn">${t("untrust_btn")}</span></button>`
      : `<button onclick="marcarConfiable('${esc(d.mac)}',true,this)"  class="btn-action btn-trust"><i data-lucide="shield-check"></i> <span data-i18n="trust_btn">${t("trust_btn")}</span></button>`;

    tr.innerHTML = `
      <td class="px-5 tabular-nums font-medium text-solid">${esc(d.ip)}</td>
      <td class="px-5 tabular-nums text-slate-400 dark:text-slate-500" style="font-size:13px">${esc(d.mac)}</td>
      <td class="px-5">
        <div class="flex items-center gap-2">
          <span class="font-medium text-solid">${esc(d.nombre || "?")}</span>
          <button onclick="editarNombre('${esc(d.mac)}')" aria-label="Editar nombre" class="${CLASE_LAPIZ}">
            ${htmlLapiz}
          </button>
        </div>
      </td>
      <td class="px-5 text-slate-500 dark:text-slate-400" style="font-size:13px">${esc(d.fabricante || "?")}</td>
      <td class="px-5">${badgeConf}</td>
      <td class="px-5">${btnAccion}</td>
      <td class="px-5">
        <button onclick="verPuertos('${esc(d.ip)}')" class="btn-action btn-neutral">
          <i data-lucide="scan-search"></i> <span data-i18n="view_ports">${t("view_ports")}</span>
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

  // ── Puertos (filas .puerto-row definidas en _modal_puertos.html) ─────────
  window.verPuertos = ip => {
    const modal = $("modal-puertos");
    const cont  = $("contenido-puertos");
    cont.innerHTML = `<div class="flex flex-col items-center gap-2 py-5 text-slate-400" style="font-size:13px">
      <i data-lucide="scan-search" class="animate-pulse w-6 h-6"></i>
      ${t("scanning_ports").replace("{{ip}}", esc(ip))}
    </div>`;
    modal.classList.remove("hidden");
    if (typeof lucide !== "undefined") lucide.createIcons();

    postJSON("/api/puertos", { ip })
      .then(data => {
        if (!data.success) throw new Error(data.message);
        cont.innerHTML = data.puertos.length === 0
          ? `<div class="flex items-center gap-2.5 text-slate-600 dark:text-slate-300" style="font-size:14px">
               <i data-lucide="check-circle" class="w-4 h-4 flex-shrink-0 text-brand-500"></i> ${t("no_ports").replace("{{ip}}", esc(ip))}
             </div>`
          : `<p class="tabular-nums text-slate-400 mb-1" style="font-size:13px">${esc(ip)}</p>`
            + data.puertos.map(p =>
                `<div class="puerto-row">
                   <span>${esc(p.puerto)}</span>
                   <span class="svc">${esc(p.servicio)}</span>
                 </div>`
              ).join("");
        if (typeof lucide !== "undefined") lucide.createIcons();
      })
      .catch(() => {
        cont.innerHTML = `<div class="flex items-center gap-2.5 text-rose-600 dark:text-rose-300" style="font-size:14px">
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
      if (flag)  flag.className    = `fi fi-${info.country} rounded-sm flex-shrink-0`;
      if (label) label.textContent = info.label;
    }
    $("langMenu")?.classList.add("hidden");

    // Persistir el idioma en el servidor para que las alertas de Telegram
    // (hilo en segundo plano, sin sesión) usen el mismo idioma que la UI.
    try {
      await postJSON("/api/idioma", { idioma: lang });
    } catch {
      // Silencioso: no bloqueamos el cambio de idioma en la UI.
    }
  };

  // ── Filtro confianza ──────────────────────────────────────────────────────
  $("trustBtn")?.addEventListener("click", () => $("trustMenu")?.classList.toggle("hidden"));

  window.setTrustFilter = valor => {
    const map = {
      all:       { valor: "",             key: "filterAll",       dot: "bg-slate-400" },
      trusted:   { valor: "confiable",    key: "filterTrusted",   dot: "bg-brand-400" },
      untrusted: { valor: "no-confiable", key: "filterUntrusted", dot: "bg-slate-300" }
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

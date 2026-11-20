// ══════════════════════════════════════════
// panel.js — Paneles laterales, historial,
// estadísticas, perfil y configuración
// (depende de app.js: esc, t, mostrarNotificacion, htmlLiConfiable...)
// ══════════════════════════════════════════

// SESSION_TOTAL is injected by Flask into a data attribute on <body>:
// <body data-session="{{ session_timeout }}">
const SESSION_TOTAL = (parseInt(document.body.dataset.session) || 28800) * 1000;
let sessStart = Date.now(), warnShown = false;

// ── CSRF helper (mismo patrón que app.js) ──────────────────────────────────
function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}
function postJSON(url, body) {
  return fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken":  getCsrfToken()
    },
    body: JSON.stringify(body)
  }).then(r => r.json());
}

// ── Session timer ───────────────────────────────────────────────────────────
function keepAlive() {
  fetch("/api/scan").then(() => {
    sessStart = Date.now(); warnShown = false;
    document.getElementById("sess-warn")?.classList.add("hidden");
  });
}

function tickSession() {
  const remaining = SESSION_TOTAL - (Date.now() - sessStart);
  if (remaining <= 0) { window.location.href = "/login?timeout=1"; return; }
  const pct = (remaining / SESSION_TOTAL) * 100;
  const bar = document.getElementById("sess-bar");
  if (bar) {
    bar.style.width = pct + "%";
    bar.style.background = pct < 10 ? "#e11d48" : pct < 25 ? "#f59e0b" : "";
  }
  if (remaining < 600000 && !warnShown) {
    warnShown = true;
    document.getElementById("sess-warn")?.classList.remove("hidden");
  }
}
setInterval(tickSession, 1000);
tickSession();

// ── Panel helpers ────────────────────────────────────────────────────────────
const panelOverlay = document.getElementById("panel-overlay");
let _panelAbierto = null;

function abrirPanel(id) {
  cerrarTodosPaneles(false);
  const p = document.getElementById(id);
  if (!p) return;
  p.classList.add("open");
  panelOverlay?.classList.add("show");
  _panelAbierto = id;
}

function cerrarTodosPaneles(conOverlay = true) {
  ["panel-historial", "panel-confiables", "panel-perfil"].forEach(id =>
    document.getElementById(id)?.classList.remove("open")
  );
  if (conOverlay) panelOverlay?.classList.remove("show");
  _panelAbierto = null;
}

function abrirPanelHistorial()   { abrirPanel("panel-historial");  cargarHistorial(); iniciarAutoRefreshHistorial(); }
function cerrarPanelHistorial()  { cerrarTodosPaneles(); detenerAutoRefreshHistorial(); }
function abrirPanelConfiables()  { abrirPanel("panel-confiables"); }
function cerrarPanelConfiables() { cerrarTodosPaneles(); }
function cerrarPanelPerfil()     { cerrarTodosPaneles(); }

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    cerrarTodosPaneles();
    cerrarModal?.();
    cerrarConfig?.();
  }
});

document.getElementById("panel-overlay")?.addEventListener("click", cerrarTodosPaneles);

// ── Stat cards ───────────────────────────────────────────────────────────────
const _statCounters = {};

function _setStatNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  // Use null check so '?' (NaN) always triggers an update to 0
  const raw = parseInt(el.textContent);
  const current = isNaN(raw) ? null : raw;
  if (current === target) return;
  if (_statCounters[id]) clearInterval(_statCounters[id]);
  const diff  = target - current;
  const steps = Math.min(Math.abs(diff), 12);
  const step  = diff / steps;
  let val = current, count = 0;
  _statCounters[id] = setInterval(() => {
    count++;
    val += step;
    el.textContent = count >= steps ? target : Math.round(val);
    if (count >= steps) clearInterval(_statCounters[id]);
  }, 30);
}

function actualizarStats() {
  const rows = document.querySelectorAll(".dispositivo-row");
  let total = 0, trusted = 0, untrusted = 0;
  rows.forEach(r => {
    total++;
    r.dataset.confianza === "confiable" ? trusted++ : untrusted++;
  });
  _setStatNum("stat-total",     total);
  _setStatNum("stat-trusted",   trusted);
  _setStatNum("stat-untrusted", untrusted);
}

(function initStatsObserver() {
  const tbody = document.getElementById("tabla-dispositivos");
  if (!tbody) return;
  actualizarStats();
  new MutationObserver(() => actualizarStats()).observe(tbody, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ["data-confianza"]
  });
})();

// ── Nombre / perfil ────────────────────────────────────────────────────────────
function _syncNombreUI(nombre) {
  const sn   = document.getElementById("sidebar-user-name");
  const disp = document.getElementById("perfil-nombre-display");
  if (sn)   sn.textContent   = nombre;
  if (disp) disp.textContent = nombre;
}

fetch("/api/perfil").then(r => r.json()).then(data => {
  if (data.nombre_display) _syncNombreUI(data.nombre_display);
}).catch(() => {});

// Mensajes inline de los formularios del perfil
function _mostrarMsg(el, ok, texto) {
  if (!el) return;
  el.textContent = texto;
  el.className   = `${ok ? "text-brand-600 dark:text-brand-400" : "text-rose-600 dark:text-rose-300"}`;
  el.style.fontSize = "13px";
  el.classList.remove("hidden");
}

function abrirPerfil() {
  abrirPanel("panel-perfil");
  fetch("/api/perfil").then(r => r.json()).then(data => {
    const inp = document.getElementById("cfg-display-name");
    if (inp) inp.value = data.nombre_display || "";
    _syncNombreUI(data.nombre_display || data.usuario);

    // Si la cuenta es SSO, ocultar nombre y credenciales locales y mostrar el aviso
    // (el backend también bloquea ambos endpoints, esto es solo la UI).
    const esSso    = data.auth_provider === "sso";
    const bqNombre = document.getElementById("perfil-nombre-local");
    const bqCreds  = document.getElementById("perfil-credenciales-local");
    const aviso    = document.getElementById("perfil-sso-notice");
    if (bqNombre) bqNombre.classList.toggle("hidden", esSso);
    if (bqCreds)  bqCreds.classList.toggle("hidden", esSso);
    if (aviso)    aviso.classList.toggle("hidden", !esSso);
  }).catch(() => {});
}

async function guardarNombrePerfil() {
  const nombre = document.getElementById("cfg-display-name").value.trim();
  const msg    = document.getElementById("cfg-name-msg");
  try {
    const data = await postJSON("/api/perfil", { nombre_display: nombre });
    _mostrarMsg(msg, data.success, data.success ? `✓ ${t("profileNameSaved")}` : `✕ ${t("cfgError")}`);
    if (data.success) {
      _syncNombreUI(nombre || document.getElementById("sidebar-user-name").textContent);
      setTimeout(() => msg.classList.add("hidden"), 3000);
    }
  } catch {
    _mostrarMsg(msg, false, `✕ ${t("cfgError")}`);
  }
}

// ── Historial ──────────────────────────────────────────────────────────────────
let _histEvento = "", _histAutoTimer = null;

function setHistEvento(valor, labelKey, dotClass) {
  _histEvento = valor;
  const dot = document.getElementById("hist-evento-dot");
  const lbl = document.getElementById("histEventoLabel");
  if (dot) dot.className = `inline-block w-2 h-2 rounded-full ${dotClass} flex-shrink-0`;
  if (lbl) { lbl.setAttribute("data-i18n", labelKey); lbl.textContent = t(labelKey); }
  document.getElementById("histEventoMenu")?.classList.add("hidden");
  cargarHistorial();
}

function actualizarLabelHistorial() {
  const lbl = document.getElementById("histEventoLabel");
  if (lbl) { const k = lbl.getAttribute("data-i18n"); if (k) lbl.textContent = t(k); }
}

function toggleAutoRefresh(on) {
  on ? iniciarAutoRefreshHistorial() : detenerAutoRefreshHistorial();
}

function iniciarAutoRefreshHistorial() {
  detenerAutoRefreshHistorial();
  if (!document.getElementById("hist-auto")?.checked) return;
  _histAutoTimer = setInterval(cargarHistorial, 30000);
}

function detenerAutoRefreshHistorial() {
  if (_histAutoTimer) { clearInterval(_histAutoTimer); _histAutoTimer = null; }
}

async function cargarHistorial() {
  const mac  = document.getElementById("hist-mac")?.value.trim() || "";
  const cont = document.getElementById("historial-cards");
  const info = document.getElementById("hist-info");
  if (!cont) return;

  if (!cont.querySelector(".hist-card")) {
    cont.innerHTML = `<div class="text-center text-slate-400 py-8 flex items-center justify-center gap-2" style="font-size:13px">
      <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>${t("historyLoading")}</span>
    </div>`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  let url = "/api/historial?limit=150";
  if (mac) url += `&mac=${encodeURIComponent(mac)}`;
  if (_histEvento) url += `&evento=${encodeURIComponent(_histEvento)}`;

  try {
    const data = await fetch(url).then(r => r.json());
    if (!Array.isArray(data) || data.length === 0) {
      cont.innerHTML = `<div class="text-center text-slate-400 py-10 flex flex-col items-center gap-3" style="font-size:13px">
        <i data-lucide="inbox" class="w-6 h-6 opacity-30"></i><span>${t("historyNoData")}</span>
      </div>`;
      if (typeof lucide !== "undefined") lucide.createIcons();
      if (info) info.textContent = "";
      return;
    }

    cont.innerHTML = data.map(r => {
      const esConn   = r.evento === "conectado";
      const iconBg   = esConn ? "bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400";
      const evLabel  = `<span class="font-semibold ${esConn ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"}" style="font-size:14px">${t(esConn ? "historyConnected" : "historyDisconnected")}</span>`;
      const chip     = r.confiable
        ? `<span class="badge badge-green" style="font-size:12px">${t("historyTrusted")}</span>`
        : `<span class="badge badge-red" style="font-size:12px">${t("historyUntrusted")}</span>`;
      const fechaParts = r.fecha ? esc(r.fecha).split(" ") : ["?", ""];

      return `<div class="hist-card flex items-center gap-3">
        <div class="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center ${iconBg}">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            ${esConn
              ? '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
              : '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'}
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">${evLabel} ${chip}</div>
          <div class="flex flex-wrap gap-x-2.5 text-slate-400 dark:text-slate-500 mt-1" style="font-size:12px">
            <span class="tabular-nums">${esc(r.mac)}</span><span class="tabular-nums">${esc(r.ip)}</span>
            ${r.nombre     ? `<span class="text-solid font-medium">${esc(r.nombre)}</span>` : ""}
            ${r.fabricante ? `<span>${esc(r.fabricante)}</span>` : ""}
          </div>
        </div>
        <div class="text-right flex-shrink-0" style="font-size:12px">
          <p class="text-slate-400">${fechaParts[0]}</p>
          <p class="font-medium text-slate-500 dark:text-slate-400">${fechaParts[1] || ""}</p>
        </div>
      </div>`;
    }).join("");
    if (info) info.textContent = `${data.length} ${t("historyCount")}`;
  } catch {
    cont.innerHTML = `<div class="text-center text-rose-500 py-8" style="font-size:13px">${t("historyError")}</div>`;
  }
}

async function limpiarHistorial() {
  if (!confirm(t("historyClear") + "?")) return;
  const r = await postJSON("/api/historial/limpiar", {}).catch(() => null);
  if (r?.success) cargarHistorial();
}

let _histDebounce = null;
document.getElementById("hist-mac")?.addEventListener("input", () => {
  clearTimeout(_histDebounce);
  _histDebounce = setTimeout(() => { if (_panelAbierto === "panel-historial") cargarHistorial(); }, 400);
});

// ── Editar nombre en panel confiables ───────────────────────────────────────────
window.editarNombreConfiable = mac => {
  const li = document.querySelector(`#lista-macs li[data-mac="${esc(mac.toLowerCase())}"]`);
  if (!li) return;
  const sp = li.querySelector(".nombre-confiable");
  if (!sp) return;
  const actual = sp.textContent.trim();
  const sid    = mac.replace(/:/g, "");

  const inp = document.createElement("input");
  inp.id = `inp-c-${sid}`;
  inp.className = "pn-input flex-1 min-w-0";
  inp.style.cssText = "height:30px;font-size:13px";
  inp.placeholder = t("noName");
  inp.value = (actual === t("noName") || actual === "Sin nombre" || actual === "No name") ? "" : actual;
  inp.maxLength = 64;

  sp.replaceWith(inp);
  inp.focus();
  inp.select();

  let _saved = false;

  const restoreSpan = nombre => {
    const p = document.createElement("p");
    p.className = "nombre-confiable font-medium text-solid truncate";
    p.style.fontSize = "14px";
    p.textContent = nombre;
    inp.replaceWith(p);
  };

  const guardar = async () => {
    if (_saved) return;
    _saved = true;
    const nombre = inp.value.trim().slice(0, 64) || t("noName");
    restoreSpan(nombre);
    try {
      const d = await postJSON("/api/nombrar", { mac, nombre });
      if (d.success) {
        const tr = document.querySelector(`tr[data-mac="${esc(mac.toLowerCase())}"]`);
        if (tr) {
          tr.dataset.nombre = nombre.toLowerCase();
          const sp2 = tr.querySelector("td:nth-child(3) span");
          if (sp2) sp2.textContent = nombre;
        }
        mostrarNotificacion(`✓ ${t("nombre_guardado")}`, "success");
      } else {
        mostrarNotificacion(`✕ ${t("error_guardar_nombre")}`, "error");
      }
    } catch { mostrarNotificacion(`✕ ${t("error_guardar_nombre")}`, "error"); }
  };

  const cancelar = () => { if (_saved) return; _saved = true; restoreSpan(actual); };

  inp.addEventListener("blur", guardar);
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter")  { e.preventDefault(); inp.removeEventListener("blur", guardar); guardar(); }
    if (e.key === "Escape") { e.preventDefault(); inp.removeEventListener("blur", guardar); cancelar(); }
  });
};

// ── Configuración modal ──────────────────────────────────────────────────────────
async function abrirConfig() {
  document.getElementById("modal-config")?.classList.remove("hidden");
  try {
    const data = await fetch("/api/configuracion").then(r => r.json());
    document.getElementById("cfg-token").value     = data.telegram_token     || "";
    document.getElementById("cfg-chat").value      = data.telegram_chat_id   || "";
    document.getElementById("cfg-intervalo").value = data.intervalo_monitoreo || "120";
    document.getElementById("cfg-session").value   = ((parseInt(data.session_timeout) || 28800) / 3600).toFixed(1);
  } catch {}
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function cerrarConfig() {
  document.getElementById("modal-config")?.classList.add("hidden");
}

async function guardarConfig() {
  const token     = document.getElementById("cfg-token").value.trim();
  const chat      = document.getElementById("cfg-chat").value.trim();
  const intervalo = parseInt(document.getElementById("cfg-intervalo").value) || 120;
  const sessionH  = parseFloat(document.getElementById("cfg-session").value) || 8;
  const sessionS  = Math.max(300, Math.round(sessionH * 3600));
  try {
    const data = await postJSON("/api/configuracion", {
      telegram_token: token, telegram_chat_id: chat,
      intervalo_monitoreo: intervalo, session_timeout: sessionS
    });
    mostrarNotificacion(data.success ? `✓ ${t("cfgSaved")}` : `✕ ${t("cfgError")}`, data.success ? "success" : "error");
    if (data.success) cerrarConfig();
  } catch { mostrarNotificacion(`✕ ${t("cfgError")}`, "error"); }
}

async function testTelegram() {
  const token = document.getElementById("cfg-token").value.trim();
  const chat  = document.getElementById("cfg-chat").value.trim();
  // Guardar primero si hay token nuevo, luego testear
  if (token) {
    await postJSON("/api/configuracion", { telegram_token: token, telegram_chat_id: chat }).catch(() => {});
  }
  const res = await postJSON("/api/telegram/test", {}).catch(() => null);
  // El backend devuelve una clave (message_key) para traducir según el idioma activo.
  const texto = res?.message_key ? t(res.message_key) : t("cfgError");
  mostrarNotificacion(
    res?.success ? `✓ ${texto}` : `✕ ${texto}`,
    res?.success ? "success" : "error"
  );
}

function setIntervalo(val) { document.getElementById("cfg-intervalo").value = val; }

// ── Credenciales ─────────────────────────────────────────────────────────────────
async function guardarCredenciales() {
  const actual  = document.getElementById("cfg-pass-actual").value;
  const email   = document.getElementById("cfg-new-email").value.trim();
  const newPass = document.getElementById("cfg-new-pass").value;
  const confirm = document.getElementById("cfg-confirm-pass").value;
  const msg     = document.getElementById("cfg-cred-msg");
  if (!actual) {
    _mostrarMsg(msg, false, t("cfgCurrentPass") + " requerida");
    return;
  }
  try {
    const data = await postJSON("/api/cambiar-credenciales", {
      contrasena_actual: actual, nuevo_usuario: email,
      nueva_contrasena: newPass, confirmar_contrasena: confirm
    });
    // Si el backend manda message_key (ej. bloqueo por SSO) se traduce con t();
    // si no, se usa el texto plano (message) como en los demás casos.
    const texto = data.message_key ? t(data.message_key) : (data.message || t("cfgCredError"));
    _mostrarMsg(msg, data.success, data.success ? `✓ ${t("cfgCredSaved")}` : `✕ ${texto}`);
    if (data.success) setTimeout(() => msg.classList.add("hidden"), 3000);
  } catch {
    _mostrarMsg(msg, false, `✕ ${t("cfgCredError")}`);
  }
}

// ── Marcar confiable ─────────────────────────────────────────────────────────────
// NOTA: app.js también define window.marcarConfiable dentro de DOMContentLoaded
// y, al ejecutarse después, es la que realmente se usa. Esta versión queda como
// estaba, solo con el markup actualizado.
window.marcarConfiable = async (mac, hacerConfiable, btn) => {
  const endpoint = hacerConfiable ? "/api/agregar" : "/api/eliminar";
  try {
    const data = await postJSON(endpoint, { mac });
    if (!data.success) { mostrarNotificacion(`✕ ${t("connectionError")}`, "error"); return; }

    const tr = btn.closest("tr");
    if (!tr) return;
    tr.dataset.confianza = hacerConfiable ? "confiable" : "no-confiable";

    const tdConf = tr.querySelector("td:nth-child(5)");
    if (tdConf) {
      tdConf.innerHTML = hacerConfiable
        ? `<span class="badge badge-green"><span data-i18n="trusted">${t("trusted")}</span></span>`
        : `<span class="badge badge-red"><span data-i18n="untrusted">${t("untrusted")}</span></span>`;
    }
    btn.outerHTML = hacerConfiable
      ? `<button onclick="marcarConfiable('${esc(mac)}',false,this)" class="btn-action btn-untrust"><i data-lucide="shield-off"></i> <span data-i18n="untrust_btn">${t("untrust_btn")}</span></button>`
      : `<button onclick="marcarConfiable('${esc(mac)}',true,this)"  class="btn-action btn-trust"><i data-lucide="shield-check"></i> <span data-i18n="trust_btn">${t("trust_btn")}</span></button>`;
    if (typeof lucide !== "undefined") lucide.createIcons();
    mostrarNotificacion(hacerConfiable ? `✓ ${t("success")}` : `✓ ${t("eliminado")}`, "success");

    const lista = document.getElementById("lista-macs");
    if (hacerConfiable && lista) {
      const li = document.createElement("li");
      li.dataset.mac = mac.toLowerCase();
      li.className = CLASE_LI_CONFIABLE;
      li.innerHTML = htmlLiConfiable(mac);
      lista.appendChild(li);
      if (typeof lucide !== "undefined") lucide.createIcons();
    } else if (!hacerConfiable && lista) {
      lista.querySelector(`li[data-mac="${esc(mac.toLowerCase())}"]`)?.remove();
    }
  } catch { mostrarNotificacion(`✕ ${t("connectionError")}`, "error"); }
};

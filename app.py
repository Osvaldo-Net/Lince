from auth import *
from flask import Flask, render_template, request, redirect, session, jsonify
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler
import subprocess, re, os, socket, threading, time, requests, logging
from db import get_db

CACHE_INTERVALO   = 120
HISTORIAL_DIAS    = 30
DEFAULT_SESSION   = 8 * 3600

CACHE_RESULTADO   = []
_cache_lock       = threading.Lock()
_estado_anterior  = {}
_intervalo_actual = CACHE_INTERVALO

# ── Validación de MAC ────────────────────────────────────────────────────────
MAC_REGEX = re.compile(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$")

def mac_valida(mac: str) -> bool:
    return bool(MAC_REGEX.match(mac.lower()))

# ── Plantillas de alertas (multi-idioma) ──────────────────────────────────────
ALERT_TEMPLATES = {
    "es": "⚠️ NUEVO DISPOSITIVO\nIP: {ip}\nMAC: {mac}\nFAB: {fab}",
    "en": "⚠️ NEW DEVICE\nIP: {ip}\nMAC: {mac}\nVENDOR: {fab}",
    "fr": "⚠️ NOUVEL APPAREIL\nIP: {ip}\nMAC: {mac}\nFABRICANT: {fab}",
}

TEST_MESSAGES = {
    "es": "✅ Lince: conexión de prueba exitosa",
    "en": "✅ Lince: test connection successful",
    "fr": "✅ Lince : connexion de test réussie",
}

# ── App ──────────────────────────────────────────────────────────────────────
app = Flask(__name__)

# FIX #1: SECRET_KEY sin fallback débil — falla explícitamente si no está definida
secret = os.environ.get("SECRET_KEY")
if not secret:
    raise RuntimeError("SECRET_KEY no definida en variables de entorno. "
                       "Genera una con: openssl rand -hex 32")
app.secret_key = secret

# FIX #3: Protección CSRF global para todos los formularios y peticiones POST
csrf = CSRFProtect(app)

# FIX #2: Rate limiting global — /login tiene límite estricto
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],          # sin límite global por defecto
    storage_uri="memory://"
)

# FIX #6: Encabezados de seguridad HTTP
# CSP ajustada a los recursos externos que realmente usa la app:
#   - cdn.tailwindcss.com  (framework CSS/JS)
#   - cdn.jsdelivr.net     (flag-icons CSS)
#   - fonts.googleapis.com (hoja de estilos Geist)
#   - fonts.gstatic.com    (archivos woff2)
#   - unpkg.com            (lucide icons)
Talisman(
    app,
    force_https=False,
    content_security_policy={
        "default-src": "'self'",
        "script-src": (
            "'self' 'unsafe-inline' "
            "https://cdn.tailwindcss.com "
            "https://unpkg.com"
        ),
        "style-src": (
            "'self' 'unsafe-inline' "
            "https://cdn.jsdelivr.net "
            "https://fonts.googleapis.com"
        ),
        "font-src": (
            "'self' "
            "https://fonts.gstatic.com "
            "https://cdn.jsdelivr.net"
        ),
        "img-src": "'self' data: https://cdn.jsdelivr.net",
        "connect-src": "'self' https://unpkg.com",
    },
    content_security_policy_nonce_in=[],
    frame_options="DENY",
    referrer_policy="strict-origin-when-cross-origin"
)

iniciar_archivo_usuarios()

# FIX #5: Log con rotación para evitar disco lleno
logger  = logging.getLogger("accesos")
logger.setLevel(logging.INFO)
handler = RotatingFileHandler(
    "data/accesos.log",
    maxBytes=5 * 1024 * 1024,   # 5 MB por archivo
    backupCount=3               # mantiene hasta 4 archivos (actual + 3 backups)
)
logger.addHandler(handler)

def registrar_log(m): logger.info(m)

# ── Config ───────────────────────────────────────────────────────────────────
def obtener_config(clave, defecto=""):
    db  = get_db()
    row = db.execute("SELECT valor FROM configuracion WHERE clave=?", (clave,)).fetchone()
    db.close()
    return row["valor"] if row else defecto

def guardar_config(clave, valor):
    db = get_db()
    db.execute(
        "INSERT INTO configuracion(clave,valor) VALUES(?,?) "
        "ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor",
        (clave, str(valor))
    )
    db.commit(); db.close()

def get_session_timeout():
    try:
        return int(obtener_config("session_timeout", str(DEFAULT_SESSION)))
    except Exception:
        return DEFAULT_SESSION

def get_telegram_config():
    # FIX: preferir variables de entorno sobre la DB para tokens sensibles
    token = os.getenv("TELEGRAM_BOT_TOKEN") or obtener_config("telegram_token", "")
    chat  = os.getenv("TELEGRAM_CHAT_ID")   or obtener_config("telegram_chat_id", "")
    return token, chat

def get_intervalo():
    global _intervalo_actual
    try:
        _intervalo_actual = int(obtener_config("intervalo_monitoreo", str(CACHE_INTERVALO)))
    except Exception:
        _intervalo_actual = CACHE_INTERVALO
    return _intervalo_actual

def get_idioma_alertas():
    """Idioma usado para las alertas de Telegram. Se guarda por separado
    del idioma de la interfaz (que vive en localStorage del navegador),
    porque el hilo de escaneo en segundo plano no tiene acceso a eso."""
    idioma = obtener_config("idioma_alertas", "es")
    return idioma if idioma in ALERT_TEMPLATES else "es"

# ── Session timeout ──────────────────────────────────────────────────────────
@app.before_request
def verificar_sesion_timeout():
    rutas_publicas = ("/login", "/static")
    if any(request.path.startswith(r) for r in rutas_publicas):
        return
    if "usuario" in session:
        ultimo  = session.get("ultimo_acceso", 0)
        ahora   = time.time()
        timeout = get_session_timeout()
        if ahora - ultimo > timeout:
            session.clear()
            return redirect("/login?timeout=1")
        session["ultimo_acceso"] = ahora
        session.permanent = True
        app.permanent_session_lifetime = timedelta(seconds=timeout)

# ── Auth ─────────────────────────────────────────────────────────────────────
@app.route("/logout")
def logout():
    usuario = session.get("usuario")
    session.clear()
    registrar_log(f"Usuario {usuario} cerro sesion")
    return redirect("/login")

@app.route("/login", methods=["GET", "POST"])
@limiter.limit("10 per minute; 30 per hour")   # FIX #2: rate limit en login
@csrf.exempt                                    # login no tiene sesión previa que proteger
def login():
    timeout = request.args.get("timeout")
    if request.method == "POST":
        usuario    = request.form["usuario"]
        contrasena = request.form["contrasena"]
        if verificar_login(usuario, contrasena):
            session["usuario"]       = usuario
            session["ultimo_acceso"] = time.time()
            session.permanent        = True
            registrar_log(f"Login exitoso: {usuario}")
            if es_usuario_por_defecto(usuario) and es_contrasena_por_defecto(usuario):
                return redirect("/cambiar-credenciales")
            return redirect("/")
        registrar_log(f"Login fallido para: {usuario}")
        return render_template("login.html", error="Usuario o contraseña incorrectos")
    return render_template("login.html", timeout=timeout)

@app.route("/cambiar-credenciales", methods=["GET", "POST"])
def cambiar_credenciales():
    if "usuario" not in session:
        return redirect("/login")
    if request.method == "POST":
        nuevo_usuario = request.form["nuevo_usuario"].strip().lower()
        nueva         = request.form["nueva_contrasena"]
        confirmar     = request.form["confirmar_contrasena"]
        if not re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", nuevo_usuario):
            return render_template("cambiar_credenciales.html", error="El usuario debe ser un correo válido")
        if nueva != confirmar:
            return render_template("cambiar_credenciales.html", error="Las contraseñas no coinciden")
        if not es_contrasena_segura(nueva):
            return render_template("cambiar_credenciales.html", error="La contraseña no cumple los requisitos")
        cambiar_usuario(session["usuario"], nuevo_usuario)
        cambiar_contrasena_usuario(nuevo_usuario, nueva)
        session["usuario"] = nuevo_usuario
        return redirect("/")
    return render_template("cambiar_credenciales.html")

@app.route('/api/cambiar-credenciales', methods=['POST'])
def api_cambiar_credenciales():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    data              = request.get_json()
    nuevo_usuario     = data.get("nuevo_usuario", "").strip().lower()
    nueva             = data.get("nueva_contrasena", "")
    confirmar         = data.get("confirmar_contrasena", "")
    contrasena_actual = data.get("contrasena_actual", "")

    if not verificar_login(session["usuario"], contrasena_actual):
        return jsonify({"success": False, "message": "La contraseña actual es incorrecta"})
    if nuevo_usuario and not re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", nuevo_usuario):
        return jsonify({"success": False, "message": "El correo no tiene un formato válido"})
    if nueva:
        if nueva != confirmar:
            return jsonify({"success": False, "message": "Las contraseñas nuevas no coinciden"})
        if not es_contrasena_segura(nueva):
            return jsonify({"success": False, "message": "La contraseña no cumple los requisitos de seguridad"})

    usuario_actual = session["usuario"]
    if nuevo_usuario and nuevo_usuario != usuario_actual:
        cambiar_usuario(usuario_actual, nuevo_usuario)
        session["usuario"] = nuevo_usuario
        usuario_actual = nuevo_usuario
    if nueva:
        cambiar_contrasena_usuario(usuario_actual, nueva)

    return jsonify({"success": True, "usuario": usuario_actual})

# ── Helpers DB ───────────────────────────────────────────────────────────────
def obtener_confiables():
    db   = get_db()
    rows = db.execute("SELECT mac FROM mac_confiables").fetchall()
    db.close()
    return {r["mac"].lower() for r in rows}

def obtener_nombre(mac):
    db  = get_db()
    row = db.execute("SELECT nombre FROM nombres_dispositivos WHERE mac=?", (mac,)).fetchone()
    db.close()
    return row["nombre"] if row else None

def guardar_nombre(mac, nombre):
    db = get_db()
    db.execute(
        "INSERT INTO nombres_dispositivos(mac,nombre) VALUES(?,?) "
        "ON CONFLICT(mac) DO UPDATE SET nombre=excluded.nombre",
        (mac, nombre)
    )
    db.commit(); db.close()

def obtener_vendor_cache(oui):
    db  = get_db()
    row = db.execute("SELECT fabricante FROM vendor_cache WHERE oui=?", (oui,)).fetchone()
    db.close()
    return row["fabricante"] if row else None

def guardar_vendor_cache(oui, fabricante):
    db = get_db()
    db.execute(
        "INSERT INTO vendor_cache(oui,fabricante) VALUES(?,?) "
        "ON CONFLICT(oui) DO UPDATE SET fabricante=excluded.fabricante",
        (oui, fabricante)
    )
    db.commit(); db.close()

def obtener_deteccion(mac):
    db  = get_db()
    row = db.execute("SELECT * FROM detecciones_mac WHERE mac=?", (mac,)).fetchone()
    db.close()
    return row

def guardar_deteccion(mac, count, notificado, ultima):
    db = get_db()
    db.execute(
        "INSERT INTO detecciones_mac(mac,count,notificado,ultima_vista) VALUES(?,?,?,?) "
        "ON CONFLICT(mac) DO UPDATE SET count=excluded.count,"
        "notificado=excluded.notificado,ultima_vista=excluded.ultima_vista",
        (mac, count, int(notificado), ultima)
    )
    db.commit(); db.close()

def obtener_confiables_con_nombre():
    db   = get_db()
    rows = db.execute(
        "SELECT c.mac, n.nombre FROM mac_confiables c "
        "LEFT JOIN nombres_dispositivos n ON c.mac=n.mac ORDER BY c.mac"
    ).fetchall()
    db.close()
    return rows

# ── Historial ────────────────────────────────────────────────────────────────
def guardar_historial(dispositivos, ahora):
    global _estado_anterior
    macs_actuales   = {d["mac"] for d in dispositivos}
    macs_anteriores = set(_estado_anterior.keys())
    nuevos        = macs_actuales - macs_anteriores
    desconectados = macs_anteriores - macs_actuales
    registros = []
    for d in dispositivos:
        if d["mac"] in nuevos:
            registros.append({**d, "evento": "conectado", "ahora": ahora})
    for mac in desconectados:
        d = _estado_anterior[mac]
        registros.append({**d, "evento": "desconectado", "ahora": ahora})
    _estado_anterior = {d["mac"]: d for d in dispositivos}
    if not registros:
        return
    db = get_db()
    db.executemany(
        "INSERT INTO historial_dispositivos"
        "(mac,ip,fabricante,confiable,nombre,visto_en,evento) "
        "VALUES(:mac,:ip,:fabricante,:confiable,:nombre,:ahora,:evento)",
        registros
    )
    db.execute("DELETE FROM historial_dispositivos WHERE visto_en<?", (ahora - HISTORIAL_DIAS * 86400,))
    db.commit(); db.close()

# ── Fabricante ───────────────────────────────────────────────────────────────
def obtener_fabricante(mac):
    oui = mac.replace(":", "")[:6].upper()
    fab = obtener_vendor_cache(oui)
    if fab:
        return fab
    try:
        resp = requests.get(f"https://api.maclookup.app/v2/macs/{mac}", timeout=5)
        fab  = resp.json().get("company") or "Desconocido"
    except Exception:
        fab  = "Desconocido"
    if fab != "Desconocido":
        guardar_vendor_cache(oui, fab)
    return fab

# ── Escaneo ──────────────────────────────────────────────────────────────────
def obtener_red_local():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    return f"{ip}/24"

def escanear_red():
    red        = obtener_red_local()
    ahora      = time.time()
    confiables = obtener_confiables()

    # FIX #7: manejar TimeoutExpired en nmap — devuelve vacío si expira
    try:
        salida = subprocess.check_output(
            ["nmap", "-sn", "-PR", "-T3", "-n", red], timeout=60
        ).decode()
    except subprocess.TimeoutExpired:
        logging.getLogger("accesos").warning("nmap timeout en escaneo de red")
        return []
    except Exception as e:
        logging.getLogger("accesos").error("Error en nmap: %s", str(e))
        return []

    ips_vivas  = [l.split()[-1] for l in salida.splitlines() if "Nmap scan report for" in l]
    arp_table  = {}
    try:
        salida_arp = subprocess.check_output(["ip", "neigh", "show"]).decode()
        for linea in salida_arp.splitlines():
            if not any(s in linea.upper() for s in ["REACHABLE", "STALE"]):
                continue
            m = re.match(r"(\d+\.\d+\.\d+\.\d+)\s+dev\s+\S+\s+lladdr\s+([\da-f:]{17})", linea, re.I)
            if m:
                arp_table[m.group(1)] = m.group(2).lower()
    except Exception as e:
        logging.getLogger("accesos").warning("Error leyendo ARP: %s", str(e))

    dispositivos = []
    for ip in ips_vivas:
        mac = arp_table.get(ip)
        if not mac:
            continue
        fab       = obtener_fabricante(mac)
        confiable = mac in confiables
        nombre    = obtener_nombre(mac)
        dispositivos.append({"ip": ip, "mac": mac, "fabricante": fab, "confiable": confiable, "nombre": nombre})
        if not confiable:
            reg = obtener_deteccion(mac)
            if not reg:
                guardar_deteccion(mac, 1, False, ahora)
            else:
                count      = reg["count"] + 1
                notificado = reg["notificado"]
                guardar_deteccion(mac, count, notificado, ahora)
                if count >= 3 and not notificado:
                    enviar_telegram(mac, ip, fab)
                    guardar_deteccion(mac, count, True, ahora)

    threading.Thread(target=guardar_historial, args=(dispositivos, ahora), daemon=True).start()
    return dispositivos

def enviar_telegram(mac, ip, fab):
    token, chat = get_telegram_config()
    if not token or not chat:
        return
    idioma   = get_idioma_alertas()
    template = ALERT_TEMPLATES[idioma]
    msg      = template.format(ip=ip, mac=mac, fab=fab)
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat, "text": msg},
            timeout=5
        )
    except Exception:
        pass

def actualizar_cache():
    global CACHE_RESULTADO
    resultado = escanear_red()
    with _cache_lock:
        CACHE_RESULTADO = resultado

def escaneo_background():
    while True:
        try:
            actualizar_cache()
        except Exception as e:
            logging.getLogger("accesos").error("Error en escaneo background: %s", str(e))
        time.sleep(get_intervalo())

# ── Rutas principales ────────────────────────────────────────────────────────
@app.route('/')
def index():
    if 'usuario' not in session:
        return redirect('/login')
    with _cache_lock:
        devs = list(CACHE_RESULTADO)
    return render_template("index.html",
        dispositivos=devs,
        lista_confiables=obtener_confiables_con_nombre(),
        session_timeout=get_session_timeout(),
        usuario_actual=session.get("usuario", "")
    )

@app.route('/api/scan')
def api_scan():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    with _cache_lock:
        return jsonify(list(CACHE_RESULTADO))

# ── API MACs ─────────────────────────────────────────────────────────────────
@app.route('/api/agregar', methods=['POST'])
def api_agregar():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    # FIX #4: validar MAC antes de insertar en DB
    mac = request.json.get("mac", "").lower().strip()
    if not mac_valida(mac):
        return jsonify({"success": False, "message": "MAC no válida"}), 400
    db = get_db()
    db.execute("INSERT OR IGNORE INTO mac_confiables(mac) VALUES(?)", (mac,))
    db.commit(); db.close()
    actualizar_cache()
    return jsonify({"success": True})

@app.route('/api/eliminar', methods=['POST'])
def api_eliminar():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    # FIX #4: validar MAC antes de operar en DB
    mac = request.json.get("mac", "").lower().strip()
    if not mac_valida(mac):
        return jsonify({"success": False, "message": "MAC no válida"}), 400
    db = get_db()
    db.execute("DELETE FROM mac_confiables WHERE mac=?", (mac,))
    db.commit(); db.close()
    actualizar_cache()
    return jsonify({"success": True})

@app.route('/api/nombrar', methods=['POST'])
def api_nombrar():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    # FIX #4: validar MAC y limitar longitud del nombre
    mac    = request.json.get("mac", "").lower().strip()
    nombre = request.json.get("nombre", "").strip()[:64]
    if not mac_valida(mac):
        return jsonify({"success": False, "message": "MAC no válida"}), 400
    if not nombre:
        return jsonify({"success": False, "message": "Nombre vacío"}), 400
    guardar_nombre(mac, nombre)
    global CACHE_RESULTADO
    with _cache_lock:
        for d in CACHE_RESULTADO:
            if d["mac"] == mac:
                d["nombre"] = nombre
    return jsonify({"success": True, "mac": mac, "nombre": nombre})

@app.route('/api/puertos', methods=['POST'])
def api_puertos():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    ip = request.get_json().get("ip", "").strip()
    if not ip:
        return jsonify({"success": False, "message": "IP no proporcionada"})
    if not re.match(r"^\d{1,3}(\.\d{1,3}){3}$", ip):
        return jsonify({"success": False, "message": "IP no válida"})
    try:
        salida  = subprocess.check_output(
            ["nmap", "-T4", "-sT", "--top-ports", "100", "--open", "-n", ip], timeout=20
        ).decode()
        puertos = [
            {"puerto": p.split()[0], "servicio": p.split()[-1]}
            for p in salida.splitlines() if "/tcp" in p and "open" in p
        ]
        return jsonify({"success": True, "puertos": puertos})
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "message": "El escaneo tardó demasiado"})
    except Exception:
        logging.getLogger("accesos").warning("Error en escaneo de puertos para IP %s", ip)
        return jsonify({"success": False, "message": "Error al escanear puertos"})

# ── Historial ────────────────────────────────────────────────────────────────
@app.route('/api/historial')
def api_historial():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    mac    = request.args.get("mac", "").lower()
    evento = request.args.get("evento", "").lower()
    limit  = min(int(request.args.get("limit", 100)), 500)
    db     = get_db()
    # FIX: construcción de WHERE completamente parametrizada (sin f-string con datos)
    clauses = []
    params  = []
    if mac:
        clauses.append("mac=?"); params.append(mac)
    if evento in ("conectado", "desconectado"):
        clauses.append("evento=?"); params.append(evento)
    where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params.append(limit)
    rows = db.execute(
        f"SELECT mac,ip,fabricante,confiable,nombre,evento,"
        f"datetime(visto_en,'unixepoch','localtime') AS fecha "
        f"FROM historial_dispositivos {where_sql} ORDER BY visto_en DESC LIMIT ?",
        params
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/historial/limpiar', methods=['POST'])
def api_historial_limpiar():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    db = get_db()
    db.execute("DELETE FROM historial_dispositivos")
    db.commit(); db.close()
    return jsonify({"success": True})

# ── Perfil ───────────────────────────────────────────────────────────────────
@app.route('/api/perfil', methods=['GET'])
def api_perfil_get():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    db  = get_db()
    row = db.execute(
        "SELECT nombre_display FROM usuarios WHERE usuario=?",
        (session['usuario'],)
    ).fetchone()
    db.close()
    return jsonify({
        "usuario":        session['usuario'],
        "nombre_display": row["nombre_display"] if row and row["nombre_display"] else ""
    })

@app.route('/api/perfil', methods=['POST'])
def api_perfil_set():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    data   = request.get_json()
    nombre = data.get("nombre_display", "").strip()[:64]
    db     = get_db()
    db.execute(
        "UPDATE usuarios SET nombre_display=? WHERE usuario=?",
        (nombre, session['usuario'])
    )
    db.commit()
    db.close()
    return jsonify({"success": True, "nombre_display": nombre})

# ── Idioma de alertas ──────────────────────────────────────────────────────────
@app.route('/api/idioma', methods=['POST'])
def api_idioma_set():
    """Guarda el idioma que debe usarse para las alertas de Telegram.
    Se llama desde el frontend cada vez que el usuario cambia el idioma
    de la interfaz, para mantenerlos sincronizados."""
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    idioma = request.get_json().get("idioma", "es")
    if idioma not in ALERT_TEMPLATES:
        return jsonify({"success": False, "message": "Idioma no soportado"}), 400
    guardar_config("idioma_alertas", idioma)
    return jsonify({"success": True, "idioma": idioma})

# ── Configuración ─────────────────────────────────────────────────────────────
@app.route('/api/configuracion', methods=['GET'])
def api_config_get():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    token, chat = get_telegram_config()
    return jsonify({
        "telegram_token":      token,
        "telegram_chat_id":    chat,
        "intervalo_monitoreo": obtener_config("intervalo_monitoreo", str(CACHE_INTERVALO)),
        "session_timeout":     obtener_config("session_timeout", str(DEFAULT_SESSION)),
        "idioma_alertas":      get_idioma_alertas()
    })

@app.route('/api/configuracion', methods=['POST'])
def api_config_set():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    data = request.get_json()
    if "telegram_token" in data:
        guardar_config("telegram_token",   data["telegram_token"].strip())
    if "telegram_chat_id" in data:
        guardar_config("telegram_chat_id", data["telegram_chat_id"].strip())
    if "intervalo_monitoreo" in data:
        try:
            iv = max(30, int(data["intervalo_monitoreo"]))
            guardar_config("intervalo_monitoreo", iv)
            global _intervalo_actual
            _intervalo_actual = iv
        except Exception:
            return jsonify({"success": False, "message": "Intervalo inválido"})
    if "session_timeout" in data:
        try:
            st = max(300, int(data["session_timeout"]))
            guardar_config("session_timeout", st)
            app.permanent_session_lifetime = timedelta(seconds=st)
        except Exception:
            return jsonify({"success": False, "message": "Tiempo de sesión inválido"})
    if "idioma_alertas" in data:
        idioma = data["idioma_alertas"]
        if idioma in ALERT_TEMPLATES:
            guardar_config("idioma_alertas", idioma)
    return jsonify({"success": True})

@app.route('/api/telegram/test', methods=['POST'])
def api_telegram_test():
    if 'usuario' not in session:
        return jsonify({"error": "No autorizado"}), 401
    token, chat = get_telegram_config()
    if not token or not chat:
        return jsonify({"success": False, "message": "Token o Chat ID no configurados"})
    idioma = get_idioma_alertas()
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat, "text": TEST_MESSAGES.get(idioma, TEST_MESSAGES["es"])},
            timeout=5
        )
        ok = resp.json().get("ok", False)
        return jsonify({"success": ok, "message": "Mensaje enviado correctamente" if ok else "Error en Telegram"})
    except Exception:
        return jsonify({"success": False, "message": "No se pudo conectar con Telegram"})

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    threading.Thread(target=escaneo_background, daemon=True).start()
    app.run(host='0.0.0.0', port=5555)

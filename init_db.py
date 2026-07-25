import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, "data", "lan_guard.db")

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()
cur.execute("PRAGMA journal_mode=WAL")
cur.execute("PRAGMA synchronous=NORMAL")

cur.execute("""
CREATE TABLE IF NOT EXISTS usuarios (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario        TEXT UNIQUE NOT NULL,
    contrasena     TEXT NOT NULL,
    rol            TEXT NOT NULL,
    nombre_display TEXT DEFAULT '',
    auth_provider  TEXT NOT NULL DEFAULT 'local',
    debe_cambiar_credenciales INTEGER NOT NULL DEFAULT 0
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS mac_confiables (
    mac TEXT PRIMARY KEY
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS nombres_dispositivos (
    mac    TEXT PRIMARY KEY,
    nombre TEXT NOT NULL
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS vendor_cache (
    oui        TEXT PRIMARY KEY,
    fabricante TEXT NOT NULL
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS detecciones_mac (
    mac          TEXT PRIMARY KEY,
    count        INTEGER NOT NULL,
    notificado   INTEGER NOT NULL,
    ultima_vista REAL    NOT NULL
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS historial_dispositivos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    mac        TEXT    NOT NULL,
    ip         TEXT    NOT NULL,
    fabricante TEXT,
    confiable  INTEGER NOT NULL DEFAULT 0,
    nombre     TEXT,
    visto_en   REAL    NOT NULL,
    evento     TEXT    NOT NULL DEFAULT 'conectado'
)
""")
cur.execute("""
CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
)
""")

# ── Migraciones seguras (para DBs creadas con versiones anteriores) ──────────
try:
    cur.execute("ALTER TABLE historial_dispositivos ADD COLUMN evento TEXT NOT NULL DEFAULT 'conectado'")
    print("Columna 'evento' añadida a historial_dispositivos.")
except Exception:
    pass
try:
    cur.execute("ALTER TABLE usuarios ADD COLUMN nombre_display TEXT DEFAULT ''")
    print("Columna 'nombre_display' añadida a usuarios.")
except Exception:
    pass
try:
    # Marca si el usuario entra por SSO (no puede cambiar credenciales
    # locales, esas viven en el proveedor de identidad) o 'local' (formulario
    # de usuario/contraseña de siempre). Usuarios existentes quedan 'local'.
    cur.execute("ALTER TABLE usuarios ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'")
    print("Columna 'auth_provider' añadida a usuarios.")
except Exception:
    pass
try:
    # Reemplaza la vieja lógica de "contraseña por defecto" (dejó de tener
    # sentido al ser aleatoria) por un flag persistente que auth.py marca al
    # crear el admin inicial y limpia cuando cambia sus credenciales.
    cur.execute("ALTER TABLE usuarios ADD COLUMN debe_cambiar_credenciales INTEGER NOT NULL DEFAULT 0")
    print("Columna 'debe_cambiar_credenciales' añadida a usuarios.")
except Exception:
    pass
# ─────────────────────────────────────────────────────────────────────────────

cur.execute("CREATE INDEX IF NOT EXISTS idx_historial_mac    ON historial_dispositivos(mac)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_historial_visto  ON historial_dispositivos(visto_en)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_historial_evento ON historial_dispositivos(evento)")

# NOTA: la creación del usuario administrador por defecto (con contraseña
# aleatoria) NO vive acá — la maneja exclusivamente auth.py::iniciar_archivo_usuarios(),
# que se ejecuta automáticamente al arrancar app.py. Esto evita mantener el
# generador de contraseña duplicado en dos archivos.

conn.commit()
conn.close()
print("Lince database: schema initialized successfully.")

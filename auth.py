import sqlite3
import bcrypt
import re
import secrets
import string
from db import get_db

USUARIO_DEFECTO = "lince@admin.com"

# ── Generación de contraseña aleatoria ───────────────────────────────────────
_MAYUS      = string.ascii_uppercase
_MINUS      = string.ascii_lowercase
_NUMEROS    = string.digits
_ESPECIALES = "!@#$%^&*().,?_-+="

def _generar_password_segura(longitud=16):
    """Genera una contraseña aleatoria (criptográficamente segura) que
    cumple garantizadamente con es_contrasena_segura(): al menos una
    mayúscula, una minúscula, un número y un carácter especial."""
    obligatorios = [
        secrets.choice(_MAYUS),
        secrets.choice(_MINUS),
        secrets.choice(_NUMEROS),
        secrets.choice(_ESPECIALES),
    ]
    alfabeto_completo = _MAYUS + _MINUS + _NUMEROS + _ESPECIALES
    resto = [secrets.choice(alfabeto_completo) for _ in range(longitud - len(obligatorios))]
    caracteres = obligatorios + resto
    secrets.SystemRandom().shuffle(caracteres)
    return "".join(caracteres)

def _imprimir_banner_admin(usuario, password):
    """Banner multi-idioma con las credenciales del admin recién creado.
    Se imprime UNA sola vez, en la primera instalación. No se vuelve a
    mostrar: la contraseña real solo vive hasteada en la DB."""
    ancho = 64
    linea = "═" * ancho
    print(linea)
    print("  🦁 LINCE — 🇪🇸 Usuario admin creado / 🇬🇧 Admin user created / 🇫🇷 Admin créé")
    print(linea)
    print(f"   username / usuario / utilisateur : {usuario}")
    print(f"   password / contraseña / mot de passe : {password}")
    print(linea)
    print("  🇪🇸 Guardá esta contraseña ahora, no se vuelve a mostrar.")
    print("     Se te pedirá cambiarla en el primer inicio de sesión.")
    print("  🇬🇧 Save this password now, it will not be shown again.")
    print("     You'll be asked to change it on first login.")
    print("  🇫🇷 Enregistrez ce mot de passe maintenant, il ne sera plus affiché.")
    print("     On vous demandera de le changer à la première connexion.")
    print(linea)

def iniciar_archivo_usuarios():
    db = get_db()
    db.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        contrasena TEXT NOT NULL,
        rol TEXT NOT NULL,
        nombre_display TEXT DEFAULT '',
        auth_provider TEXT NOT NULL DEFAULT 'local',
        debe_cambiar_credenciales INTEGER NOT NULL DEFAULT 0
    )
    """)
    # Migración segura: si la tabla ya existía de una versión anterior sin
    # esta columna, se agrega ahora. No falla si ya existe.
    try:
        db.execute("ALTER TABLE usuarios ADD COLUMN debe_cambiar_credenciales INTEGER NOT NULL DEFAULT 0")
    except Exception:
        pass

    # FIX: se crea el admin local solo en una instalación 100% nueva (tabla
    # vacía). Si ya existe cualquier usuario -local o creado por SSO- no se
    # toca nada; esto evita crear una cuenta admin local extra en un deploy
    # que ya viene usando OIDC desde el arranque.
    cur = db.execute("SELECT COUNT(*) AS total FROM usuarios")
    if cur.fetchone()["total"] == 0:
        password_generada = _generar_password_segura()
        hash_pwd = bcrypt.hashpw(password_generada.encode(), bcrypt.gensalt(12)).decode()
        try:
            # FIX: si corren varios workers (gunicorn) en paralelo, más de
            # uno podría pasar el chequeo COUNT==0 antes de que cualquiera
            # inserte. La constraint UNIQUE sobre 'usuario' es la red de
            # seguridad real: solo el primero que llega inserta, el resto
            # recibe IntegrityError y no imprime ni crea nada.
            db.execute(
                "INSERT INTO usuarios (usuario, contrasena, rol, debe_cambiar_credenciales) "
                "VALUES (?, ?, ?, ?)",
                (USUARIO_DEFECTO, hash_pwd, "admin", 1)
            )
            db.commit()
            _imprimir_banner_admin(USUARIO_DEFECTO, password_generada)
        except sqlite3.IntegrityError:
            # Otro worker ya lo creó en paralelo — no hacer nada.
            db.rollback()
    db.close()

def verificar_login(usuario, contrasena):
    db = get_db()
    cur = db.execute("SELECT contrasena FROM usuarios WHERE usuario = ?", (usuario,))
    row = cur.fetchone()
    db.close()
    if not row:
        return False
    return bcrypt.checkpw(contrasena.encode(), row["contrasena"].encode())

def es_contrasena_segura(contra):
    especiales = "!@#$%^&*(),.?\":{}|<>_-+=/\\[]~"
    reglas = [
        len(contra) >= 8,
        re.search(r"[A-Z]", contra),
        re.search(r"[a-z]", contra),
        re.search(r"[0-9]", contra),
        re.search(rf"[{re.escape(especiales)}]", contra)
    ]
    return all(reglas)

def cambiar_usuario(usuario_actual, nuevo_usuario):
    db = get_db()
    db.execute("UPDATE usuarios SET usuario = ? WHERE usuario = ?",
               (nuevo_usuario, usuario_actual))
    db.commit()
    db.close()

def cambiar_contrasena_usuario(usuario, nueva):
    hash_pwd = bcrypt.hashpw(nueva.encode(), bcrypt.gensalt(12)).decode()
    db = get_db()
    db.execute("UPDATE usuarios SET contrasena = ? WHERE usuario = ?",
               (hash_pwd, usuario))
    db.commit()
    db.close()

# ── Reemplaza a es_contrasena_por_defecto / es_usuario_por_defecto ──────────
# Ya no comparamos contra una contraseña fija (ahora es aleatoria); usamos
# un flag persistente en la DB que se limpia al cambiar credenciales.
def debe_cambiar_credenciales(usuario):
    db = get_db()
    cur = db.execute(
        "SELECT debe_cambiar_credenciales FROM usuarios WHERE usuario = ?",
        (usuario,)
    )
    row = cur.fetchone()
    db.close()
    if not row:
        return False
    return bool(row["debe_cambiar_credenciales"])

def limpiar_flag_cambio_credenciales(usuario):
    db = get_db()
    db.execute(
        "UPDATE usuarios SET debe_cambiar_credenciales = 0 WHERE usuario = ?",
        (usuario,)
    )
    db.commit()
    db.close()

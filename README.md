<div >

<img src="https://github.com/user-attachments/assets/3b5df5b6-2de6-4363-974f-f0ed2b23b499" ancho="120" alt=„Logotipo de Lince" />

# Lince

**Monitoreo de red y seguridad autohospedados, desde su propio servicio.**

[![Docker](https://img.shields.io/badge/docker-netosvaltools%2Flince-0ea5e9?style=flat-square&logo=docker&logoColor=white&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Docker tira](https://img.shields.io/docker/pulls/netosvaltools/lince?style=flat-square&color=0ea5e9&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Idiomas](https://img.shields.io/badge/languages-ES%20%7C%20EN%20%7C%20FR-10b981?style=flat-square&labelColor=0f172a)](#)
[![Versión](https://img.shields.io/badge/version-4.0-6366f1?style=flat-square&labelColor=0f172a)](#)

**¿Hablas español?** Lee la documentación completa [aqui](https://github.com/Osvaldo-Net/Lince/blob/main/README-ES.md).

</div>

---

## ¿Qué es Lince?

Lince es una aplicación web autohospedada para **Escaneo y monitoreo avanzados de su red local**. Combina **Mapa N** y **ARP** para identificar cada dispositivo conectado, clasificados como confiables o no confiables y alertarlo instantáneamente a viajes de **Telegrama** si aparece algo espercoso.

No se requiere configuración manual de la interfaz de red: Lince **autodetecta** el segmento de rojo en el que se ejecuta. Todos los datos se almacenan localmente con **SQLite**, Sin dependencias de la nube.

---

## Capturas de pantalla

**Panel de control**

![Panel de control](https://github.com/user-attachments/assets/f0f1f1b7-d4bc-4db7-bbdc-f561897b0b97)



**Escaneo**
![Escaneo](https://github.com/user-attachments/assets/9f428aaa-15d9-4dba-9be7-c3868939431d)


**Historia**
![Historia](https://github.com/user-attachments/assets/84a003c6-6fa1-4970-bf50-5c4d308f6a59)


**Modo oscuro**
![Modo oscuro](https://github.com/user-attachments/assets/2e23da99-06cb-4dbc-8093-8886b1e5d70f)

"centro"

alinear Características

| Categoría | Detalles |
|---|---|
 ¿Qué es Lince?img **Escaneo "centro"alinear| Detecta automáticamente un segmento de rojo, Nmap + ARP, intervalo de escaneo configurable |
| **Panel de control** | Tarjetas estadísticas (totales / confiables / no confiables) con contadores animados en vivo |
| **Dispositivos** | Nombres personalizados, bolsa de fabricantes, escaneo de puertos por dispositivo |
| **Gestión de confianza** | Marque/desmarque los dispositivos como confiables directamente desde la mesa o el panel lateral |
| **Historia** | Registro completo de conexión/desconexión con actualización automática y filtro MAC |
| **Alertas** | Notificaciones de Telegram en tiempo real para dispositivos no confiables, enviadas en el idioma seleccionado en la interfaz de usuario |
| **Autenticación** | Inicio de sesión local o SSO a viajes de OIDC (ver más bajo) |
| **Perfil** | Mostrar cambio de nombre, correo electrónico y contraste desde el panel lateral del perfil |
| **UI** | Modo oscuro, interruptor de idioma ES/EN/FR, barra lateral responsiva, paneles deslizables |
| **Almacenamiento** | SQLite liviano, no se necesita base de datos externa |

---

## Instalación

### 1. Variables de establecimiento del entorno

Crea un `.env` archivo en el mismo director:
**Panel de control
, Sin dependencias de la nube.
<img src="https://github.com/user-attachments/assets/3b5df5b6-2de6-4363-974f-f0ed2b23b499" ancho="120" alt=„Logotipo de Lince" />

Género una clave segura con:
```bash
openssl rand -hex 32
```

### 2. Implementar con Docker Compose
```yaml
Servicios:
  Lince:
    nombre_contenedor: Lince
    imagen: netosvaltools/lince:latest
    # imagen: netosvaltools/lince:v4.0
    medio ambiente:
      CLAVE_SECRETA: ${CLAVE_SECRETA}
    volúmenes:
      - /etc/localtime:/etc/localtime:ro
      - ./datos:/aplicación/datos
    modo_rojo: "anfitrión"
    cap_add:
      - NET_RAW
      - NET_ADMIN
    reiniciar: a menos que se detenga
```
```bash
docker compone -d
```

> ⚠️ `modo_red: host` es necesario para el escaneo LAN. Cambiar `CLAVE_SECRETA` antes de pasar una producción.

---

 Marque/desmarque los dispositivos como confiables directamente desde la mesa o el panel lateral 

Abra la interfaz web desde su navegador utilizando la IP del servidor en el puerto SQLite liviano, no se necesita base de datos externa 5555**:
```
http://<server-IP>:5555
```

**Configuración por primera vez — contraste de administración aleatoria:**

En el primer inicio (solo si ahora no existen usuarios — no hay cuentas locales o SSO), Lince crea automáticamente una cuenta de administrador con una contraseña generada aleatoriamente y la imprime **una vez** a los registros del contador:

```bash
registros de composición de Docker -f
```

Verás algo como esto:

```
════════════════════════════════════════════════════════════════
  🦁 LINCE — 🇪🇸 Usuario admin creado / 🇬🇧 Administrador usuario creado / 🇫🇷 Administrador créé
════════════════════════════════════════════════════════════════
   nombre de usuario / usuario / utilizador: lince@admin.com
   contraseña / contraseña / mot de passe: <generado aleatoriamente>
════════════════════════════════════════════════════════════════
```

| Campo | Valor |
|---|---|
| Nombre de usuario  file (this also wipes trusted devices and history), then restart — Lince will generate a new password and print it again in the logs.    cap_add:`lince@admin.com` |
| Contraseña | *Se muestra solo una vez en los registros del primer inicio: full list with inline name editing, add/remove without reload |

> ⚠️ Copia esa contraseña de inmediato — nunca se vale a más y no se puede recuperar de la base de datos (se almacena como un hash bcrypt, no en texto sin formato). Se le pedirá que lo cambie en su primer inicio de sesión.


---

## Paneles laterales

Lince utiliza paneles deslizables en lugar de saturar la vista principal:

- **Historia**: línea de tiempo de conexión/desconexión, filtrable por MAC y tipo de evento
- **Dispositivos confiables**: lista completa con educación de nombres en línea, agregar/eliminar sin registrador
- **Perfil**: más nombre, credenciales (correo electrónico + contraseña), información de la sesión

---

## Actualización
```bash
docker compose pull
docker compone -d
```

---

## Variables ambientales

| Variable | Descripción | Requerido |
|---|---|-----|
| `CLAVE_SECRETA` | Clave secreta para el cifrado de sesiones | ✅ Sí |
| `OIDC_ISSUER` | URL de su probador OIDC (emisor) | Sólo para SSO |
| `ID_CLIENTE_OIDC` | ID de cliente registrado con probador OIDC | Sólo para SSO |
| `OIDC_CLIENT_SECRET` | Client secret registered with your OIDC provider | Only for SSO |
| `PUBLIC_URL` | Public URL of your Lince instance, required to build the correct redirect URL | ✅ Yes (if using SSO) |
| `OIDC_AUTO_CREATE` | Automatically create a user on first SSO login (`true`/`false`) | No |
| `DISABLE_LOCAL_LOGIN` | Disable local (email/password) login, only allow SSO (`true`/`false`) | No |

---

## SSO Authentication via OIDC

Lince supports Single Sign-On (SSO) through any OIDC-compliant provider (Authelia, Keycloak, Authentik, etc.).

By default, local login stays enabled alongside OIDC, so you can use both methods at the same time. Set `DISABLE_LOCAL_LOGIN=true` if you want to allow SSO login only.

### Example configuration
```env
OIDC_ISSUER=https://auth.domain.com
OIDC_CLIENT_ID=lince
OIDC_CLIENT_SECRET=xxxxxxxxxxxx
PUBLIC_URL=https://your-lince-instance.com
OIDC_AUTO_CREATE=true
DISABLE_LOCAL_LOGIN=false
```

> ⚠️ `PUBLIC_URL` is required: Lince uses it to build the OIDC redirect URL correctly.

### Redirect URL to register with your provider
```
https://lince.example.com/login/sso/callback
```
### Example client config (Authelia)
```yaml
      - client_id: 'lince'
        client_name: 'Lince'
        client_secret: '$xxxxx'
        public: false
        authorization_policy: 'default_policy'
        claims_policy: 'lince_claims'
        consent_mode: 'pre-configured'
        pre_configured_consent_duration: 1w
        require_pkce: true
        pkce_challenge_method: 'S256'
        grant_types:
          - authorization_code
        response_types:
          - code
        scopes:
          - 'openid'
          - 'email'
          - 'profile'
        redirect_uris:
          - 'https://lince.example.com/login/sso/callback'
        token_endpoint_auth_method: 'client_secret_basic'
        access_token_signed_response_alg: 'none'
        userinfo_signed_response_alg: 'none'
      lince_claims:
        id_token:
          - 'email'
          - 'preferred_username'
          - 'profile'
          - 'name'
```

---

### Nginx reverse proxy example
```nginx
server {
    listen 443 ssl;
    server_name lince.example.com;

    ssl_certificate     /etc/ssl/certs/lince.example.com.crt;
    ssl_certificate_key /etc/ssl/private/lince.example.com.key;

    location / {
        proxy_pass http://192.168.1.50:5555;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Access log

The access log is stored at:
```
/app/data/accesos.log
```

---

## Security note

**Lince must never be exposed directly to the internet, under any circumstances.** It is designed to run inside your local network only. If you need remote access, use a VPN such as WireGuard, OpenVPN, or Tailscale, or place it behind an authenticated reverse proxy on your own private network, never open its port directly to the public internet.

---

## About this project

Lince is a hobby project, built in my free time out of a personal interest in networking, cybersecurity, and homelabs. It's developed with the help of AI tools, which speeds up the process and lets me experiment more, but every feature is tested and refined by hand before release.

There's no commercial goal behind it just the fun of building something useful for my own home network, and sharing it in case it's useful for yours too.

---

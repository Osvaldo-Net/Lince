<div align="center">

<img src="https://github.com/user-attachments/assets/3b5df5b6-2de6-4363-974f-f0ed2b23b499" width="120" alt="Lince logo" />

# Lince

**Monitorización de red y seguridad autoalojada, desde tu propio servidor.**

[![Docker](https://img.shields.io/badge/docker-netosvaltools%2Flince-0ea5e9?style=flat-square&logo=docker&logoColor=white&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Docker Pulls](https://img.shields.io/docker/pulls/netosvaltools/lince?style=flat-square&color=0ea5e9&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Languages](https://img.shields.io/badge/languages-ES%20%7C%20EN%20%7C%20FR-10b981?style=flat-square&labelColor=0f172a)](#)
[![Version](https://img.shields.io/badge/version-4.0.1-6366f1?style=flat-square&labelColor=0f172a)](#)

**Do you speak English?** Read the full documentation [here](https://github.com/Osvaldo-Net/Lince/blob/main/README.md).

</div>

---

## ¿Qué es Lince?

Lince es una aplicación web autoalojada para el **escaneo y monitorización avanzada de tu red local**. Combina **Nmap** y **ARP** para identificar cada dispositivo conectado, clasificarlo como confiable o no confiable, y alertarte al instante vía **Telegram** si algo sospechoso aparece.

No requiere configuración manual de interfaz de red: Lince **detecta automáticamente** el segmento de red en el que se ejecuta. Todos los datos se almacenan localmente con **SQLite**, sin dependencias en la nube.

---

## Capturas de pantalla

**Panel principal**

![Dashboard](https://github.com/user-attachments/assets/f0f1f1b7-d4bc-4db7-bbdc-f561897b0b97)



**Escaneo**
![Scanning](https://github.com/user-attachments/assets/9f428aaa-15d9-4dba-9be7-c3868939431d)


**Historial**
![History](https://github.com/user-attachments/assets/84a003c6-6fa1-4970-bf50-5c4d308f6a59)


**Modo oscuro**
![Dark mode](https://github.com/user-attachments/assets/2e23da99-06cb-4dbc-8093-8886b1e5d70f)

---

## Funcionalidades

| Categoría | Detalles |
|---|---|
| **Escaneo** | Detecta automáticamente el segmento de red, Nmap + ARP, intervalo de escaneo configurable |
| **Panel principal** | Tarjetas de estadísticas (total / confiables / no confiables) con contadores animados en vivo |
| **Dispositivos** | Nombres personalizados, búsqueda de fabricante, escaneo de puertos por dispositivo |
| **Gestión de confianza** | Marcar/desmarcar dispositivos como confiables directamente desde la tabla o el panel lateral |
| **Historial** | Registro completo de conexión/desconexión con actualización automática y filtro por MAC |
| **Alertas** | Notificaciones de Telegram en tiempo real para dispositivos no confiables, enviadas en el idioma seleccionado en la interfaz |
| **Autenticación** | Inicio de sesión local o SSO vía OIDC (ver más abajo) |
| **Perfil** | Cambio de nombre visible, correo y contraseña desde el panel lateral de perfil |
| **Interfaz** | Modo oscuro, cambio de idioma ES/EN/FR, barra lateral adaptable, paneles deslizantes |
| **Almacenamiento** | SQLite ligero, no necesita base de datos externa |

---

## Instalación

### 1. Configurar variables de entorno

Crea un archivo `.env` en el mismo directorio:
```env
SECRET_KEY=your_secure_key_here
```

Genera una clave segura con:
```bash
openssl rand -hex 32
```

### 2. Desplegar con Docker Compose
```yaml
services:
  Lince:
    container_name: Lince
    image: netosvaltools/lince:latest
    # image: netosvaltools/lince:v4.0
    environment:
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - ./data:/app/data
    network_mode: "host"
    cap_add:
      - NET_RAW
      - NET_ADMIN
    restart: unless-stopped
```
```bash
docker compose up -d
```

> ⚠️ `network_mode: host` es necesario para el escaneo de la LAN. Cambia `SECRET_KEY` antes de pasar a producción.

---

## Primer acceso

Abre la interfaz web desde tu navegador usando la IP del servidor en el puerto **5555**:
```
http://<IP-del-servidor>:5555
```

**Configuración inicial: contraseña de administrador aleatoria:**

En el primer arranque (solo si aún no existen usuarios, ni locales ni de SSO), Lince crea automáticamente una cuenta de administrador con una contraseña generada aleatoriamente y la imprime **una sola vez** en los logs del contenedor:

```bash
docker compose logs -f
```

Verás algo como esto:

<img width="767" height="220" alt="image" src="https://github.com/user-attachments/assets/2ca91146-ec8c-445a-8e90-1b204c8208b9" />


| Campo | Valor |
|---|---|
| Usuario | `lince@admin.com` |
| Contraseña | *se muestra solo una vez en los logs en el primer arranque* |

> ⚠️ Copia esa contraseña de inmediato: no se vuelve a mostrar y no se puede recuperar desde la base de datos (se almacena como hash bcrypt, no en texto plano). Se te pedirá cambiarla en tu primer inicio de sesión.


---

## Paneles laterales

Lince utiliza paneles deslizantes en lugar de saturar la vista principal:

- **Historial**: cronología de conexión/desconexión, filtrable por MAC y tipo de evento
- **Dispositivos confiables**: lista completa con edición de nombre en línea, añadir/eliminar sin recargar
- **Perfil**: nombre visible, credenciales (correo + contraseña), información de sesión

---

## Actualización
```bash
docker compose pull
docker compose up -d
```

---

## Variables de entorno

| Variable | Descripción | Obligatoria |
|---|---|---|
| `SECRET_KEY` | Clave secreta para el cifrado de sesión | ✅ Sí |
| `OIDC_ISSUER` | URL de tu proveedor OIDC (issuer) | Solo para SSO |
| `OIDC_CLIENT_ID` | ID de cliente registrado con tu proveedor OIDC | Solo para SSO |
| `OIDC_CLIENT_SECRET` | Secreto de cliente registrado con tu proveedor OIDC | Solo para SSO |
| `PUBLIC_URL` | URL pública de tu instancia de Lince, necesaria para construir la URL de redirección correcta | ✅ Sí (si usas SSO) |
| `OIDC_AUTO_CREATE` | Crea automáticamente un usuario en el primer inicio de sesión SSO (`true`/`false`) | No |
| `DISABLE_LOCAL_LOGIN` | Deshabilita el inicio de sesión local (correo/contraseña), permite solo SSO (`true`/`false`) | No |

---

## Autenticación SSO vía OIDC

Lince soporta inicio de sesión único (SSO) a través de cualquier proveedor compatible con OIDC (Authelia, Keycloak, Authentik, etc.).

Por defecto, el inicio de sesión local permanece habilitado junto con OIDC, para que puedas usar ambos métodos a la vez. Establece `DISABLE_LOCAL_LOGIN=true` si quieres permitir únicamente el inicio de sesión por SSO.

### Ejemplo de configuración
```env
OIDC_ISSUER=https://auth.domain.com
OIDC_CLIENT_ID=lince
OIDC_CLIENT_SECRET=xxxxxxxxxxxx
PUBLIC_URL=https://your-lince-instance.com
OIDC_AUTO_CREATE=true
DISABLE_LOCAL_LOGIN=false
```

> ⚠️ `PUBLIC_URL` es obligatoria: Lince la usa para construir correctamente la URL de redirección de OIDC.

### URL de redirección a registrar con tu proveedor
```
https://lince.example.com/login/sso/callback
```
### Ejemplo de configuración de cliente (Authelia)
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

### Ejemplo de proxy inverso Nginx
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

## Registro de accesos

El registro de accesos se almacena en:
```
/app/data/accesos.log
```

---

## Nota de seguridad

**Lince nunca debe exponerse directamente a internet, bajo ninguna circunstancia.** Está diseñado para funcionar únicamente dentro de tu red local. Si necesitas acceso remoto, usa una VPN como WireGuard, OpenVPN o Tailscale, o colócalo detrás de un proxy inverso autenticado en tu propia red privada; nunca abras su puerto directamente al internet público.

---

## Sobre este proyecto

Lince es un proyecto de afición, construido en mi tiempo libre por interés personal en redes, ciberseguridad y homelabs. Se desarrolla con ayuda de herramientas de IA, lo que agiliza el proceso y me permite experimentar más, pero cada función se prueba y se refina a mano antes de publicarse.

No hay ningún objetivo comercial detrás; solo la diversión de construir algo útil para mi propia red doméstica, y compartirlo por si también te resulta útil a ti.

---

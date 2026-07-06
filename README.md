<div align="center">

<img src="https://github.com/user-attachments/assets/3b5df5b6-2de6-4363-974f-f0ed2b23b499" width="120" alt="Lince logo" />

# Lince

**Network monitoring and security self-hosted, from your own server.**

[![Docker](https://img.shields.io/badge/docker-netosvaltools%2Flince-0ea5e9?style=flat-square&logo=docker&logoColor=white&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Docker Pulls](https://img.shields.io/docker/pulls/netosvaltools/lince?style=flat-square&color=0ea5e9&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Languages](https://img.shields.io/badge/languages-ES%20%7C%20EN%20%7C%20FR-10b981?style=flat-square&labelColor=0f172a)](#)
[![Version](https://img.shields.io/badge/version-3.1.5-6366f1?style=flat-square&labelColor=0f172a)](#)

**¿Hablas español?** Lee la documentación completa [aquí](https://github.com/Osvaldo-Net/Lince/blob/main/README-ES.md).

</div>

---

## What is Lince?

Lince is a self-hosted web application for **advanced scanning and monitoring of your local network**. It combines **Nmap** and **ARP** to identify every connected device, classify them as trusted or untrusted, and instantly alert you via **Telegram** if something suspicious shows up.

No manual network interface configuration required: Lince **auto-detects** the network segment it runs on. All data is stored locally with **SQLite**, no cloud dependencies.

---

## Screenshots

**Dashboard**
![Dashboard](https://github.com/user-attachments/assets/ae92aeed-8306-4042-8dad-c4eddc5a9c77)

**Scanning**
![Scanning](https://github.com/user-attachments/assets/6c80b50f-8801-430c-a926-f3215c7a44ef)

**History**
![History](https://github.com/user-attachments/assets/49b3677b-c60f-4978-b629-38109523c029)

**Dark mode**
![Dark mode](https://github.com/user-attachments/assets/db06cbd2-6f38-43cb-9ae1-c6770ece7d6d)

---

## Features

| Category | Details |
|---|---|
| **Scanning** | Auto-detects network segment, Nmap + ARP, configurable scan interval |
| **Dashboard** | Stat cards (total / trusted / untrusted) with live animated counters |
| **Devices** | Custom names, manufacturer lookup, port scanning per device |
| **Trust management** | Mark/unmark devices as trusted directly from the table or the side panel |
| **History** | Full connection/disconnection log with auto-refresh and MAC filter |
| **Alerts** | Real-time Telegram notifications for untrusted devices, sent in the language selected in the UI |
| **Authentication** | Local login or SSO via OIDC (see below) |
| **Profile** | Display name, email and password change from the profile side panel |
| **UI** | Dark mode, ES/EN/FR language switch, responsive sidebar, slide-in panels |
| **Storage** | Lightweight SQLite, no external database needed |

---

## Installation

### 1. Set environment variables

Create a `.env` file in the same directory:
```env
SECRET_KEY=your_secure_key_here
```

Generate a secure key with:
```bash
openssl rand -hex 32
```

### 2. Deploy with Docker Compose
```yaml
services:
  Lince:
    container_name: Lince
    image: netosvaltools/lince:latest
    # image: netosvaltools/lince:v3.1.4
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

> ⚠️ `network_mode: host` is required for LAN scanning. Change `SECRET_KEY` before going to production.

---

## First access

Open the web interface from your browser using the server's IP on port **5555**:
```
http://<server-IP>:5555
```

**Default credentials:**

| Field | Value |
|---|---|
| Username | `admin@example.com` |
| Password | `admin` |

> ⚠️ Change your password immediately after the first login.

---

## Side panels

Lince uses slide-in panels instead of cluttering the main view:

- **History**: connection/disconnection timeline, filterable by MAC and event type
- **Trusted Devices**: full list with inline name editing, add/remove without reload
- **Profile**: display name, credentials (email + password), session info

---

## Updating
```bash
docker compose pull
docker compose up -d
```

---

## Environment variables

| Variable | Description | Required |
|---|---|---|
| `SECRET_KEY` | Secret key for session encryption | ✅ Yes |
| `OIDC_ISSUER` | URL of your OIDC provider (issuer) | Only for SSO |
| `OIDC_CLIENT_ID` | Client ID registered with your OIDC provider | Only for SSO |
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

## Access log

The access log is stored at:
```
/app/data/accesos.log
```

---

## Security note

**Lince must never be exposed directly to the internet, under any circumstances.** It is designed to run inside your local network only. If you need remote access, use a VPN such as WireGuard, OpenVPN, or Tailscale, or place it behind an authenticated reverse proxy on your own private network — never open its port directly to the public internet.

---

## About this project

Lince is a hobby project, built in my free time out of a personal interest in networking, cybersecurity, and homelabs. It's developed with the help of AI tools, which speeds up the process and lets me experiment more, but every feature is tested and refined by hand before release.

There's no commercial goal behind it — just the fun of building something useful for my own home network, and sharing it in case it's useful for yours too.

---

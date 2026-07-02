<div align="center">

<img src="https://github.com/user-attachments/assets/c3af8ab3-c0ed-4078-ab75-7afe2e7455dd" width="120" alt="Lince logo" />

# Lince

**Monitoreo y seguridad de tu red LAN, desde tu propio servidor.**

[![Docker](https://img.shields.io/badge/docker-netosvaltools%2FLince-0ea5e9?style=flat-square&logo=docker&logoColor=white&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Docker Pulls](https://img.shields.io/docker/pulls/netosvaltools/Lince?style=flat-square&color=0ea5e9&labelColor=0f172a)](https://hub.docker.com/r/netosvaltools/Lince)
[![Idiomas](https://img.shields.io/badge/idiomas-ES%20%7C%20EN-10b981?style=flat-square&labelColor=0f172a)](#)
[![Versión](https://img.shields.io/badge/versión-3.1.4-6366f1?style=flat-square&labelColor=0f172a)](#)

</div>

---

## ¿Qué es Lince?

Lince es una aplicación web autohospedada para el **escaneo y monitoreo avanzado de tu red local**. Combina el poder de **Nmap** y **ARP** para identificar cada dispositivo conectado, clasificarlos como confiables o no confiables, y alertarte al instante vía **Telegram** si detecta algo sospechoso.

Sin configuración manual de interfaces de red: Lince **detecta automáticamente** el segmento donde se ejecuta. Toda la información se almacena localmente con **SQLite**, sin dependencias en la nube.

---

## Capturas de pantalla

**Dashboard**
![Dashboard](https://github.com/user-attachments/assets/ae92aeed-8306-4042-8dad-c4eddc5a9c77)

**Escaneo**
![Escaneo](https://github.com/user-attachments/assets/6c80b50f-8801-430c-a926-f3215c7a44ef)

**Historial**
![Historial](https://github.com/user-attachments/assets/49b3677b-c60f-4978-b629-38109523c029)

**Modo oscuro**
![Modo oscuro](https://github.com/user-attachments/assets/db06cbd2-6f38-43cb-9ae1-c6770ece7d6d)

---

## Características

| Categoría | Detalle |
|---|---|
| **Escaneo** | Detección automática de red, Nmap + ARP, intervalo configurable |
| **Dashboard** | Tarjetas de estadísticas (total / confiables / no confiables) con contadores animados en tiempo real |
| **Dispositivos** | Nombres personalizados, búsqueda de fabricante, escaneo de puertos por dispositivo |
| **Confianza** | Marcar/desmarcar dispositivos desde la tabla o el panel lateral, sin recargar |
| **Historial** | Registro completo de conexiones y desconexiones, filtrable por MAC y tipo de evento, con auto-actualización |
| **Alertas** | Notificaciones Telegram en tiempo real ante dispositivos no confiables |
| **Perfil** | Nombre para mostrar, cambio de correo y contraseña desde el panel lateral de perfil |
| **Interfaz** | Modo oscuro, cambio de idioma ES/EN, sidebar responsiva, paneles deslizantes |
| **Almacenamiento** | SQLite ligero — sin base de datos externa |

---

## Instalación

### 1. Configura las variables de entorno

Crea un archivo `.env` en el mismo directorio:
```env
SECRET_KEY=tu_clave_segura_aqui
```

Genera una `SECRET_KEY` segura con:
```bash
openssl rand -hex 32
```

### 2. Despliega con Docker Compose
```yaml
services:
  Lince:
    container_name: Lince
    image: netosvaltools/Lince:latest
    # image: netosvaltools/Lince:v3.1.4
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

> ⚠️ `network_mode: host` es necesario para escanear la red local. Cambia la `SECRET_KEY` antes de pasar a producción.

---

## Acceso inicial

Accede desde tu navegador usando la IP del servidor en el puerto **5555**:
```
http://<IP-del-servidor>:5555
```

**Credenciales por defecto:**

| Campo | Valor |
|---|---|
| Usuario | `admin@example.com` |
| Contraseña | `admin` |

> ⚠️ Cambia la contraseña inmediatamente tras el primer inicio de sesión.

---

## Paneles laterales

Lince organiza la información en paneles deslizantes para mantener el dashboard limpio:

- **Historial**: línea de tiempo de conexiones y desconexiones, filtrable por MAC y tipo de evento
- **Dispositivos Confiables**: lista completa con edición de nombre en línea, agregar/eliminar sin recargar la página
- **Perfil**: nombre para mostrar, credenciales (correo + contraseña) e información de sesión

---

## Actualizar
```bash
docker compose pull
docker compose up -d
```

---

## Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `SECRET_KEY` | Clave secreta para cifrado de sesiones | ✅ Sí |

---

## Registro de accesos

El log de accesos se almacena en:
```
/app/data/accesos.log
```

---

## Nota de seguridad

**No expongas la interfaz de administración directamente a internet.** Si necesitas acceso remoto, usa una VPN como WireGuard, OpenVPN o Tailscale.

---

## Nota del desarrollador

Este proyecto nació de la pasión por las redes, la ciberseguridad y el homelab. Fue construido con apoyo de herramientas de inteligencia artificial como parte de un proyecto personal, con el objetivo de crear soluciones útiles, reales y autohospedadas para quienes, como yo, disfrutan administrar su propia infraestructura en casa.

---

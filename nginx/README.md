# nginx · Proxy inverso y HTTPS

Nginx 1.27 es el **punto único de entrada** de EduPlan (RF10) y el único contenedor con puertos publicados.

| Puerto | Qué hace |
|---|---|
| 80 (HTTP) | Redirige todo a HTTPS. Sirve `/.well-known/acme-challenge/` (Let's Encrypt) y `/salud` (healthcheck) |
| 443 (HTTPS) | `/` frontend · `/auth/` → `ms-auth:3001` · `/api/` → `ms-academico:3002` |

## Archivos

| Archivo | Para qué |
|---|---|
| `Dockerfile` | Imagen `nginx:1.27-alpine` + `openssl` |
| `default.conf.template` | Configuración. Al arrancar, la imagen reemplaza `${HTTPS_PORT}` con el valor del `.env` |
| `seguridad.conf` | Cabeceras de seguridad comunes |
| `40-certificado.sh` | Al iniciar: usa `certs/eduplan.crt` y `.key` si existen; si no, genera un certificado autofirmado para `DOMINIO` |
| `certs/` | Certificado y llave (no se suben a Git) |
| `acme/` | Reto HTTP de Let's Encrypt |

## Seguridad

- **TLS 1.2 y 1.3** solamente, HTTP/2 y caché de sesiones TLS.
- **HSTS** (`max-age=31536000`) solo con un dominio real. En `localhost` no se envía, porque obligaría al navegador a usar HTTPS en todos tus proyectos locales. Por la misma razón, los microservicios ya no envían HSTS (lo decide Nginx).
- **Content-Security-Policy** estricta para el frontend (solo scripts propios), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
- **Límite de peticiones por IP**, con respuesta `429` en el mismo formato JSON que la API:
  - `/auth/login` y `/auth/registro`: 10 por minuto (ráfaga de 10), además del bloqueo de ms-auth tras 5 contraseñas incorrectas.
  - `/auth/` y `/api/`: 30 por segundo (ráfaga de 60).
- `X-Forwarded-Proto: https` hacia los microservicios, así la cookie temporal de OAuth sale con `Secure`.
- Las rutas `/api/` y `/auth/` usan `^~` para que Swagger (`/api/docs`, `/auth/docs`) cargue sus propios `.css` y `.js` a través del proxy.

## Certificado en desarrollo

La primera vez, el navegador muestra **"La conexión no es privada"** porque el certificado es autofirmado.
Presiona **Configuración avanzada → Continuar a localhost**. Solo pasa en tu computadora; en producción se usa Let's Encrypt (ver [`docs/DESPLIEGUE.md`](../docs/DESPLIEGUE.md)).

Para quitar la advertencia en Windows puedes confiar en el certificado: abre `nginx/certs/eduplan.crt` → **Instalar certificado** → Usuario actual → "Colocar todos los certificados en el siguiente almacén" → **Entidades de certificación raíz de confianza**. Después reinicia el navegador.

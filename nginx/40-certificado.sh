#!/bin/sh
# =============================================================================
#  EduPlan · Certificado HTTPS
#  Se ejecuta al iniciar el contenedor de Nginx (antes de arrancar Nginx).
#  - Si ya existe nginx/certs/eduplan.crt y eduplan.key, los usa
#    (por ejemplo, un certificado real de Let's Encrypt).
#  - Si no existen, genera uno AUTOFIRMADO para desarrollo.
# =============================================================================
set -e

DIR=/etc/nginx/certs
CRT="$DIR/eduplan.crt"
KEY="$DIR/eduplan.key"
DOMINIO="${DOMINIO:-localhost}"

if [ -s "$CRT" ] && [ -s "$KEY" ]; then
  echo "[eduplan] Usando el certificado existente de $DIR"
  exit 0
fi

mkdir -p "$DIR"
echo "[eduplan] No hay certificado: generando uno autofirmado para $DOMINIO (solo para desarrollo)"
NOMBRES="DNS:localhost,IP:127.0.0.1"
[ "$DOMINIO" != "localhost" ] && NOMBRES="DNS:$DOMINIO,$NOMBRES"

if ! openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 825 \
  -keyout "$KEY" -out "$CRT" \
  -subj "/CN=$DOMINIO/O=EduPlan (desarrollo)" \
  -addext "subjectAltName=$NOMBRES" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "extendedKeyUsage=serverAuth" 2>/tmp/openssl.log; then
  echo "[eduplan] ERROR al generar el certificado:"; cat /tmp/openssl.log
  exit 1
fi
chmod 600 "$KEY"
chmod 644 "$CRT"
echo "[eduplan] Certificado creado: válido por 825 días para $NOMBRES"

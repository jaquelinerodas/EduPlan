# =============================================================================
#  EduPlan · Nginx (proxy inverso + frontend) · Imagen Docker
#  Agrega openssl para generar un certificado de desarrollo si no hay uno.
# =============================================================================
FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

# Se ejecuta automáticamente al iniciar (carpeta /docker-entrypoint.d de la imagen oficial)
COPY --chmod=755 40-certificado.sh /docker-entrypoint.d/40-certificado.sh
COPY seguridad.conf /etc/nginx/snippets/eduplan-seguridad.conf
COPY default.conf.template /etc/nginx/templates/default.conf.template

# La configuración de ejemplo de la imagen no se usa
RUN rm -f /etc/nginx/conf.d/default.conf

EXPOSE 80 443

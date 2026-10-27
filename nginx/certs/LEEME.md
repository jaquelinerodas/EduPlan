# Certificados HTTPS

Esta carpeta guarda el certificado que usa Nginx:

- `eduplan.crt`: certificado (o cadena completa)
- `eduplan.key`: llave privada

Si la carpeta está vacía, Nginx genera uno **autofirmado** la primera vez que arranca (solo para desarrollo; el navegador mostrará una advertencia).
Para producción, coloca aquí el certificado de Let's Encrypt (ver `docs/DESPLIEGUE.md`).

Los archivos `.crt`, `.key` y `.pem` **nunca** se suben a GitHub (están en `.gitignore`).

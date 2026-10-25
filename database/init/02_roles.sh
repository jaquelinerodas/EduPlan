#!/bin/bash
# =============================================================================
#  EduPlan · database/init/02_roles.sh
#  Crea un usuario de base de datos por microservicio y le da permisos
#  SOLO sobre su propio esquema (principio de mínimo privilegio):
#
#     ms_auth       -> esquema auth
#     ms_academico  -> esquema academico
#
#  Las contraseñas se leen de variables de entorno (.env), nunca del código.
#  Se ejecuta automáticamente después de 01_schema.sql al crear el contenedor.
# =============================================================================
set -euo pipefail

: "${MS_AUTH_DB_PASSWORD:?Falta la variable MS_AUTH_DB_PASSWORD en el .env}"
: "${MS_ACADEMICO_DB_PASSWORD:?Falta la variable MS_ACADEMICO_DB_PASSWORD en el .env}"

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" \
     -v auth_pass="$MS_AUTH_DB_PASSWORD" \
     -v acad_pass="$MS_ACADEMICO_DB_PASSWORD" \
     -v db_name="$POSTGRES_DB" <<'EOSQL'

-- ---------------------------------------------------------------------------
-- Roles de conexión
-- ---------------------------------------------------------------------------
CREATE ROLE ms_auth      LOGIN PASSWORD :'auth_pass';
CREATE ROLE ms_academico LOGIN PASSWORD :'acad_pass';

GRANT CONNECT ON DATABASE :"db_name" TO ms_auth, ms_academico;

-- Nadie más puede crear objetos en public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- ms_auth -> esquema auth
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA auth TO ms_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO ms_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ms_auth;
ALTER ROLE ms_auth SET search_path = auth, public;

-- ---------------------------------------------------------------------------
-- ms_academico -> esquema academico
-- (Las llaves foráneas hacia auth.usuarios las valida PostgreSQL
--  internamente; ms_academico NO necesita leer la tabla de usuarios.)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA academico TO ms_academico;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA academico TO ms_academico;
ALTER DEFAULT PRIVILEGES IN SCHEMA academico
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ms_academico;
ALTER ROLE ms_academico SET search_path = academico, public;

EOSQL

echo "[EduPlan] Roles ms_auth y ms_academico creados correctamente."



BEGIN;


CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;


CREATE SCHEMA IF NOT EXISTS auth;
COMMENT ON SCHEMA auth IS 'Tablas del microservicio ms-auth (autenticación y usuarios)';

CREATE SCHEMA IF NOT EXISTS academico;
COMMENT ON SCHEMA academico IS 'Tablas del microservicio ms-academico (materias, tareas, apuntes e IA)';


CREATE OR REPLACE FUNCTION public.fn_set_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_set_actualizado_en() IS
    'Actualiza automáticamente la columna actualizado_en en cada UPDATE';



CREATE TABLE auth.usuarios (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id        VARCHAR(64)   NOT NULL,
    email            CITEXT        NOT NULL,
    nombre           VARCHAR(150)  NOT NULL,
    foto_url         TEXT,
    rol              VARCHAR(20)   NOT NULL DEFAULT 'estudiante',
    activo           BOOLEAN       NOT NULL DEFAULT TRUE,
    ultimo_acceso    TIMESTAMPTZ,
    creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_usuarios_google_id UNIQUE (google_id),
    CONSTRAINT uq_usuarios_email     UNIQUE (email),
    CONSTRAINT ck_usuarios_rol       CHECK (rol IN ('estudiante', 'administrador')),
    CONSTRAINT ck_usuarios_nombre    CHECK (length(trim(nombre)) > 0),
    CONSTRAINT ck_usuarios_email     CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

COMMENT ON TABLE  auth.usuarios               IS 'Usuarios autenticados con Google OAuth 2.0';
COMMENT ON COLUMN auth.usuarios.id            IS 'Identificador interno; viaja en el JWT (claim sub)';
COMMENT ON COLUMN auth.usuarios.google_id     IS 'Identificador único que devuelve Google (claim sub de Google)';
COMMENT ON COLUMN auth.usuarios.email         IS 'Correo de la cuenta de Google (no distingue mayúsculas)';
COMMENT ON COLUMN auth.usuarios.rol           IS 'estudiante | administrador (HU10: consultar estado de servicios)';
COMMENT ON COLUMN auth.usuarios.activo        IS 'Permite bloquear el acceso sin borrar al usuario';
COMMENT ON COLUMN auth.usuarios.ultimo_acceso IS 'Fecha/hora del último inicio de sesión';

CREATE TRIGGER trg_usuarios_actualizado_en
    BEFORE UPDATE ON auth.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();


CREATE TYPE academico.prioridad_tarea AS ENUM ('baja', 'media', 'alta');
COMMENT ON TYPE academico.prioridad_tarea IS 'Prioridad de una tarea (HU03)';

CREATE TYPE academico.estado_tarea AS ENUM ('pendiente', 'en_progreso', 'completada');
COMMENT ON TYPE academico.estado_tarea IS 'Estado de una tarea (HU04, RF04)';


CREATE TABLE academico.materias (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID          NOT NULL,
    nombre           VARCHAR(120)  NOT NULL,
    docente          VARCHAR(120),
    descripcion      TEXT,
    color            CHAR(7)       NOT NULL DEFAULT '#3B82F6',
    creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_materias_usuario
        FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
    -- Clave compuesta para que tareas/apuntes solo apunten a materias
    -- del MISMO usuario (refuerza RF09 a nivel de base de datos).
    CONSTRAINT uq_materias_id_usuario UNIQUE (id, usuario_id),
    CONSTRAINT ck_materias_nombre CHECK (length(trim(nombre)) > 0),
    CONSTRAINT ck_materias_color  CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);


CREATE UNIQUE INDEX uq_materias_usuario_nombre
    ON academico.materias (usuario_id, lower(nombre));

COMMENT ON TABLE  academico.materias            IS 'Materias o cursos que registra cada estudiante';
COMMENT ON COLUMN academico.materias.usuario_id IS 'Dueño de la materia (auth.usuarios.id)';
COMMENT ON COLUMN academico.materias.color      IS 'Color hexadecimal para identificar la materia en la interfaz';

CREATE TRIGGER trg_materias_actualizado_en
    BEFORE UPDATE ON academico.materias
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();


CREATE TABLE academico.tareas (
    id               UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID                       NOT NULL,
    materia_id       UUID                       NOT NULL,
    titulo           VARCHAR(200)               NOT NULL,
    descripcion      TEXT,
    fecha_limite     TIMESTAMPTZ                NOT NULL,
    prioridad        academico.prioridad_tarea  NOT NULL DEFAULT 'media',
    estado           academico.estado_tarea     NOT NULL DEFAULT 'pendiente',
    completada_en    TIMESTAMPTZ,
    creado_en        TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ                NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tareas_usuario
        FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_tareas_materia_usuario
        FOREIGN KEY (materia_id, usuario_id)
        REFERENCES academico.materias (id, usuario_id) ON DELETE CASCADE,
    CONSTRAINT ck_tareas_titulo CHECK (length(trim(titulo)) > 0),
    -- completada_en solo tiene valor cuando la tarea está completada
    CONSTRAINT ck_tareas_completada CHECK (
        (estado = 'completada' AND completada_en IS NOT NULL) OR
        (estado <> 'completada' AND completada_en IS NULL)
    )
);

CREATE INDEX ix_tareas_usuario_materia ON academico.tareas (usuario_id, materia_id);
CREATE INDEX ix_tareas_usuario_estado  ON academico.tareas (usuario_id, estado);
CREATE INDEX ix_tareas_usuario_fecha   ON academico.tareas (usuario_id, fecha_limite);

COMMENT ON TABLE  academico.tareas               IS 'Tareas con fecha de entrega, prioridad y estado';
COMMENT ON COLUMN academico.tareas.fecha_limite  IS 'Fecha y hora de entrega (con zona horaria)';
COMMENT ON COLUMN academico.tareas.completada_en IS 'Se llena automáticamente al marcar la tarea como completada';


CREATE OR REPLACE FUNCTION academico.fn_tareas_completada_en()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado = 'completada' AND NEW.completada_en IS NULL THEN
        NEW.completada_en := NOW();
    ELSIF NEW.estado <> 'completada' THEN
        NEW.completada_en := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tareas_completada_en
    BEFORE INSERT OR UPDATE OF estado ON academico.tareas
    FOR EACH ROW EXECUTE FUNCTION academico.fn_tareas_completada_en();

CREATE TRIGGER trg_tareas_actualizado_en
    BEFORE UPDATE ON academico.tareas
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();


CREATE TABLE academico.apuntes (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id           UUID          NOT NULL,
    materia_id           UUID          NOT NULL,
    titulo               VARCHAR(200)  NOT NULL,
    contenido            TEXT          NOT NULL,
    resumen_ia           TEXT,
    resumen_generado_en  TIMESTAMPTZ,
    creado_en            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualizado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_apuntes_usuario
        FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_apuntes_materia_usuario
        FOREIGN KEY (materia_id, usuario_id)
        REFERENCES academico.materias (id, usuario_id) ON DELETE CASCADE,
    CONSTRAINT ck_apuntes_titulo    CHECK (length(trim(titulo)) > 0),
    CONSTRAINT ck_apuntes_contenido CHECK (length(trim(contenido)) > 0),
    CONSTRAINT ck_apuntes_resumen   CHECK (
        (resumen_ia IS NULL AND resumen_generado_en IS NULL) OR
        (resumen_ia IS NOT NULL AND resumen_generado_en IS NOT NULL)
    )
);

CREATE INDEX ix_apuntes_usuario_materia ON academico.apuntes (usuario_id, materia_id);

COMMENT ON TABLE  academico.apuntes                     IS 'Apuntes del estudiante asociados a una materia';
COMMENT ON COLUMN academico.apuntes.resumen_ia          IS 'Último resumen generado por la API de IA (RF07)';
COMMENT ON COLUMN academico.apuntes.resumen_generado_en IS 'Momento en que se generó el resumen';

CREATE TRIGGER trg_apuntes_actualizado_en
    BEFORE UPDATE ON academico.apuntes
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();


CREATE TABLE academico.planes_estudio (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       UUID          NOT NULL,
    fecha_inicio     DATE          NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin        DATE          NOT NULL,
    contenido        TEXT          NOT NULL,
    tareas_incluidas UUID[]        NOT NULL DEFAULT '{}',
    modelo_ia        VARCHAR(80),
    creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_planes_usuario
        FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
    CONSTRAINT ck_planes_rango     CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT ck_planes_contenido CHECK (length(trim(contenido)) > 0)
);

CREATE INDEX ix_planes_usuario_creado ON academico.planes_estudio (usuario_id, creado_en DESC);

COMMENT ON TABLE  academico.planes_estudio                  IS 'Planes de estudio generados por la IA';
COMMENT ON COLUMN academico.planes_estudio.contenido        IS 'Texto del plan devuelto por el modelo de lenguaje';
COMMENT ON COLUMN academico.planes_estudio.tareas_incluidas IS 'IDs de las tareas pendientes que se enviaron a la IA';
COMMENT ON COLUMN academico.planes_estudio.modelo_ia        IS 'Modelo usado (ej. claude, gemini, gpt)';


CREATE VIEW academico.v_resumen_materias AS
SELECT
    m.id                                                         AS materia_id,
    m.usuario_id,
    m.nombre,
    m.color,
    COUNT(t.id)                                                  AS total_tareas,
    COUNT(t.id) FILTER (WHERE t.estado = 'pendiente')            AS pendientes,
    COUNT(t.id) FILTER (WHERE t.estado = 'en_progreso')          AS en_progreso,
    COUNT(t.id) FILTER (WHERE t.estado = 'completada')           AS completadas,
    COUNT(t.id) FILTER (WHERE t.estado <> 'completada'
                          AND t.fecha_limite < NOW())            AS vencidas,
    MIN(t.fecha_limite) FILTER (WHERE t.estado <> 'completada'
                                  AND t.fecha_limite >= NOW())   AS proxima_entrega
FROM academico.materias m
LEFT JOIN academico.tareas t ON t.materia_id = m.id
GROUP BY m.id, m.usuario_id, m.nombre, m.color;

COMMENT ON VIEW academico.v_resumen_materias IS
    'Conteo de tareas por estado y próxima entrega de cada materia';

COMMIT;

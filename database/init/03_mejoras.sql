

SET client_min_messages = warning;
BEGIN;


--  auth.usuarios

ALTER TABLE auth.usuarios ALTER COLUMN google_id DROP NOT NULL;
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_usuarios_metodo_acceso') THEN
    ALTER TABLE auth.usuarios
      ADD CONSTRAINT ck_usuarios_metodo_acceso
      CHECK (google_id IS NOT NULL OR password_hash IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN auth.usuarios.google_id     IS 'Identificador de Google (NULL si la cuenta solo usa correo y contraseña)';
COMMENT ON COLUMN auth.usuarios.password_hash IS 'Hash scrypt de la contraseña (NULL si la cuenta solo usa Google)';


--  academico.tareas

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tareas_id_usuario') THEN
    ALTER TABLE academico.tareas ADD CONSTRAINT uq_tareas_id_usuario UNIQUE (id, usuario_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION academico.fn_tareas_bloquear_completadas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = 'completada' THEN
    RAISE EXCEPTION 'TAREA_COMPLETADA'
      USING ERRCODE = 'P0001',
            DETAIL  = 'Una tarea completada no se puede modificar';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tareas_bloquear_completadas ON academico.tareas;
CREATE TRIGGER trg_tareas_bloquear_completadas
  BEFORE UPDATE ON academico.tareas
  FOR EACH ROW EXECUTE FUNCTION academico.fn_tareas_bloquear_completadas();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_apuntes_id_usuario') THEN
    ALTER TABLE academico.apuntes ADD CONSTRAINT uq_apuntes_id_usuario UNIQUE (id, usuario_id);
  END IF;
END $$;

--  academico.examenes

CREATE TABLE IF NOT EXISTS academico.examenes (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID          NOT NULL,
  materia_id     UUID          NOT NULL,
  titulo         VARCHAR(200)  NOT NULL,
  fecha          TIMESTAMPTZ   NOT NULL,
  temas          TEXT,
  notas          TEXT,
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_examenes_usuario
    FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_examenes_materia_usuario
    FOREIGN KEY (materia_id, usuario_id) REFERENCES academico.materias (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT uq_examenes_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT ck_examenes_titulo CHECK (length(trim(titulo)) > 0)
);
CREATE INDEX IF NOT EXISTS ix_examenes_usuario_fecha ON academico.examenes (usuario_id, fecha);

COMMENT ON TABLE  academico.examenes       IS 'Exámenes y parciales del estudiante';
COMMENT ON COLUMN academico.examenes.temas IS 'Temas que entran en el examen (texto libre, uno por línea)';

DROP TRIGGER IF EXISTS trg_examenes_actualizado_en ON academico.examenes;
CREATE TRIGGER trg_examenes_actualizado_en
  BEFORE UPDATE ON academico.examenes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();

--  academico.planes_estudio

ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS titulo            VARCHAR(200);
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS alcance           VARCHAR(20) NOT NULL DEFAULT 'general';
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS materia_id        UUID;
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS examen_id         UUID;
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS apuntes_incluidos UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS horas_por_dia     SMALLINT;
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS consejos          TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS reorganizado_en   TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planes_alcance') THEN
    ALTER TABLE academico.planes_estudio
      ADD CONSTRAINT ck_planes_alcance CHECK (alcance IN ('general', 'materia', 'apuntes', 'examen'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_planes_id_usuario') THEN
    ALTER TABLE academico.planes_estudio ADD CONSTRAINT uq_planes_id_usuario UNIQUE (id, usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_planes_materia_usuario') THEN
    ALTER TABLE academico.planes_estudio
      ADD CONSTRAINT fk_planes_materia_usuario
      FOREIGN KEY (materia_id, usuario_id) REFERENCES academico.materias (id, usuario_id)
      ON DELETE SET NULL (materia_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_planes_examen_usuario') THEN
    ALTER TABLE academico.planes_estudio
      ADD CONSTRAINT fk_planes_examen_usuario
      FOREIGN KEY (examen_id, usuario_id) REFERENCES academico.examenes (id, usuario_id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN academico.planes_estudio.alcance   IS 'general | materia | apuntes | examen';
COMMENT ON COLUMN academico.planes_estudio.contenido IS 'Introducción del plan escrita por la IA';

--  academico.plan_actividades

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'tipo_actividad' AND n.nspname = 'academico') THEN
    CREATE TYPE academico.tipo_actividad AS ENUM ('estudio', 'tarea', 'repaso', 'practica', 'descanso');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS academico.plan_actividades (
  id            UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID                      NOT NULL,
  usuario_id    UUID                      NOT NULL,
  fecha         DATE                      NOT NULL,
  hora_inicio   TIME                      NOT NULL,
  hora_fin      TIME                      NOT NULL,
  tipo          academico.tipo_actividad  NOT NULL DEFAULT 'estudio',
  titulo        VARCHAR(200)              NOT NULL,
  descripcion   TEXT,
  materia_id    UUID,
  tarea_id      UUID,
  completada    BOOLEAN                   NOT NULL DEFAULT FALSE,
  completada_en TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ               NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_actividades_plan_usuario
    FOREIGN KEY (plan_id, usuario_id) REFERENCES academico.planes_estudio (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT fk_actividades_materia_usuario
    FOREIGN KEY (materia_id, usuario_id) REFERENCES academico.materias (id, usuario_id) ON DELETE SET NULL (materia_id),
  CONSTRAINT fk_actividades_tarea_usuario
    FOREIGN KEY (tarea_id, usuario_id) REFERENCES academico.tareas (id, usuario_id) ON DELETE SET NULL (tarea_id),
  CONSTRAINT ck_actividades_horario CHECK (hora_fin > hora_inicio),
  CONSTRAINT ck_actividades_titulo  CHECK (length(trim(titulo)) > 0)
);
CREATE INDEX IF NOT EXISTS ix_actividades_plan          ON academico.plan_actividades (plan_id, fecha, hora_inicio);
CREATE INDEX IF NOT EXISTS ix_actividades_usuario_fecha ON academico.plan_actividades (usuario_id, fecha);

COMMENT ON TABLE academico.plan_actividades IS 'Sesiones de estudio de un plan, día por día';

--  academico.cuestionarios y academico.cuestionario_intentos

CREATE TABLE IF NOT EXISTS academico.cuestionarios (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID          NOT NULL,
  materia_id        UUID,
  examen_id         UUID,
  titulo            VARCHAR(200)  NOT NULL,
  dificultad        VARCHAR(10)   NOT NULL DEFAULT 'media',
  apuntes_incluidos UUID[]        NOT NULL DEFAULT '{}',
  preguntas         JSONB         NOT NULL,
  modelo_ia         VARCHAR(80),
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cuestionarios_usuario
    FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_cuestionarios_materia_usuario
    FOREIGN KEY (materia_id, usuario_id) REFERENCES academico.materias (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT fk_cuestionarios_examen_usuario
    FOREIGN KEY (examen_id, usuario_id) REFERENCES academico.examenes (id, usuario_id) ON DELETE SET NULL (examen_id),
  CONSTRAINT uq_cuestionarios_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT ck_cuestionarios_dificultad CHECK (dificultad IN ('facil', 'media', 'dificil')),
  CONSTRAINT ck_cuestionarios_preguntas  CHECK (jsonb_typeof(preguntas) = 'array' AND jsonb_array_length(preguntas) > 0)
);
CREATE INDEX IF NOT EXISTS ix_cuestionarios_usuario ON academico.cuestionarios (usuario_id, creado_en DESC);

COMMENT ON COLUMN academico.cuestionarios.preguntas IS
  'Arreglo JSON: [{ pregunta, opciones[4], correcta (0-3), explicacion, tema }]. La respuesta correcta nunca se envía al cliente antes de calificar';

CREATE TABLE IF NOT EXISTS academico.cuestionario_intentos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cuestionario_id UUID          NOT NULL,
  usuario_id      UUID          NOT NULL,
  respuestas      JSONB         NOT NULL,
  correctas       SMALLINT      NOT NULL,
  total           SMALLINT      NOT NULL,
  puntaje         NUMERIC(5,2)  NOT NULL,
  temas_debiles   TEXT[]        NOT NULL DEFAULT '{}',
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_intentos_cuestionario_usuario
    FOREIGN KEY (cuestionario_id, usuario_id) REFERENCES academico.cuestionarios (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT ck_intentos_puntaje CHECK (puntaje BETWEEN 0 AND 100),
  CONSTRAINT ck_intentos_correctas CHECK (correctas BETWEEN 0 AND total)
);
CREATE INDEX IF NOT EXISTS ix_intentos_cuestionario ON academico.cuestionario_intentos (cuestionario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_intentos_usuario      ON academico.cuestionario_intentos (usuario_id, creado_en DESC);

COMMENT ON COLUMN academico.cuestionario_intentos.temas_debiles IS 'Temas de las preguntas falladas; los usa el plan de preparación de exámenes';

--  academico.flashcards: repaso espaciado

CREATE TABLE IF NOT EXISTS academico.flashcards (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID          NOT NULL,
  materia_id      UUID          NOT NULL,
  apunte_id       UUID,
  frente          TEXT          NOT NULL,
  reverso         TEXT          NOT NULL,
  repeticiones    SMALLINT      NOT NULL DEFAULT 0,
  intervalo_dias  SMALLINT      NOT NULL DEFAULT 0,
  facilidad       NUMERIC(4,2)  NOT NULL DEFAULT 2.50,
  proximo_repaso  DATE          NOT NULL DEFAULT CURRENT_DATE,
  ultimo_repaso   TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_flashcards_usuario
    FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_flashcards_materia_usuario
    FOREIGN KEY (materia_id, usuario_id) REFERENCES academico.materias (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT fk_flashcards_apunte_usuario
    FOREIGN KEY (apunte_id, usuario_id) REFERENCES academico.apuntes (id, usuario_id) ON DELETE SET NULL (apunte_id),
  CONSTRAINT ck_flashcards_texto CHECK (length(trim(frente)) > 0 AND length(trim(reverso)) > 0),
  CONSTRAINT ck_flashcards_facilidad CHECK (facilidad BETWEEN 1.30 AND 3.50)
);
CREATE INDEX IF NOT EXISTS ix_flashcards_usuario_repaso ON academico.flashcards (usuario_id, proximo_repaso);
CREATE INDEX IF NOT EXISTS ix_flashcards_materia        ON academico.flashcards (usuario_id, materia_id);

COMMENT ON TABLE  academico.flashcards                IS 'Tarjetas de memoria (pregunta/respuesta) con repaso espaciado';
COMMENT ON COLUMN academico.flashcards.facilidad      IS 'Factor de facilidad (algoritmo SM-2 simplificado)';
COMMENT ON COLUMN academico.flashcards.proximo_repaso IS 'Fecha en que la tarjeta vuelve a mostrarse';

COMMIT;

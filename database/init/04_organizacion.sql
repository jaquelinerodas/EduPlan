+
SET client_min_messages = warning;
BEGIN;

-- Periodos

CREATE TABLE IF NOT EXISTS academico.periodos (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID          NOT NULL,
  nombre      VARCHAR(80)   NOT NULL,
  tipo        VARCHAR(10)   NOT NULL DEFAULT 'semestre',
  orden       SMALLINT      NOT NULL DEFAULT 0,
  creado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_periodos_usuario
    FOREIGN KEY (usuario_id) REFERENCES auth.usuarios (id) ON DELETE CASCADE,
  CONSTRAINT uq_periodos_id_usuario UNIQUE (id, usuario_id),
  CONSTRAINT ck_periodos_tipo   CHECK (tipo IN ('semestre', 'bloque', 'carpeta')),
  CONSTRAINT ck_periodos_nombre CHECK (length(trim(nombre)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_periodos_usuario_nombre ON academico.periodos (usuario_id, lower(nombre));
COMMENT ON TABLE  academico.periodos      IS 'Semestres, bloques o carpetas con los que el estudiante organiza materias y apuntes';
COMMENT ON COLUMN academico.periodos.tipo IS 'semestre | bloque | carpeta';

-- Materias

ALTER TABLE academico.materias ADD COLUMN IF NOT EXISTS periodo_id UUID;

-- Apuntes: periodo, favorito y etiquetas
ALTER TABLE academico.apuntes ADD COLUMN IF NOT EXISTS periodo_id UUID;
ALTER TABLE academico.apuntes ADD COLUMN IF NOT EXISTS favorito   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE academico.apuntes ADD COLUMN IF NOT EXISTS etiquetas  TEXT[]  NOT NULL DEFAULT '{}';

-- Cuestionarios
ALTER TABLE academico.cuestionarios ADD COLUMN IF NOT EXISTS temas TEXT[] NOT NULL DEFAULT '{}';

-- Intentos
ALTER TABLE academico.cuestionario_intentos ADD COLUMN IF NOT EXISTS apuntes_recomendados UUID[] NOT NULL DEFAULT '{}';

-- Tarjetas creadas desde un cuestionario
ALTER TABLE academico.flashcards ADD COLUMN IF NOT EXISTS cuestionario_id UUID;

-- Planes
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS periodo_id      UUID;
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS temas_prioridad TEXT;
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS prioridad       VARCHAR(5) NOT NULL DEFAULT 'media';
ALTER TABLE academico.planes_estudio ADD COLUMN IF NOT EXISTS cuestionario_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_materias_periodo_usuario') THEN
    ALTER TABLE academico.materias
      ADD CONSTRAINT fk_materias_periodo_usuario
      FOREIGN KEY (periodo_id, usuario_id) REFERENCES academico.periodos (id, usuario_id)
      ON DELETE SET NULL (periodo_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_apuntes_periodo_usuario') THEN
    ALTER TABLE academico.apuntes
      ADD CONSTRAINT fk_apuntes_periodo_usuario
      FOREIGN KEY (periodo_id, usuario_id) REFERENCES academico.periodos (id, usuario_id)
      ON DELETE SET NULL (periodo_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_apuntes_etiquetas') THEN
    ALTER TABLE academico.apuntes
      ADD CONSTRAINT ck_apuntes_etiquetas CHECK (cardinality(etiquetas) <= 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_flashcards_cuestionario_usuario') THEN
    ALTER TABLE academico.flashcards
      ADD CONSTRAINT fk_flashcards_cuestionario_usuario
      FOREIGN KEY (cuestionario_id, usuario_id) REFERENCES academico.cuestionarios (id, usuario_id)
      ON DELETE SET NULL (cuestionario_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_planes_periodo_usuario') THEN
    ALTER TABLE academico.planes_estudio
      ADD CONSTRAINT fk_planes_periodo_usuario
      FOREIGN KEY (periodo_id, usuario_id) REFERENCES academico.periodos (id, usuario_id)
      ON DELETE SET NULL (periodo_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_planes_cuestionario_usuario') THEN
    ALTER TABLE academico.planes_estudio
      ADD CONSTRAINT fk_planes_cuestionario_usuario
      FOREIGN KEY (cuestionario_id, usuario_id) REFERENCES academico.cuestionarios (id, usuario_id)
      ON DELETE SET NULL (cuestionario_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planes_prioridad') THEN
    ALTER TABLE academico.planes_estudio
      ADD CONSTRAINT ck_planes_prioridad CHECK (prioridad IN ('baja', 'media', 'alta'));
  END IF;
END $$;

ALTER TABLE academico.planes_estudio DROP CONSTRAINT IF EXISTS ck_planes_alcance;
ALTER TABLE academico.planes_estudio
  ADD CONSTRAINT ck_planes_alcance CHECK (alcance IN ('general', 'materia', 'apuntes', 'examen', 'cuestionario'));

CREATE INDEX IF NOT EXISTS ix_apuntes_periodo   ON academico.apuntes (usuario_id, periodo_id);
CREATE INDEX IF NOT EXISTS ix_apuntes_favoritos ON academico.apuntes (usuario_id) WHERE favorito;
CREATE INDEX IF NOT EXISTS ix_apuntes_etiquetas ON academico.apuntes USING GIN (etiquetas);
CREATE INDEX IF NOT EXISTS ix_materias_periodo  ON academico.materias (usuario_id, periodo_id);

COMMENT ON COLUMN academico.materias.periodo_id   IS 'Semestre o bloque de la materia (se propone al crear apuntes)';
COMMENT ON COLUMN academico.apuntes.periodo_id    IS 'Semestre, bloque o carpeta al que pertenece el apunte';
COMMENT ON COLUMN academico.apuntes.favorito      IS 'Marcado como favorito por el estudiante';
COMMENT ON COLUMN academico.apuntes.etiquetas     IS 'Etiquetas libres (máximo 10)';
COMMENT ON COLUMN academico.cuestionarios.temas   IS 'Temas que el estudiante eligió para el cuestionario';
COMMENT ON COLUMN academico.cuestionario_intentos.apuntes_recomendados IS 'Apuntes de donde salieron las preguntas falladas';
COMMENT ON COLUMN academico.flashcards.cuestionario_id IS 'Cuestionario de donde se creó la tarjeta (preguntas falladas)';
COMMENT ON COLUMN academico.planes_estudio.temas_prioridad IS 'Temas que el estudiante pidió priorizar';
COMMENT ON COLUMN academico.planes_estudio.prioridad       IS 'baja | media | alta: intensidad del plan';
COMMENT ON COLUMN academico.planes_estudio.alcance         IS 'general | materia | apuntes | examen | cuestionario';


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ms_academico') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON academico.periodos TO ms_academico;
  END IF;
END $$;

COMMIT;

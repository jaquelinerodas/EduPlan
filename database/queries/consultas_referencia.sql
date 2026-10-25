-- =============================================================================
--  EduPlan · database/queries/consultas_referencia.sql
--  Consultas de referencia que usarán los microservicios.
--  Todas filtran por usuario_id (el "sub" del JWT) para cumplir RF09.
--  Los parámetros $1, $2... son los que se envían desde Node.js (pg).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ms-auth
-- ---------------------------------------------------------------------------

-- Registrar o actualizar al usuario al volver de Google (RF01)
INSERT INTO auth.usuarios (google_id, email, nombre, foto_url, ultimo_acceso)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (google_id) DO UPDATE
   SET email = EXCLUDED.email,
       nombre = EXCLUDED.nombre,
       foto_url = EXCLUDED.foto_url,
       ultimo_acceso = NOW()
RETURNING id, email, nombre, foto_url, rol;

-- ---------------------------------------------------------------------------
-- ms-academico · Tareas con filtros opcionales (RF06)
--   $1 usuario_id  $2 materia_id|null  $3 estado|null
--   $4 fecha_desde|null  $5 fecha_hasta|null
-- ---------------------------------------------------------------------------
SELECT t.id, t.titulo, t.descripcion, t.fecha_limite, t.prioridad, t.estado,
       t.completada_en, m.id AS materia_id, m.nombre AS materia, m.color
  FROM academico.tareas t
  JOIN academico.materias m ON m.id = t.materia_id
 WHERE t.usuario_id = $1
   AND ($2::uuid IS NULL                     OR t.materia_id   = $2)
   AND ($3::academico.estado_tarea IS NULL   OR t.estado       = $3)
   AND ($4::timestamptz IS NULL              OR t.fecha_limite >= $4)
   AND ($5::timestamptz IS NULL              OR t.fecha_limite <= $5)
 ORDER BY t.fecha_limite ASC,
          CASE t.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END;

-- Marcar tarea como completada (HU04). completada_en lo llena el trigger.
UPDATE academico.tareas
   SET estado = 'completada'
 WHERE id = $1 AND usuario_id = $2
RETURNING *;

-- Tareas pendientes que se envían a la IA para el plan de estudio (RF08)
SELECT t.id, t.titulo, t.fecha_limite, t.prioridad, m.nombre AS materia
  FROM academico.tareas t
  JOIN academico.materias m ON m.id = t.materia_id
 WHERE t.usuario_id = $1
   AND t.estado <> 'completada'
   AND t.fecha_limite >= NOW()
 ORDER BY t.fecha_limite;

-- Guardar el resumen generado por la IA (RF07)
UPDATE academico.apuntes
   SET resumen_ia = $3, resumen_generado_en = NOW()
 WHERE id = $1 AND usuario_id = $2
RETURNING id, resumen_ia, resumen_generado_en;

-- Resumen por materia para el panel principal
SELECT * FROM academico.v_resumen_materias WHERE usuario_id = $1 ORDER BY nombre;

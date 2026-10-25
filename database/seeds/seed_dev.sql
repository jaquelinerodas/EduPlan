

BEGIN;

TRUNCATE academico.planes_estudio, academico.apuntes, academico.tareas,
         academico.materias, auth.usuarios RESTART IDENTITY CASCADE;


INSERT INTO auth.usuarios (id, google_id, email, nombre, rol, ultimo_acceso) VALUES
('11111111-1111-1111-1111-111111111111', 'google-demo-0001', 'ana.lopez@ejemplo.com',  'Ana López',     'estudiante',    NOW()),
('22222222-2222-2222-2222-222222222222', 'google-demo-0002', 'carlos.perez@ejemplo.com','Carlos Pérez', 'estudiante',    NOW()),
('33333333-3333-3333-3333-333333333333', 'google-demo-0003', 'admin@eduplan.com',       'Administrador', 'administrador', NOW());


INSERT INTO academico.materias (id, usuario_id, nombre, docente, descripcion, color) VALUES
('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Desarrollo Web I',     'Ing. Guillermo Pisqui', 'Microservicios, Docker y APIs REST', '#2563EB'),
('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Base de Datos II',     'Ing. María Castillo',   'Modelado relacional y SQL avanzado', '#9333EA'),
('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Matemática Discreta',  'Lic. Roberto Méndez',   NULL,                                  '#16A34A'),
('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Programación III',     'Ing. Sofía Ramírez',    'Estructuras de datos',               '#EA580C');


INSERT INTO academico.tareas (usuario_id, materia_id, titulo, descripcion, fecha_limite, prioridad, estado) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Diagrama de arquitectura',       'Entregar el diagrama del proyecto final',     NOW() - INTERVAL '2 days', 'alta',  'completada'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Modelo relacional en el repo',   'Subir scripts SQL y diagrama ER a GitHub',    NOW() + INTERVAL '2 days', 'alta',  'en_progreso'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Microservicio ms-auth',          'OAuth 2.0 con Google y emisión de JWT',       NOW() + INTERVAL '7 days', 'alta',  'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Ejercicios de normalización',    'Hoja 3: llevar a 3FN',                        NOW() + INTERVAL '4 days', 'media', 'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Laboratorio de índices',         NULL,                                          NOW() - INTERVAL '1 day',  'media', 'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000003', 'Guía de grafos',                 'Ejercicios 1 al 15',                          NOW() + INTERVAL '10 days','baja',  'pendiente'),
('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000004', 'Implementar árbol AVL',          'Inserción y rotaciones',                      NOW() + INTERVAL '5 days', 'alta',  'pendiente');


INSERT INTO academico.apuntes (usuario_id, materia_id, titulo, contenido) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Qué es un proxy inverso',
 'Un proxy inverso como Nginx recibe todas las peticiones del cliente y las reenvía al servicio interno que corresponde según la ruta. Permite tener un único punto de entrada, terminar TLS y ocultar los puertos internos de los microservicios.'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'JWT',
 'Un JSON Web Token tiene tres partes: header, payload y firma. El servidor firma el token con una clave secreta y lo valida en cada petición. Debe tener expiración (exp) para limitar el tiempo de uso.'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Formas normales',
 '1FN: valores atómicos. 2FN: sin dependencias parciales de la llave. 3FN: sin dependencias transitivas entre atributos no llave.');

UPDATE academico.apuntes
   SET resumen_ia = 'JWT = header + payload + firma; se valida en cada petición y debe expirar.',
       resumen_generado_en = NOW()
 WHERE titulo = 'JWT';


INSERT INTO academico.planes_estudio (usuario_id, fecha_inicio, fecha_fin, contenido, tareas_incluidas, modelo_ia)
SELECT '11111111-1111-1111-1111-111111111111',
       CURRENT_DATE,
       CURRENT_DATE + 7,
       'Día 1-2: terminar el modelo relacional. Día 3-4: ejercicios de normalización. Día 5-7: microservicio ms-auth.',
       ARRAY_AGG(id),
       'demo'
  FROM academico.tareas
 WHERE usuario_id = '11111111-1111-1111-1111-111111111111'
   AND estado <> 'completada';

COMMIT;

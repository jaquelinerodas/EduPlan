

BEGIN;

-- Limpia datos anteriores (en orden por las llaves foráneas)
TRUNCATE academico.flashcards, academico.cuestionario_intentos, academico.cuestionarios,
         academico.plan_actividades, academico.planes_estudio, academico.examenes,
         academico.apuntes, academico.tareas, academico.materias, auth.usuarios
         RESTART IDENTITY CASCADE;


-- Ana puede entrar con correo y contraseña: ana.lopez@ejemplo.com / Demo2026

INSERT INTO auth.usuarios (id, google_id, email, nombre, rol, ultimo_acceso, password_hash) VALUES
('11111111-1111-1111-1111-111111111111', 'google-demo-0001', 'ana.lopez@ejemplo.com',  'Ana López',     'estudiante',    NOW(), 'scrypt$16384$8$1$Zg4Z7E/uNn9p9ALJ4Mtw6w==$xKx2xDbfomm8JBWsqYuFXOhrhuycalnAWto8FKpB12auYGgG6HKeh+Oe09khhNGpZb2fWQhuVIyqliuyih3yhQ=='),
('22222222-2222-2222-2222-222222222222', 'google-demo-0002', 'carlos.perez@ejemplo.com','Carlos Pérez', 'estudiante',    NOW(), NULL),
('33333333-3333-3333-3333-333333333333', NULL,               'admin@eduplan.com',       'Administrador', 'administrador', NOW(), 'scrypt$16384$8$1$Zg4Z7E/uNn9p9ALJ4Mtw6w==$xKx2xDbfomm8JBWsqYuFXOhrhuycalnAWto8FKpB12auYGgG6HKeh+Oe09khhNGpZb2fWQhuVIyqliuyih3yhQ==');

-- Materias

INSERT INTO academico.materias (id, usuario_id, nombre, docente, descripcion, color) VALUES
('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Desarrollo Web I',     'Ing. Andrea Morales', 'Microservicios, Docker y APIs REST', '#2563EB'),
('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Base de Datos II',     'Ing. María Castillo',   'Modelado relacional y SQL avanzado', '#9333EA'),
('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Matemática Discreta',  'Lic. Roberto Méndez',   NULL,                                  '#16A34A'),
('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Programación III',     'Ing. Sofía Ramírez',    'Estructuras de datos',               '#EA580C');

-- Tareas (fechas relativas a hoy para que siempre haya pendientes y vencidas)

INSERT INTO academico.tareas (usuario_id, materia_id, titulo, descripcion, fecha_limite, prioridad, estado) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Diagrama de arquitectura',       'Entregar el diagrama del proyecto final',     NOW() - INTERVAL '2 days', 'alta',  'completada'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Modelo relacional en el repo',   'Subir scripts SQL y diagrama ER a GitHub',    NOW() + INTERVAL '2 days', 'alta',  'en_progreso'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Microservicio ms-auth',          'OAuth 2.0 con Google y emisión de JWT',       NOW() + INTERVAL '7 days', 'alta',  'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Ejercicios de normalización',    'Hoja 3: llevar a 3FN',                        NOW() + INTERVAL '4 days', 'media', 'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Laboratorio de índices',         NULL,                                          NOW() - INTERVAL '1 day',  'media', 'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000003', 'Guía de grafos',                 'Ejercicios 1 al 15',                          NOW() + INTERVAL '10 days','baja',  'pendiente'),
('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000004', 'Implementar árbol AVL',          'Inserción y rotaciones',                      NOW() + INTERVAL '5 days', 'alta',  'pendiente');

-- Apuntes

INSERT INTO academico.apuntes (usuario_id, materia_id, titulo, contenido) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Qué es un proxy inverso',
 'Un proxy inverso como Nginx recibe todas las peticiones del cliente y las reenvía al servicio interno que corresponde según la ruta. Permite tener un único punto de entrada, terminar TLS y ocultar los puertos internos de los microservicios.'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'JWT',
 'Un JSON Web Token tiene tres partes: header, payload y firma. El servidor firma el token con una clave secreta y lo valida en cada petición. Debe tener expiración (exp) para limitar el tiempo de uso.'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Formas normales',
 '1FN: valores atómicos. 2FN: sin dependencias parciales de la llave. 3FN: sin dependencias transitivas entre atributos no llave.');

-- Un apunte con resumen de IA ya generado 
UPDATE academico.apuntes
   SET resumen_ia = 'JWT = header + payload + firma; se valida en cada petición y debe expirar.',
       resumen_generado_en = NOW()
 WHERE titulo = 'JWT';


-- Examen

INSERT INTO academico.examenes (id, usuario_id, materia_id, titulo, fecha, temas) VALUES
('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002',
 'Segundo parcial', (CURRENT_DATE + 5) + TIME '09:00', E'Normalización (1FN, 2FN, 3FN)\nÍndices\nTransacciones');



INSERT INTO academico.planes_estudio
  (id, usuario_id, titulo, alcance, fecha_inicio, fecha_fin, contenido, consejos, horas_por_dia, tareas_incluidas, modelo_ia)
VALUES
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Semana del proyecto final', 'general',
 CURRENT_DATE - 1, CURRENT_DATE + 3,
 'Primero cierra el modelo relacional porque vence pronto; después avanza ms-auth y deja la guía de grafos para el final de la semana.',
 ARRAY['Trabaja en bloques de 50 minutos sin el teléfono.', 'Marca cada actividad al terminarla.', 'Si te atrasas, usa Reorganizar mi semana.'],
 2, '{}', 'demo');
INSERT INTO academico.plan_actividades (plan_id, usuario_id, fecha, hora_inicio, hora_fin, tipo, titulo, descripcion, materia_id, completada, completada_en) VALUES
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, '18:00', '18:50', 'tarea',    'Terminar scripts SQL',            'Crear tablas e índices del modelo.',          'a0000000-0000-0000-0000-000000000001', TRUE, NOW() - INTERVAL '1 day'),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, '18:50', '19:00', 'descanso', 'Descanso',                        NULL,                                          NULL, FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, '19:00', '19:50', 'estudio',  'Repasar formas normales',         'Leer el apunte y hacer 3 ejemplos.',          'a0000000-0000-0000-0000-000000000002', FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE,     '18:00', '18:50', 'tarea',    'Diagrama ER en el README',        'Exportar el diagrama y subirlo a GitHub.',    'a0000000-0000-0000-0000-000000000001', FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE,     '18:50', '19:00', 'descanso', 'Descanso',                        NULL,                                          NULL, FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE,     '19:00', '19:50', 'practica', 'Cuestionario de normalización',   'Resolver un cuestionario de 10 preguntas.',   'a0000000-0000-0000-0000-000000000002', FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + 1, '18:00', '18:50', 'estudio',  'OAuth 2.0 y JWT',                 'Repasar el flujo antes de programar ms-auth.', 'a0000000-0000-0000-0000-000000000001', FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + 2, '18:00', '18:50', 'repaso',   'Repaso de índices',               'Tarjetas de memoria y ejercicios.',           'a0000000-0000-0000-0000-000000000002', FALSE, NULL),
('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + 3, '18:00', '18:50', 'estudio',  'Guía de grafos: ejercicios 1-8',  NULL,                                          'a0000000-0000-0000-0000-000000000003', FALSE, NULL);

-- Cuestionario con un intento 

INSERT INTO academico.cuestionarios (id, usuario_id, materia_id, titulo, dificultad, preguntas, modelo_ia) VALUES
('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002',
 'Formas normales', 'media', '[
   {"pregunta":"¿Qué exige la primera forma normal (1FN)?","opciones":["Que no existan dependencias transitivas","Que todos los valores sean atómicos","Que cada tabla tenga una llave foránea","Que no existan índices duplicados"],"correcta":1,"explicacion":"1FN pide valores atómicos: un solo dato por celda, sin listas ni grupos repetidos.","tema":"1FN"},
   {"pregunta":"Una tabla en 2FN no puede tener…","opciones":["Dependencias parciales de la llave","Llaves compuestas","Más de 10 columnas","Valores nulos"],"correcta":0,"explicacion":"2FN elimina los atributos que dependen solo de una parte de una llave compuesta.","tema":"2FN"},
   {"pregunta":"¿Qué elimina la tercera forma normal (3FN)?","opciones":["Las llaves primarias","Las dependencias transitivas entre atributos no llave","Las relaciones muchos a muchos","Los tipos de datos de texto"],"correcta":1,"explicacion":"En 3FN ningún atributo no llave depende de otro atributo no llave.","tema":"3FN"}
 ]'::jsonb, 'demo');

INSERT INTO academico.cuestionario_intentos (cuestionario_id, usuario_id, respuestas, correctas, total, puntaje, temas_debiles) VALUES
('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '[1, 3, 1]', 2, 3, 66.67, ARRAY['2FN']);


-- Tarjetas de memoria 

INSERT INTO academico.flashcards (usuario_id, materia_id, frente, reverso, repeticiones, intervalo_dias, proximo_repaso) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '¿Qué partes tiene un JWT?', 'Header, payload y firma, separados por puntos.', 0, 0, CURRENT_DATE),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '¿Para qué sirve un proxy inverso?', 'Recibe las peticiones y las reenvía al servicio interno correcto; es el punto único de entrada.', 1, 2, CURRENT_DATE),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '¿Qué es una dependencia transitiva?', 'Cuando un atributo no llave depende de otro atributo no llave (A → B → C).', 2, 5, CURRENT_DATE + 3);

COMMIT;

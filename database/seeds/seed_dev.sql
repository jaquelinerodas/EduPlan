

BEGIN;


TRUNCATE academico.flashcards, academico.cuestionario_intentos, academico.cuestionarios, academico.periodos,
         academico.plan_actividades, academico.planes_estudio, academico.examenes,
         academico.apuntes, academico.tareas, academico.materias, auth.usuarios
         RESTART IDENTITY CASCADE;

-- Usuarios

INSERT INTO auth.usuarios (id, google_id, email, nombre, rol, ultimo_acceso, password_hash) VALUES
('11111111-1111-1111-1111-111111111111', 'google-demo-0001', 'ana.lopez@ejemplo.com',  'Ana López',     'estudiante',    NOW(), 'scrypt$16384$8$1$Zg4Z7E/uNn9p9ALJ4Mtw6w==$xKx2xDbfomm8JBWsqYuFXOhrhuycalnAWto8FKpB12auYGgG6HKeh+Oe09khhNGpZb2fWQhuVIyqliuyih3yhQ=='),
('22222222-2222-2222-2222-222222222222', 'google-demo-0002', 'carlos.perez@ejemplo.com','Carlos Pérez', 'estudiante',    NOW(), NULL),
('33333333-3333-3333-3333-333333333333', NULL,               'admin@eduplan.com',       'Administrador', 'administrador', NOW(), 'scrypt$16384$8$1$Zg4Z7E/uNn9p9ALJ4Mtw6w==$xKx2xDbfomm8JBWsqYuFXOhrhuycalnAWto8FKpB12auYGgG6HKeh+Oe09khhNGpZb2fWQhuVIyqliuyih3yhQ==');

-- Semestres y bloques de Ana (organizan materias y apuntes)

INSERT INTO academico.periodos (id, usuario_id, nombre, tipo, orden) VALUES
('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Semestre 1',      'semestre', 1),
('90000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Semestre 2',      'semestre', 2),
('90000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Proyecto final',  'carpeta',  3);


-- Materias

INSERT INTO academico.materias (id, usuario_id, nombre, docente, descripcion, color, periodo_id) VALUES
('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Desarrollo Web I',     'Ing. Andrea Morales', 'Microservicios, Docker y APIs REST', '#2563EB', '90000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Base de Datos II',     'Ing. María Castillo',   'Modelado relacional y SQL avanzado', '#9333EA', '90000000-0000-0000-0000-000000000002'),
('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Matemática Discreta',  'Lic. Roberto Méndez',   NULL,                                  '#16A34A', '90000000-0000-0000-0000-000000000001'),
('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Programación III',     'Ing. Sofía Ramírez',    'Estructuras de datos',               '#EA580C', NULL);


INSERT INTO academico.tareas (usuario_id, materia_id, titulo, descripcion, fecha_limite, prioridad, estado) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Diagrama de arquitectura',       'Entregar el diagrama del proyecto final',     NOW() - INTERVAL '2 days', 'alta',  'completada'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Modelo relacional en el repo',   'Subir scripts SQL y diagrama ER a GitHub',    NOW() + INTERVAL '2 days', 'alta',  'en_progreso'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Microservicio ms-auth',          'OAuth 2.0 con Google y emisión de JWT',       NOW() + INTERVAL '7 days', 'alta',  'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Ejercicios de normalización',    'Hoja 3: llevar a 3FN',                        NOW() + INTERVAL '4 days', 'media', 'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'Laboratorio de índices',         NULL,                                          NOW() - INTERVAL '1 day',  'media', 'pendiente'),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000003', 'Guía de grafos',                 'Ejercicios 1 al 15',                          NOW() + INTERVAL '10 days','baja',  'pendiente'),
('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000004', 'Implementar árbol AVL',          'Inserción y rotaciones',                      NOW() + INTERVAL '5 days', 'alta',  'pendiente');



INSERT INTO academico.apuntes (id, usuario_id, materia_id, periodo_id, titulo, etiquetas, favorito, contenido) VALUES
('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003',
 'Qué es un proxy inverso', ARRAY['nginx', 'arquitectura'], TRUE,
 'Un proxy inverso como Nginx recibe todas las peticiones del cliente y las reenvía al servicio interno que corresponde según la ruta. Permite tener un único punto de entrada, terminar TLS y ocultar los puertos internos de los microservicios.'),
('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003',
 'JWT', ARRAY['seguridad'], FALSE,
 'Un JSON Web Token tiene tres partes: header, payload y firma. El servidor firma el token con una clave secreta y lo valida en cada petición. Debe tener expiración (exp) para limitar el tiempo de uso.'),
('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002',
 'Formas normales', ARRAY['normalización', 'parcial 2'], TRUE,
 E'1FN: valores atómicos, sin listas ni grupos repetidos.\n2FN: sin dependencias parciales de la llave compuesta.\n3FN: sin dependencias transitivas entre atributos no llave.'),
('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002',
 'Índices y vistas', ARRAY['sql', 'parcial 2'], FALSE,
 E'ÍNDICES\nUn índice acelera las búsquedas a cambio de espacio y de escrituras más lentas. Conviene en columnas usadas en WHERE, JOIN y ORDER BY.\n\nVISTAS\nUna vista es una consulta guardada con nombre. Simplifica consultas repetidas y permite ocultar columnas sensibles.\n\n```sql\nCREATE INDEX ix_tareas_fecha ON tareas (fecha_limite);\nCREATE VIEW v_pendientes AS\n  SELECT titulo, fecha_limite FROM tareas WHERE estado <> ''completada'';\n```'),
('d0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002',
 'Transacciones y concurrencia', ARRAY['sql', 'parcial 2'], FALSE,
 E'Una transacción agrupa operaciones que se ejecutan todas o ninguna (BEGIN, COMMIT, ROLLBACK).\n\nPROPIEDADES ACID\n- Atomicidad: todo o nada.\n- Consistencia: la base pasa de un estado válido a otro.\n- Aislamiento: las transacciones concurrentes no se estorban.\n- Durabilidad: lo confirmado no se pierde.\n\nNiveles de aislamiento: READ COMMITTED, REPEATABLE READ y SERIALIZABLE.'),
('d0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002',
 'Procedimientos almacenados, funciones y triggers en PL/SQL', ARRAY['plsql'], FALSE,
 E'INTRODUCCIÓN\nPL/SQL (Procedural Language/SQL) es una extensión de SQL desarrollada por Oracle que permite incorporar estructuras de programación como variables, condiciones, ciclos, procedimientos, funciones y manejo de excepciones dentro de una base de datos.\n\n1. PROCEDIMIENTOS ALMACENADOS\nUn procedimiento almacenado es un bloque de código PL/SQL que se guarda en la base de datos y puede ejecutarse muchas veces. Permite encapsular lógica de negocio y reducir la transferencia de datos entre el cliente y el servidor.\n\n```sql\nCREATE OR REPLACE PROCEDURE obtener_estudiantes (\n  p_carrera IN VARCHAR2\n) IS\nBEGIN\n  SELECT * FROM estudiantes\n  WHERE carrera = p_carrera;\nEND;\n/\n```\n\n2. FUNCIONES\nUna función siempre devuelve un valor con RETURN y se puede usar dentro de una consulta SELECT.\n\n3. TRIGGERS\nUn trigger se ejecuta automáticamente antes o después de un INSERT, UPDATE o DELETE. Sirve para validar datos o llevar bitácoras.'),
('d0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001',
 'Lógica proposicional y tablas de verdad', ARRAY['lógica'], FALSE,
 E'Una proposición es un enunciado que es verdadero o falso.\n\nCONECTIVOS\n- Negación (¬p)\n- Conjunción (p ∧ q): verdadera solo si ambas lo son.\n- Disyunción (p ∨ q): falsa solo si ambas son falsas.\n- Condicional (p → q): falsa solo si p es verdadera y q falsa.\n- Bicondicional (p ↔ q): verdadera si ambas tienen el mismo valor.\n\nUna tautología es verdadera en todas las filas de su tabla de verdad.');

-- Un apunte con resumen de IA ya generado 
UPDATE academico.apuntes
   SET resumen_ia = 'JWT = header + payload + firma; se valida en cada petición y debe expirar.',
       resumen_generado_en = NOW()
 WHERE titulo = 'JWT';


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


INSERT INTO academico.cuestionarios (id, usuario_id, materia_id, titulo, dificultad, apuntes_incluidos, preguntas, modelo_ia) VALUES
('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002',
 'Formas normales', 'media', ARRAY['d0000000-0000-0000-0000-000000000003']::uuid[], '[
   {"pregunta":"¿Qué exige la primera forma normal (1FN)?","opciones":["Que no existan dependencias transitivas","Que todos los valores sean atómicos","Que cada tabla tenga una llave foránea","Que no existan índices duplicados"],"correcta":1,"explicacion":"1FN pide valores atómicos: un solo dato por celda, sin listas ni grupos repetidos.","tema":"1FN","apunteId":"d0000000-0000-0000-0000-000000000003"},
   {"pregunta":"Una tabla en 2FN no puede tener…","opciones":["Dependencias parciales de la llave","Llaves compuestas","Más de 10 columnas","Valores nulos"],"correcta":0,"explicacion":"2FN elimina los atributos que dependen solo de una parte de una llave compuesta.","tema":"2FN","apunteId":"d0000000-0000-0000-0000-000000000003"},
   {"pregunta":"¿Qué elimina la tercera forma normal (3FN)?","opciones":["Las llaves primarias","Las dependencias transitivas entre atributos no llave","Las relaciones muchos a muchos","Los tipos de datos de texto"],"correcta":1,"explicacion":"En 3FN ningún atributo no llave depende de otro atributo no llave.","tema":"3FN","apunteId":"d0000000-0000-0000-0000-000000000003"}
 ]'::jsonb, 'demo');

INSERT INTO academico.cuestionario_intentos (cuestionario_id, usuario_id, respuestas, correctas, total, puntaje, temas_debiles, apuntes_recomendados, creado_en) VALUES
('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '[0, 3, 0]', 0, 3, 0.00,  ARRAY['1FN', '2FN', '3FN'], ARRAY['d0000000-0000-0000-0000-000000000003']::uuid[], NOW() - INTERVAL '3 days'),
('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '[1, 3, 1]', 2, 3, 66.67, ARRAY['2FN'],               ARRAY['d0000000-0000-0000-0000-000000000003']::uuid[], NOW() - INTERVAL '1 day');


INSERT INTO academico.flashcards (usuario_id, materia_id, apunte_id, frente, reverso, repeticiones, intervalo_dias, proximo_repaso) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '¿Qué partes tiene un JWT?', 'Header, payload y firma, separados por puntos.', 0, 0, CURRENT_DATE),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '¿Para qué sirve un proxy inverso?', 'Recibe las peticiones y las reenvía al servicio interno correcto; es el punto único de entrada.', 1, 2, CURRENT_DATE),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', '¿Qué es una dependencia transitiva?', 'Cuando un atributo no llave depende de otro atributo no llave (A → B → C).', 2, 5, CURRENT_DATE + 3),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', '¿Qué significa la "A" de ACID?', 'Atomicidad: la transacción se ejecuta completa o no se ejecuta.', 0, 0, CURRENT_DATE),
('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', '¿Qué diferencia a una función de un procedimiento en PL/SQL?', 'La función siempre devuelve un valor con RETURN y se puede usar en un SELECT.', 0, 0, CURRENT_DATE);

COMMIT;

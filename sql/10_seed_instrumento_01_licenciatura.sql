-- =========================================================
-- 10_seed_instrumento_01_licenciatura.sql
-- Inserta SOLO el catálogo del instrumento Licenciatura (id = 1)
-- =========================================================

USE `multicriterio_IPEPD`;

-- Instrumento 1 fijo
INSERT INTO instrumento (instrumento_id, nombre)
VALUES (1, 'Licenciatura')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Para que el próximo instrumento sea >= 2
ALTER TABLE instrumento AUTO_INCREMENT = 2;

-- -------------------------
-- Categorías (CAT1..CAT5)
-- -------------------------
INSERT INTO categoria (instrumento_id, categoria_code, orden, nombre, objetivo)
VALUES
(1,'CAT1',1,'Planeación didáctica',
 'Evaluar la claridad con la que el docente estructura el curso y comunica de manera coherente sus componentes —contenidos, objetivos, actividades y criterios de trabajo— tanto en el aula como a través de la plataforma institucional, de modo que el estudiante conozca la materia de estudio, comprenda los propósitos formativos y cuente con los medios y estrategias necesarias para favorecer su proceso educativo y el logro de los aprendizajes esperados.'),
(1,'CAT2',2,'Habilidades didácticas y pedagógicas apoyadas en recursos digitales',
 'Valorar el uso pedagógico de estrategias y recursos digitales como apoyo al aprendizaje.'),
(1,'CAT3',3,'Evaluación del aprendizaje y retroalimentación',
 'Analizar la claridad, congruencia y sentido formativo de la evaluación, incluyendo el uso de medios digitales.'),
(1,'CAT4',4,'Práctica docente, ambiente de aula y uso responsable de la tecnología',
 'Evaluar la conducción profesional del docente y el clima educativo, incluyendo el uso ético de recursos digitales.'),
(1,'CAT5',5,'Habilidades docentes y formación integral apoyada en la plataforma',
 'Fortalecer el papel de la orientación académica y el acompañamiento con apoyo de recursos institucionales.')
ON DUPLICATE KEY UPDATE
  orden = VALUES(orden),
  nombre = VALUES(nombre),
  objetivo = VALUES(objetivo),
  is_active = 1;

-- -------------------------
-- Ítems (con codigo_visible)
-- -------------------------
INSERT INTO item (instrumento_id, categoria_code, orden, codigo_visible, contenido) VALUES
-- CAT1 (1.1 - 1.5)
(1,'CAT1',1,'1.1','La persona docente presentó el programa de la asignatura al inicio del curso, de manera clara y accesible.'),
(1,'CAT1',2,'1.2','Explicó los objetivos, contenidos y forma de trabajo de la asignatura.'),
(1,'CAT1',3,'1.3','Los materiales y recursos del curso estuvieron organizados y disponibles oportunamente.'),
(1,'CAT1',4,'1.4','Existió coherencia entre lo trabajado en clase y los materiales compartidos en la plataforma.'),
(1,'CAT1',5,'1.5','La organización del curso facilitó el seguimiento de las actividades y contenidos.'),

-- CAT2 (2.1 - 2.5)
(1,'CAT2',1,'2.1','Explicó los temas de manera clara y comprensible.'),
(1,'CAT2',2,'2.2','Utilizó recursos digitales (presentaciones, lecturas, videos, actividades) que apoyaron mi aprendizaje.'),
(1,'CAT2',3,'2.3','Promovió la participación activa del grupo, tanto en clase como a través de medios digitales.'),
(1,'CAT2',4,'2.4','Relacionó los contenidos con ejemplos, casos o actividades apoyadas en recursos digitales.'),
(1,'CAT2',5,'2.5','Mostró disposición para aclarar dudas de manera presencial o a través de la plataforma.'),

-- CAT3 (3.1 - 3.5)
(1,'CAT3',1,'3.1','La persona docente dio a conocer los criterios de evaluación desde el inicio del curso.'),
(1,'CAT3',2,'3.2','Los criterios de evaluación fueron congruentes con los contenidos y actividades realizadas.'),
(1,'CAT3',3,'3.3','Las actividades y evaluaciones permitieron demostrar lo aprendido.'),
(1,'CAT3',4,'3.4','La retroalimentación recibida, presencial o mediante la plataforma, contribuyó a mejorar mi desempeño.'),
(1,'CAT3',5,'3.5','El uso de la plataforma facilitó el seguimiento de mis avances y resultados.'),

-- CAT4 (4.1 - 4.7)
(1,'CAT4',1,'4.1','Se condujo con respeto hacia los estudiantes.'),
(1,'CAT4',2,'4.2','Promovió un ambiente de confianza y participación en el aula y/o en los espacios digitales.'),
(1,'CAT4',3,'4.3','Mostró apertura a la diversidad de ideas y opiniones.'),
(1,'CAT4',4,'4.4','Utilizó los recursos digitales de manera responsable y con fines académicos.'),
(1,'CAT4',5,'4.5','Mostró compromiso con el desarrollo del curso en modalidad presencial y digital.'),
(1,'CAT4',6,'4.6','Asistió a clases.'),
(1,'CAT4',7,'4.7','En promedio, de acuerdo con la hora programada en tu horario, tu clase inició.'),

-- CAT5 (5.1 - 5.5)
(1,'CAT5',1,'5.1','Brindó orientación para mejorar el aprendizaje en la asignatura.'),
(1,'CAT5',2,'5.2','Utilizó la plataforma para compartir materiales que apoyaron la comprensión de los temas.'),
(1,'CAT5',3,'5.3','Vinculó los contenidos de la asignatura con la formación profesional del estudiante.'),
(1,'CAT5',4,'5.4','Promovió hábitos de estudio, organización y responsabilidad académica mediante actividades y recursos digitales.'),
(1,'CAT5',5,'5.5','Mostró disposición para brindar acompañamiento académico presencial o a través de la plataforma institucional.')
ON DUPLICATE KEY UPDATE
  contenido = VALUES(contenido),
  is_active = 1;

-- =========================================================
-- 11_seed_instrumento_02_suayed.sql
-- Inserta SOLO el catálogo del instrumento SUAyED (id = 2)
-- =========================================================

USE `multicriterio_IPEPD`;

-- Instrumento 2 fijo
INSERT INTO instrumento (instrumento_id, nombre)
VALUES (2, 'SUAyED')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Asegura que el próximo instrumento sea >= 3
ALTER TABLE instrumento AUTO_INCREMENT = 3;

-- -------------------------
-- Categorías (CAT1..CAT6)
-- -------------------------
INSERT INTO categoria (instrumento_id, categoria_code, orden, nombre, objetivo)
VALUES
(2,'CAT1',1,'Planeación didáctica para el SUAyED',
 'El estudiante debe conocer el programa de la asignatura, los objetivos, y los medios y materiales para llegar a ellos.'),
(2,'CAT2',2,'Habilidades didácticas y pedagógicas',
 'Refiriéndose al uso de estrategias y herramientas pedagógico didácticas que favorezcan el proceso educativo.'),
(2,'CAT3',3,'Proceso de evaluación',
 'Precisa si existió claridad en los criterios, congruencia con lo acordado y vinculación entre los instrumentos de evaluación con los contenidos.'),
(2,'CAT4',4,'Práctica y habilidades docentes',
 'Implica competencias básicas necesarias en la práctica docente (dominio del área de conocimiento, comunicación asertiva, atención y retroalimentación a dudas, entre otras).'),
(2,'CAT5',5,'Asistencias y horarios',
 'Permite contemplar la asistencia y puntualidad del docente y de los estudiantes.'),
(2,'CAT6',6,'Comentarios en materia de género',
 NULL)
ON DUPLICATE KEY UPDATE
  orden = VALUES(orden),
  nombre = VALUES(nombre),
  objetivo = VALUES(objetivo),
  is_active = 1;

-- -------------------------
-- Ítems (incluye subítems como ítems rankeables)
-- -------------------------
INSERT INTO item (instrumento_id, categoria_code, orden, codigo_visible, contenido) VALUES
-- CAT1
(2,'CAT1',1,'1.1','Presentó el programa de la licenciatura por impartir, y explicó la pertinencia de los contenidos temáticos correspondientes a cada semestre.'),
(2,'CAT1',2,'1.2','Dió a conocer los objetivos, general y particulares del programa educativo.'),
(2,'CAT1',3,'1.3','Promovió la continuidad en los contenidos temáticos del programa, sin omitir alguno.'),
(2,'CAT1',4,'1.4','Respetó la modalidad del sistema abierto, con actividades síncronas y asíncronas.'),
(2,'CAT1',5,'1.5','Utilizó diferentes recursos y materiales didácticos para formular y representar los contenidos:'),
(2,'CAT1',6,'1.5.1','Plataformas digitales para interacción'),
(2,'CAT1',7,'1.5.2','Materiales para la participación en tiempo real'),
(2,'CAT1',8,'1.5.3','Recursos multimedia para el aprendizaje híbrido'),
(2,'CAT1',9,'1.5.4','Herramientas de Inteligencia Artificial, con un enfoque ético y responsable'),

-- CAT2
(2,'CAT2',1,'2.1','Personalizó la experiencia del aprendizaje, con actividades y tareas (síncronas y asíncronas) atractivas, accesibles y congruentes con los contenidos.'),
(2,'CAT2',2,'2.2','Demostró conocimiento pedagógico, explicando los temas de manera asertiva y accesible para los diferentes estilos de aprendizaje.'),
(2,'CAT2',3,'2.3','Integró la tecnología educativa mediante diferentes estrategias didácticas que contribuyeron a la construcción de un aprendizaje significativo.'),

-- CAT3
(2,'CAT3',1,'3.1','Presentó el encuadre educativo incluyendo información administrativa (horarios, calificaciones acreditadoras, asistencias…), y académica (metodología de trabajo y criterios de evaluación)'),
(2,'CAT3',2,'3.2','Respetó los criterios de evaluación acordados con el grupo, sin omitir ni agregar alguno sin previo aviso.'),
(2,'CAT3',3,'3.3','Estableció criterios de evaluación relacionados con los contenidos temáticos y con el sistema de educación abierta y a distancia.'),
(2,'CAT3',4,'3.4','Utilizó diferentes instrumentos de evaluación:'),
(2,'CAT3',5,'3.4.1','Diagnóstica (al inicio del semestre, parcial o tema)'),
(2,'CAT3',6,'3.4.2','Formativa (durante todo el semestre, implica aspectos cualitativos)'),
(2,'CAT3',7,'3.4.3','Sumativa (al final, implica una calificación)'),

-- CAT4
(2,'CAT4',1,'4.1','Demostró dominio de la asignatura, y enriqueció el contenido temático con temas innovadores y actualizados, que fueron de tu interés y contribuyeron a tu formación.'),
(2,'CAT4',2,'4.2','Evidenció habilidades de comunicación con el grupo, promoviendo la participación en clase, con apertura y respeto a la diversidad de ideas u opiniones, asimismo proporcionó retroalimentación.'),
(2,'CAT4',3,'4.3','Atendió y resolvió todas las dudas con trato justo e igualitario.'),
(2,'CAT4',4,'4.4','Vinculó el contenido temático con ejemplos relacionados a la licenciatura impartida y al contexto actual (social, económico, político y cultural).'),
(2,'CAT4',5,'4.5','Fomentó el aprendizaje autónomo, la investigación y la autogestión.'),

-- CAT5
(2,'CAT5',1,'5.1','El profesor ingresó o asistió a todas, o a la mayoría de las clases, avisando previamente alguna inasistencia'),
(2,'CAT5',2,'5.2','En promedio, de acuerdo con la hora programada en tu horario, tu clase inició (valoración cualitativa)'),

-- CAT6
(2,'CAT6',1,'6.1','Presentó actitudes, comentarios o acciones que propiciaron la fomentación de roles o estereotipos de género'),
(2,'CAT6',2,'6.2','Manifestó actitudes o comentarios machistas, misóginas y/o discriminatorias por orientación sexual o identidad de género'),
(2,'CAT6',3,'6.3','Ejerció violencia de género (física, psicológica, verbal, digital…)'),
(2,'CAT6',4,'6.4','Acosó o incomodó con acciones y/o comentarios inapropiados')
ON DUPLICATE KEY UPDATE
  contenido = VALUES(contenido),
  is_active = 1;

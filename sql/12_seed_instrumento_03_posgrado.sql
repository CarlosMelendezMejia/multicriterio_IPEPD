-- =========================================================
-- 12_seed_instrumento_03_posgrado.sql
-- Inserta SOLO el catálogo del instrumento Posgrado (id = 3)
-- Enfoque: ítems planos (incluye líneas tipo encabezado como ítems rankeables)
-- =========================================================

USE `multicriterio_IPEPD`;

-- Instrumento 3 fijo
INSERT INTO instrumento (instrumento_id, nombre)
VALUES (3, 'Posgrado')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Asegura que el próximo instrumento sea >= 4
ALTER TABLE instrumento AUTO_INCREMENT = 4;

-- -------------------------
-- Categorías (CAT1..CAT5)
-- -------------------------
INSERT INTO categoria (instrumento_id, categoria_code, orden, nombre, objetivo)
VALUES
(3,'CAT1',1,'Planeación didáctica',
 'Evaluar la capacidad del docente para estructurar, comunicar y desarrollar el espacio académico del posgrado con claridad epistemológica, coherencia metodológica y pertenencia disciplinar.'),
(3,'CAT2',2,'Mediación pedagógica en posgrado',
 'Valorar las estrategias de las personas docentes para promover el análisis crítico, la discusión académica y la construcción colectiva del conocimiento.'),
(3,'CAT3',3,'Evaluación formativa y académica',
 'Analizar la claridad, coherencia y sentido formativo de los procesos de evaluación en el posgrado.'),
(3,'CAT4',4,'Práctica académica, ética e identidad institucional',
 'Evaluar la conducción profesional del docente, el clima académico y el respeto a los principios universitarios.'),
(3,'CAT5',5,'Acompañamiento académico y formación para la investigación',
 'Valorar el acompañamiento experto y la orientación académica avanzada.')
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
(3,'CAT1',1,'1.1','La persona docente presentó con claridad los propósitos formativos de la asignatura o seminario, en congruencia con el programa de posgrado.'),
(3,'CAT1',2,'1.2','La persona docente explicó la articulación de la asignatura con las líneas de generación y aplicación del conocimiento del programa.'),
(3,'CAT1',3,'1.3','Los contenidos abordados mantuvieron coherencia con los objetivos académicos planteados.'),
(3,'CAT1',4,'1.4','Las actividades académicas propuestas estuvieron alineadas con el nivel de complejidad propio del posgrado.'),
(3,'CAT1',5,'1.5','El desarrollo del curso mantuvo una secuencia lógica y académicamente fundamentada.'),

-- CAT2 (2.1 - 2.5)
(3,'CAT2',1,'2.1','La persona docente promovió la problematización teórica de los contenidos abordados.'),
(3,'CAT2',2,'2.2','Las estrategias pedagógicas favorecieron el análisis crítico y la argumentación fundamentada.'),
(3,'CAT2',3,'2.3','La persona docente propició el diálogo académico y la confrontación de ideas con sustento teórico.'),
(3,'CAT2',4,'2.4','Las sesiones contribuyeron al desarrollo de habilidades cognitivas como análisis, síntesis, interpretación, evaluación.'),
(3,'CAT2',5,'2.5','La persona docente adaptó su mediación académica al perfil y trayectoria del grupo.'),

-- CAT3 (3.1 - 3.5)  [se conserva 3.1 como ítem simple]
(3,'CAT3',1,'3.1','La persona docente dio a conocer los criterios de evaluación:'),
(3,'CAT3',2,'3.2','Los criterios de evaluación fueron congruentes con los objetivos y contenidos de la asignatura.'),
(3,'CAT3',3,'3.3','Las estrategias de evaluación privilegiaron el proceso formativo, no solo los productos finales.'),
(3,'CAT3',4,'3.4','La retroalimentación brindada fue oportuna, pertinente y académicamente fundamentada.'),
(3,'CAT3',5,'3.5','La evaluación contribuyó a mejorar el desempeño académico y el aprendizaje.'),

-- CAT4 (4.1 - 4.5)
(3,'CAT4',1,'4.1','Se condujo con respeto, apertura y trato equitativo hacia los estudiantes.'),
(3,'CAT4',2,'4.2','Promovió un ambiente académico basado en el diálogo, la crítica respetuosa y la pluralidad de ideas.'),
(3,'CAT4',3,'4.3','La persona docente mostró compromiso y responsabilidad en el desarrollo del curso.'),
(3,'CAT4',4,'4.4','Fomentó prácticas de integridad académica y ética profesional.'),
(3,'CAT4',5,'4.5','Su práctica reflejó los valores institucionales de responsabilidad social y compromiso académico.'),

-- CAT5 (5.1 - 5.5)
(3,'CAT5',1,'5.1','Orientó adecuadamente los procesos de investigación vinculados a la asignatura.'),
(3,'CAT5',2,'5.2','Brindó acompañamiento académico pertinente en el desarrollo de proyectos, ensayos o avances de investigación.'),
(3,'CAT5',3,'5.3','Promovió el uso riguroso de fuentes académicas y metodologías de investigación.'),
(3,'CAT5',4,'5.4','Incentivó la participación en actividades académicas como coloquios, seminarios o congresos.'),
(3,'CAT5',5,'5.5','Favoreció la reflexión crítica sobre la producción y aplicación del conocimiento.')
ON DUPLICATE KEY UPDATE
  contenido = VALUES(contenido),
  is_active = 1;

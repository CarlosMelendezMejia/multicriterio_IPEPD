-- =========================================================
-- 01_schema.sql - multicriterio_IPEPD (MySQL 5.7, InnoDB)
-- Estructura únicamente (sin inserts de instrumentos)
-- =========================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ----------------------------
-- Database
-- ----------------------------
CREATE DATABASE IF NOT EXISTS `multicriterio_IPEPD`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `multicriterio_IPEPD`;

-- =========================
-- 1) Catálogo: Instrumentos
-- =========================
CREATE TABLE IF NOT EXISTS instrumento (
  instrumento_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (instrumento_id),
  UNIQUE KEY uk_instrumento_nombre (nombre)
) ENGINE=InnoDB;

-- =========================
-- 2) Catálogo: Categorías
-- =========================
CREATE TABLE IF NOT EXISTS categoria (
  instrumento_id INT UNSIGNED NOT NULL,
  categoria_code VARCHAR(10) NOT NULL,  -- CAT1, CAT2...
  orden INT NOT NULL,                   -- 1..N (orden oficial)
  nombre VARCHAR(160) NOT NULL,
  objetivo TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (instrumento_id, categoria_code),
  UNIQUE KEY uk_categoria_orden (instrumento_id, orden),
  KEY idx_categoria_instrumento (instrumento_id),

  CONSTRAINT fk_categoria_instrumento
    FOREIGN KEY (instrumento_id)
    REFERENCES instrumento(instrumento_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================
-- 3) Catálogo: Ítems
-- =========================
CREATE TABLE IF NOT EXISTS item (
  item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  instrumento_id INT UNSIGNED NOT NULL,
  categoria_code VARCHAR(10) NOT NULL,   -- CAT1..CATn
  orden INT NOT NULL,                    -- 1..M dentro de su categoría
  codigo_visible VARCHAR(10) NOT NULL,   -- "1.1", "4.7", etc.
  contenido TEXT NOT NULL,
  parent_item_id INT UNSIGNED NULL DEFAULT NULL,  -- NULL = ítem normal/padre; SET = sub-ítem
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (item_id),
  UNIQUE KEY uk_item_orden (instrumento_id, categoria_code, orden),
  UNIQUE KEY uk_item_codigo_visible (instrumento_id, codigo_visible),
  KEY idx_item_categoria (instrumento_id, categoria_code),
  KEY idx_item_parent (parent_item_id),

  CONSTRAINT fk_item_categoria
    FOREIGN KEY (instrumento_id, categoria_code)
    REFERENCES categoria(instrumento_id, categoria_code)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT fk_item_parent
    FOREIGN KEY (parent_item_id)
    REFERENCES item(item_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================
-- 4) Roles y Usuarios
--  - password_sha256: SHA-256 hex (64 chars)
--  (validación de formato se hará en la app o con triggers opcionales)
-- =========================
CREATE TABLE IF NOT EXISTS rol (
  rol_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  peso INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rol_id),
  UNIQUE KEY uk_rol_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario (
  usuario_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_usuario VARCHAR(80) NOT NULL,
  password_sha256 CHAR(64) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  apellido_paterno VARCHAR(80) NOT NULL,
  apellido_materno VARCHAR(80) NOT NULL,
  grado VARCHAR(80) NOT NULL,
  rol_id INT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (usuario_id),
  UNIQUE KEY uk_usuario_login (nombre_usuario),
  KEY idx_usuario_rol (rol_id),

  CONSTRAINT fk_usuario_rol
    FOREIGN KEY (rol_id)
    REFERENCES rol(rol_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================
-- 5) Cabecera de Evaluación
--  - una evaluación por usuario por instrumento
--  - snapshot del rol/peso para trazabilidad
-- =========================
CREATE TABLE IF NOT EXISTS evaluacion (
  evaluacion_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  instrumento_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,

  rol_id_snapshot INT UNSIGNED NOT NULL,
  rol_peso_snapshot INT NOT NULL,

  status ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME NULL,

  PRIMARY KEY (evaluacion_id),
  UNIQUE KEY uk_eval_unica (usuario_id, instrumento_id),
  KEY idx_eval_instr_status (instrumento_id, status, submitted_at),
  KEY idx_eval_usuario (usuario_id),

  CONSTRAINT fk_eval_instrumento
    FOREIGN KEY (instrumento_id)
    REFERENCES instrumento(instrumento_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT fk_eval_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuario(usuario_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================
-- 6) Ranking de Categorías
--  - sin repetición: UNIQUE(evaluacion_id, rank_value)
-- =========================
CREATE TABLE IF NOT EXISTS evaluacion_categoria (
  evaluacion_id BIGINT UNSIGNED NOT NULL,
  instrumento_id INT UNSIGNED NOT NULL,
  categoria_code VARCHAR(10) NOT NULL,
  rank_value INT NOT NULL,

  PRIMARY KEY (evaluacion_id, categoria_code),
  UNIQUE KEY uk_evalcat_rank (evaluacion_id, rank_value),
  KEY idx_evalcat_cat (instrumento_id, categoria_code),

  CONSTRAINT fk_evalcat_eval
    FOREIGN KEY (evaluacion_id)
    REFERENCES evaluacion(evaluacion_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,

  CONSTRAINT fk_evalcat_categoria
    FOREIGN KEY (instrumento_id, categoria_code)
    REFERENCES categoria(instrumento_id, categoria_code)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =========================
-- 7) Ranking de Ítems (por categoría)
--  - sin repetición por categoría: UNIQUE(evaluacion_id, categoria_code, rank_value)
-- =========================
CREATE TABLE IF NOT EXISTS evaluacion_item (
  evaluacion_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  categoria_code VARCHAR(10) NOT NULL,
  rank_group INT UNSIGNED NOT NULL DEFAULT 0,  -- 0 = ítems principales; >0 = parent_item_id del grupo de sub-ítems
  rank_value INT NOT NULL,

  PRIMARY KEY (evaluacion_id, item_id),
  UNIQUE KEY uk_evalitem_rank (evaluacion_id, categoria_code, rank_group, rank_value),
  KEY idx_evalitem_item (item_id),

  CONSTRAINT fk_evalitem_eval
    FOREIGN KEY (evaluacion_id)
    REFERENCES evaluacion(evaluacion_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,

  CONSTRAINT fk_evalitem_item
    FOREIGN KEY (item_id)
    REFERENCES item(item_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------
-- Restore settings
-- ----------------------------
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

-- =====================================================================
--  APP TALLER MTTO — Esquema de base de datos (SQLite)
--  Basado en el Documento Maestro Consolidado (secciones 36 y 37).
--  Se usan campos técnicos comunes: created_at, updated_at, activo,
--  usuario creador/modificador, motivo de anulación, etc.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- CATÁLOGOS (config. por Administrador — sección 5.1)
-- Un solo catálogo genérico con discriminador "tipo".
-- tipo: prioridad | criticidad | tipo_aviso | tipo_mantenimiento |
--       estado_aviso | estado_ot | estado_material | categoria_tiempo |
--       motivo_bloqueo | especialidad | estado_planificacion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo        TEXT NOT NULL,
  codigo      TEXT NOT NULL,
  etiqueta    TEXT NOT NULL,
  color       TEXT,                 -- hex opcional (prioridades/estados)
  orden       INTEGER DEFAULT 0,
  es_backlog  INTEGER DEFAULT 0,    -- estado que forma parte del backlog
  es_final    INTEGER DEFAULT 0,    -- estado terminal (Concluida/Anulada...)
  etapa       TEXT,                 -- 'Aviso' | 'Orden de Trabajo' (para backlog)
  activo      INTEGER DEFAULT 1,
  UNIQUE (tipo, codigo)
);

-- ---------------------------------------------------------------------
-- USUARIOS OPERATIVOS (autenticación simulada de Entra ID — sección 6)
-- rol: administrador | solicitante | gestor_sap | supervisor |
--      tecnico | planificador
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  correo      TEXT NOT NULL UNIQUE,
  rol         TEXT NOT NULL,
  cargo       TEXT,
  entra_id    TEXT,                 -- identificador simulado
  area_id     INTEGER REFERENCES area(id),
  especialidad TEXT,
  activo      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- ÁREAS Y ZONAS DEL TALLER (sección 12)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS area (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                 TEXT NOT NULL UNIQUE,
  supervisor_id          INTEGER REFERENCES usuario(id),
  capacidad_semanal_horas REAL DEFAULT 0,  -- horas hombre disponibles / semana
  activo                 INTEGER DEFAULT 1,
  created_at             TEXT DEFAULT (datetime('now')),
  updated_at             TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- CATÁLOGO DE EQUIPOS (sección 21)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipo (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  modelo      TEXT,
  ubicacion   TEXT,
  area_id     INTEGER REFERENCES area(id),
  criticidad  TEXT,                 -- codigo de catalogo criticidad
  activo      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- AVISOS (sección 7)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aviso (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo            TEXT NOT NULL UNIQUE,          -- código interno AV-2026-000001
  equipo_id         INTEGER REFERENCES equipo(id),
  equipo_desconocido INTEGER DEFAULT 0,
  centro_coste      TEXT,                          -- requerido si equipo desconocido
  area_id           INTEGER REFERENCES area(id),
  ubicacion         TEXT,
  sintoma           TEXT,
  descripcion       TEXT,
  tipo_aviso        TEXT,                          -- codigo catalogo
  prioridad         TEXT,                          -- codigo catalogo prioridad
  criticidad        TEXT,
  estado            TEXT NOT NULL DEFAULT 'borrador',
  solicitante_id    INTEGER REFERENCES usuario(id),
  geo_lat           REAL,
  geo_lng           REAL,
  observaciones     TEXT,                          -- observaciones del validador
  -- Estimación preliminar (sección 24.1)
  duracion_estimada REAL,                          -- horas
  tecnicos_estimados INTEGER,
  especialidad      TEXT,
  complejidad       TEXT,
  -- Enlace SAP (sección 9)
  aviso_sap         TEXT,
  fecha_registro_sap TEXT,
  gestor_sap_id     INTEGER REFERENCES usuario(id),
  -- Auditoría / técnicos comunes (sección 37)
  fecha_aprobacion  TEXT,
  motivo_anulacion  TEXT,
  activo            INTEGER DEFAULT 1,
  created_by        INTEGER REFERENCES usuario(id),
  updated_by        INTEGER REFERENCES usuario(id),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- ÓRDENES DE TRABAJO (sección 10)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orden (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo               TEXT NOT NULL UNIQUE,       -- OT-2026-000001
  aviso_id             INTEGER REFERENCES aviso(id),
  aviso_sap            TEXT,
  ot_sap               TEXT,
  equipo_id            INTEGER REFERENCES equipo(id),
  area_id              INTEGER REFERENCES area(id),
  ubicacion            TEXT,
  tecnico_responsable_id INTEGER REFERENCES usuario(id),
  tipo_mantenimiento   TEXT,                        -- codigo catalogo
  tipo_falla           TEXT,
  prioridad            TEXT,
  criticidad           TEXT,
  estado               TEXT NOT NULL DEFAULT 'pendiente_asignacion',
  -- Planificación (sección 27) — independiente del estado operativo
  estado_planificacion TEXT DEFAULT 'sin_evaluar',
  -- Fechas (sección 10.1)
  fecha_creacion       TEXT DEFAULT (datetime('now')),
  fecha_asignacion     TEXT,
  fecha_inicio         TEXT,
  fecha_requerida      TEXT,
  fecha_comprometida   TEXT,
  fecha_programada     TEXT,
  fecha_cierre_solicitado TEXT,
  fecha_cierre_sap     TEXT,
  fecha_conclusion     TEXT,
  -- Estimación (sección 24)
  horas_estimadas      REAL,          -- horas hombre estimadas
  tecnicos_requeridos  INTEGER,
  especialidad         TEXT,
  -- Contenido del trabajo
  trabajo_realizado    TEXT,
  trabajo_pendiente    TEXT,
  condicion_final      TEXT,          -- Operativo | Inoperativo
  -- Bloqueo actual (sección 28)
  motivo_bloqueo       TEXT,
  motivo_bloqueo_comentario TEXT,
  observaciones        TEXT,
  motivo_anulacion     TEXT,
  reabierta_de         INTEGER,       -- id de OT previa si es reapertura
  activo               INTEGER DEFAULT 1,
  created_by           INTEGER REFERENCES usuario(id),
  updated_by           INTEGER REFERENCES usuario(id),
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

-- Técnicos participantes (relación N:M con OT) — sección 10.1
CREATE TABLE IF NOT EXISTS orden_tecnico (
  orden_id   INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  PRIMARY KEY (orden_id, usuario_id)
);

-- ---------------------------------------------------------------------
-- SOLICITUDES DE MATERIALES (sección 13)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_solicitud (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo             TEXT NOT NULL UNIQUE,
  orden_id           INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  -- Solicitud del técnico (13.1)
  descripcion_libre  TEXT NOT NULL,
  cantidad_aprox     REAL,
  unidad             TEXT,
  motivo             TEXT,
  observaciones      TEXT,
  -- Respuesta del Gestor Enlace SAP (13.4)
  codigo_sap         TEXT,
  descripcion_sap    TEXT,
  cantidad_aprobada  REAL,
  numero_reserva     TEXT,
  estado             TEXT NOT NULL DEFAULT 'solicitado',
  gestor_sap_id      INTEGER REFERENCES usuario(id),
  fecha_respuesta    TEXT,
  solicitante_id     INTEGER REFERENCES usuario(id),
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now'))
);

-- Conversación técnico <-> gestor sobre materiales (sección 13.4)
CREATE TABLE IF NOT EXISTS material_comentario (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id   INTEGER NOT NULL REFERENCES material_solicitud(id) ON DELETE CASCADE,
  usuario_id     INTEGER REFERENCES usuario(id),
  texto          TEXT NOT NULL,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- REGISTRO DE TIEMPOS (sección 14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tiempo (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id     INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  tecnico_id   INTEGER REFERENCES usuario(id),
  actividad    TEXT,              -- categoria de tiempo o "Trabajo"
  fecha        TEXT,
  hora_inicio  TEXT,
  hora_fin     TEXT,
  duracion_horas REAL,            -- calculado
  observaciones TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- CIERRES parcial/total (secciones 16 y 17)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cierre (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id          INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL,     -- 'parcial' | 'total'
  -- Comunes
  trabajo_realizado TEXT,
  -- Parcial (16)
  trabajo_pendiente TEXT,
  estado_operativo  TEXT,
  restricciones     TEXT,
  riesgos           TEXT,
  material_pendiente TEXT,
  proxima_accion    TEXT,
  recomendacion     TEXT,
  -- Total (17)
  diagnostico_final TEXT,
  causa             TEXT,
  materiales_utilizados TEXT,
  horas             REAL,
  condicion_final   TEXT,
  solicitado_por    INTEGER REFERENCES usuario(id),
  created_at        TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- FIRMAS del supervisor (sección 18)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS firma (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id      INTEGER NOT NULL REFERENCES orden(id) ON DELETE CASCADE,
  supervisor_id INTEGER REFERENCES usuario(id),
  nombre        TEXT,
  correo        TEXT,
  cargo         TEXT,
  area          TEXT,
  firma_data    TEXT,              -- imagen base64 de la firma manuscrita
  entra_id      TEXT,
  observacion   TEXT,
  codigo_documento TEXT,
  version       INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- ADJUNTOS (fotografías / documentos — sección 20)
-- entidad: 'aviso' | 'orden' | 'material' | 'cierre'
-- categoria: aviso_inicial|diagnostico|material|ejecucion|pruebas|cierre|firma|documento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adjunto (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad     TEXT NOT NULL,
  entidad_id  INTEGER NOT NULL,
  categoria   TEXT,
  nombre      TEXT,
  ruta        TEXT NOT NULL,      -- ruta relativa en /uploads
  mime        TEXT,
  usuario_id  INTEGER REFERENCES usuario(id),
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- HISTORIAL DE ESTADOS / trazabilidad (secciones 36.2, 38)
-- entidad: 'aviso' | 'orden'
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_estado (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad      TEXT NOT NULL,
  entidad_id   INTEGER NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  comentario   TEXT,
  usuario_id   INTEGER REFERENCES usuario(id),
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- AUDITORÍA FUNCIONAL (sección 6, 37, 38)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuario(id),
  accion      TEXT NOT NULL,
  entidad     TEXT,
  entidad_id  INTEGER,
  detalle     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- ALERTAS HORARIAS (sección 15)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerta (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id     INTEGER REFERENCES orden(id) ON DELETE CASCADE,
  tipo         TEXT,               -- 'sin_movimiento' | 'escalada'
  mensaje      TEXT,
  atendida     INTEGER DEFAULT 0,
  respuesta    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- CAPACIDAD DEL TALLER (sección 26) — snapshot editable por área/semana
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capacidad (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id           INTEGER REFERENCES area(id),
  semana            TEXT,          -- 'YYYY-Www'
  tecnicos_activos  INTEGER,
  horas_por_turno   REAL,
  dias_laborables   REAL,
  ausencias_horas   REAL,
  reserva_emergencia_horas REAL,
  capacidad_disponible REAL,       -- calculado / editable
  created_at        TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- CORTES HISTÓRICOS DE BACKLOG (sección 33)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backlog_corte (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha                 TEXT,
  periodo               TEXT,      -- diario | semanal | mensual
  avisos_pendientes     INTEGER,
  ot_pendientes         INTEGER,
  total_trabajos        INTEGER,
  horas_pendientes      REAL,
  capacidad             REAL,
  semanas_backlog       REAL,
  trabajos_criticos     INTEGER,
  trabajos_vencidos     INTEGER,
  esperando_materiales  INTEGER,
  trabajos_ingresados   INTEGER,
  trabajos_concluidos   INTEGER,
  created_at            TEXT DEFAULT (datetime('now'))
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_aviso_estado ON aviso(estado);
CREATE INDEX IF NOT EXISTS idx_orden_estado ON orden(estado);
CREATE INDEX IF NOT EXISTS idx_orden_area ON orden(area_id);
CREATE INDEX IF NOT EXISTS idx_material_orden ON material_solicitud(orden_id);
CREATE INDEX IF NOT EXISTS idx_tiempo_orden ON tiempo(orden_id);
CREATE INDEX IF NOT EXISTS idx_hist_entidad ON historial_estado(entidad, entidad_id);

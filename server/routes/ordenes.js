// =====================================================================
//  Módulo de Órdenes de Trabajo (secciones 10, 11, 15, 27, 28, 38)
// =====================================================================
import { Router } from 'express';
import { all, get, run, tx } from '../db/index.js';
import { requireRole, ROLES } from '../lib/auth.js';
import { nextCodigo, registrarHistorial, auditar, ApiError } from '../lib/helpers.js';

const router = Router();

const SELECT_OT = `
  SELECT o.*, e.codigo AS equipo_codigo, e.descripcion AS equipo_desc,
         ar.nombre AS area, tr.nombre AS tecnico_responsable,
         pr.etiqueta AS prioridad_label, pr.color AS prioridad_color,
         es.etiqueta AS estado_label, es.es_final AS estado_final,
         tm.etiqueta AS tipo_mantenimiento_label,
         mb.etiqueta AS motivo_bloqueo_label,
         ep.etiqueta AS estado_planificacion_label,
         av.codigo AS aviso_codigo
  FROM orden o
  LEFT JOIN equipo e ON e.id = o.equipo_id
  LEFT JOIN area ar ON ar.id = o.area_id
  LEFT JOIN usuario tr ON tr.id = o.tecnico_responsable_id
  LEFT JOIN catalogo pr ON pr.tipo='prioridad' AND pr.codigo=o.prioridad
  LEFT JOIN catalogo es ON es.tipo='estado_ot' AND es.codigo=o.estado
  LEFT JOIN catalogo tm ON tm.tipo='tipo_mantenimiento' AND tm.codigo=o.tipo_mantenimiento
  LEFT JOIN catalogo mb ON mb.tipo='motivo_bloqueo' AND mb.codigo=o.motivo_bloqueo
  LEFT JOIN catalogo ep ON ep.tipo='estado_planificacion' AND ep.codigo=o.estado_planificacion
  LEFT JOIN aviso av ON av.id=o.aviso_id`;

// Horas ejecutadas por OT (suma de registros de tiempo productivo)
function horasEjecutadas(ordenId) {
  const r = get(
    `SELECT COALESCE(SUM(duracion_horas),0) AS h FROM tiempo WHERE orden_id=?`, ordenId,
  );
  return r?.h ?? 0;
}

// --- Listado con filtros (sección 32 reutilizable) ---
router.get('/', (req, res) => {
  const { estado, area_id, prioridad, tecnico_id, q, activas, tipo_mantenimiento } = req.query;
  let sql = SELECT_OT + ' WHERE o.activo = 1';
  const p = [];
  if (estado) { sql += ' AND o.estado = ?'; p.push(estado); }
  if (area_id) { sql += ' AND o.area_id = ?'; p.push(Number(area_id)); }
  if (prioridad) { sql += ' AND o.prioridad = ?'; p.push(prioridad); }
  if (tipo_mantenimiento) { sql += ' AND o.tipo_mantenimiento = ?'; p.push(tipo_mantenimiento); }
  if (tecnico_id) { sql += ' AND o.tecnico_responsable_id = ?'; p.push(Number(tecnico_id)); }
  if (activas === '1') sql += ' AND es.es_final = 0';
  if (activas === '0') sql += ' AND es.es_final = 1'; // concluidas/anuladas = historial
  if (q) {
    sql += ' AND (o.codigo LIKE ? OR o.ot_sap LIKE ? OR e.descripcion LIKE ?)';
    const like = `%${q}%`; p.push(like, like, like);
  }
  sql += ' ORDER BY CASE o.prioridad WHEN \'alta\' THEN 1 WHEN \'media\' THEN 2 ELSE 3 END, o.updated_at DESC';
  const rows = all(sql, ...p);
  for (const o of rows) o.horas_ejecutadas = horasEjecutadas(o.id);
  res.json(rows);
});

// --- Detalle completo ---
router.get('/:id', (req, res, next) => {
  const o = get(SELECT_OT + ' WHERE o.id = ?', Number(req.params.id));
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  o.tecnicos = all(
    `SELECT u.id, u.nombre, u.especialidad FROM orden_tecnico ot
     JOIN usuario u ON u.id = ot.usuario_id WHERE ot.orden_id = ?`, o.id);
  o.materiales = all(
    `SELECT m.*, em.etiqueta AS estado_label FROM material_solicitud m
     LEFT JOIN catalogo em ON em.tipo='estado_material' AND em.codigo=m.estado
     WHERE m.orden_id = ? ORDER BY m.created_at`, o.id);
  o.tiempos = all(
    `SELECT t.*, u.nombre AS tecnico, ct.etiqueta AS actividad_label FROM tiempo t
     LEFT JOIN usuario u ON u.id=t.tecnico_id
     LEFT JOIN catalogo ct ON ct.tipo='categoria_tiempo' AND ct.codigo=t.actividad
     WHERE t.orden_id = ? ORDER BY t.created_at`, o.id);
  o.cierres = all('SELECT * FROM cierre WHERE orden_id = ? ORDER BY created_at', o.id);
  o.firma = get('SELECT * FROM firma WHERE orden_id = ? ORDER BY created_at DESC LIMIT 1', o.id);
  o.historial = all(
    `SELECT h.*, u.nombre AS usuario FROM historial_estado h
     LEFT JOIN usuario u ON u.id=h.usuario_id
     WHERE h.entidad='orden' AND h.entidad_id = ? ORDER BY h.created_at`, o.id);
  o.adjuntos = all("SELECT * FROM adjunto WHERE entidad='orden' AND entidad_id = ?", o.id);
  o.horas_ejecutadas = horasEjecutadas(o.id);
  o.horas_restantes = Math.max(0, (o.horas_estimadas ?? 0) - o.horas_ejecutadas);
  o.desviacion = o.horas_estimadas != null && o.horas_ejecutadas > o.horas_estimadas;
  res.json(o);
});

// --- Crear OT desde un aviso (Gestor Enlace SAP — sección 9/10) ---
router.post('/', requireRole(ROLES.GESTOR_SAP), (req, res, next) => {
  const b = req.body;
  if (!b.aviso_id) return next(new ApiError(400, 'Falta el aviso de origen.'));
  const av = get('SELECT * FROM aviso WHERE id = ?', Number(b.aviso_id));
  if (!av) return next(new ApiError(404, 'Aviso no encontrado.'));
  if (get('SELECT id FROM orden WHERE aviso_id = ?', av.id)) {
    return next(new ApiError(409, 'Este aviso ya tiene una OT (no se duplican trabajos, sección 22.2).'));
  }
  if (b.ot_sap && get('SELECT id FROM orden WHERE ot_sap = ?', b.ot_sap)) {
    return next(new ApiError(409, 'Ese número de OT SAP ya existe (no se duplican, sección 38).'));
  }
  const codigo = nextCodigo('OT', 'orden');
  const result = tx(() => {
    const r = run(
      `INSERT INTO orden
        (codigo, aviso_id, aviso_sap, ot_sap, equipo_id, area_id, ubicacion, tipo_mantenimiento,
         tipo_falla, prioridad, criticidad, estado, estado_planificacion, horas_estimadas,
         tecnicos_requeridos, especialidad, fecha_requerida, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      codigo, av.id, av.aviso_sap ?? b.aviso_sap ?? null, b.ot_sap ?? null,
      av.equipo_id, b.area_id ?? av.area_id, av.ubicacion, b.tipo_mantenimiento ?? 'correctivo',
      b.tipo_falla ?? null, av.prioridad, av.criticidad, 'pendiente_asignacion', 'listo_planificar',
      b.horas_estimadas ?? (av.duracion_estimada ? av.duracion_estimada * (av.tecnicos_estimados || 1) : null),
      b.tecnicos_requeridos ?? av.tecnicos_estimados ?? 1, av.especialidad,
      b.fecha_requerida ?? null, req.user.id, req.user.id,
    );
    const id = Number(r.lastInsertRowid);
    registrarHistorial('orden', id, null, 'pendiente_asignacion', req.user.id, 'OT creada desde aviso ' + av.codigo);
    // El aviso pasa a "OT creada" y se relaciona (sección 22.2: la OT es el registro principal)
    run("UPDATE aviso SET estado='ot_creada', updated_at=datetime('now') WHERE id=?", av.id);
    registrarHistorial('aviso', av.id, av.estado, 'ot_creada', req.user.id, 'OT ' + codigo + ' creada');
    return { id, codigo };
  });
  auditar(req.user.id, 'orden.crear', 'orden', result.id, { codigo, aviso: av.codigo });
  res.status(201).json(result);
});

// --- Editar datos de la OT (Gestor Enlace SAP) ---
router.put('/:id', requireRole(ROLES.GESTOR_SAP), (req, res, next) => {
  const id = Number(req.params.id);
  const b = req.body;
  const o = get('SELECT * FROM orden WHERE id = ?', id);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  // Una OT concluida requiere reapertura autorizada para modificarse (regla crítica 38)
  if (o.estado === 'concluida') {
    return next(new ApiError(409, 'La OT está concluida: requiere reapertura autorizada para modificarse.'));
  }
  // Los números SAP no deben duplicarse (sección 38)
  if (b.ot_sap && b.ot_sap !== o.ot_sap && get('SELECT id FROM orden WHERE ot_sap = ? AND id <> ?', b.ot_sap, id)) {
    return next(new ApiError(409, 'Ese número de OT SAP ya existe en otra orden.'));
  }
  run(
    `UPDATE orden SET ot_sap=COALESCE(?,ot_sap), aviso_sap=COALESCE(?,aviso_sap),
        tipo_mantenimiento=COALESCE(?,tipo_mantenimiento), tipo_falla=COALESCE(?,tipo_falla),
        prioridad=COALESCE(?,prioridad), area_id=COALESCE(?,area_id), ubicacion=COALESCE(?,ubicacion),
        fecha_requerida=COALESCE(?,fecha_requerida), observaciones=COALESCE(?,observaciones),
        updated_by=?, updated_at=datetime('now')
     WHERE id=?`,
    b.ot_sap ?? null, b.aviso_sap ?? null, b.tipo_mantenimiento ?? null, b.tipo_falla ?? null,
    b.prioridad ?? null, b.area_id ?? null, b.ubicacion ?? null, b.fecha_requerida ?? null,
    b.observaciones ?? null, req.user.id, id,
  );
  auditar(req.user.id, 'orden.editar', 'orden', id, b);
  res.json({ ok: true });
});

// --- Asignar técnico responsable y participantes (Gestor Enlace SAP) ---
router.post('/:id/asignar', requireRole(ROLES.GESTOR_SAP), (req, res, next) => {
  const id = Number(req.params.id);
  const { tecnico_responsable_id, participantes, fecha_programada, fecha_comprometida } = req.body;
  const o = get('SELECT * FROM orden WHERE id = ?', id);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  tx(() => {
    run(
      `UPDATE orden SET tecnico_responsable_id=?, fecha_asignacion=datetime('now'),
          fecha_programada=COALESCE(?,fecha_programada), fecha_comprometida=COALESCE(?,fecha_comprometida),
          estado=CASE WHEN estado='pendiente_asignacion' THEN 'asignada' ELSE estado END,
          updated_at=datetime('now') WHERE id=?`,
      tecnico_responsable_id ?? null, fecha_programada ?? null, fecha_comprometida ?? null, id,
    );
    run('DELETE FROM orden_tecnico WHERE orden_id=?', id);
    const lista = new Set([tecnico_responsable_id, ...(participantes || [])].filter(Boolean));
    for (const uid of lista) run('INSERT OR IGNORE INTO orden_tecnico (orden_id, usuario_id) VALUES (?,?)', id, uid);
    if (o.estado === 'pendiente_asignacion') {
      registrarHistorial('orden', id, o.estado, 'asignada', req.user.id, 'Técnico asignado');
    }
  });
  auditar(req.user.id, 'orden.asignar', 'orden', id, { tecnico_responsable_id });
  res.json({ ok: true });
});

// --- Cambiar estado operativo (sección 10.3) ---
router.post('/:id/estado', (req, res, next) => {
  const id = Number(req.params.id);
  const { estado, comentario, motivo_bloqueo } = req.body;
  const o = get('SELECT * FROM orden WHERE id = ?', id);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  const cat = get("SELECT * FROM catalogo WHERE tipo='estado_ot' AND codigo=?", estado);
  if (!cat) return next(new ApiError(400, 'Estado de OT inválido.'));
  // El técnico no puede concluir definitivamente (regla crítica 38)
  if (estado === 'concluida' && req.user.rol === ROLES.TECNICO) {
    return next(new ApiError(403, 'El técnico no puede concluir la OT; requiere validación y firma del supervisor.'));
  }
  const bloqueo = ['esperando_materiales', 'trabajo_detenido', 'pausada'].includes(estado) ? (motivo_bloqueo ?? o.motivo_bloqueo) : null;
  run(
    `UPDATE orden SET estado=?, motivo_bloqueo=?, motivo_bloqueo_comentario=?,
        fecha_inicio=CASE WHEN fecha_inicio IS NULL AND ?='en_ejecucion' THEN datetime('now') ELSE fecha_inicio END,
        updated_at=datetime('now') WHERE id=?`,
    estado, bloqueo, comentario ?? o.motivo_bloqueo_comentario, estado, id,
  );
  registrarHistorial('orden', id, o.estado, estado, req.user.id, comentario);
  // Cada cambio actualiza el aviso relacionado (sección 10.3)
  if (o.aviso_id) run("UPDATE aviso SET updated_at=datetime('now') WHERE id=?", o.aviso_id);
  auditar(req.user.id, 'orden.estado', 'orden', id, { de: o.estado, a: estado });
  res.json({ ok: true, estado });
});

// --- Estado / datos de planificación (Planificador — sección 27) ---
router.post('/:id/planificacion', requireRole(ROLES.PLANIFICADOR), (req, res, next) => {
  const id = Number(req.params.id);
  const b = req.body;
  const o = get('SELECT * FROM orden WHERE id = ?', id);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  run(
    `UPDATE orden SET estado_planificacion=COALESCE(?,estado_planificacion),
        horas_estimadas=COALESCE(?,horas_estimadas), tecnicos_requeridos=COALESCE(?,tecnicos_requeridos),
        especialidad=COALESCE(?,especialidad), fecha_programada=COALESCE(?,fecha_programada),
        fecha_comprometida=COALESCE(?,fecha_comprometida), fecha_requerida=COALESCE(?,fecha_requerida),
        prioridad=COALESCE(?,prioridad), updated_at=datetime('now') WHERE id=?`,
    b.estado_planificacion ?? null, b.horas_estimadas ?? null, b.tecnicos_requeridos ?? null,
    b.especialidad ?? null, b.fecha_programada ?? null, b.fecha_comprometida ?? null,
    b.fecha_requerida ?? null, b.prioridad ?? null, id,
  );
  auditar(req.user.id, 'orden.planificacion', 'orden', id, b);
  res.json({ ok: true });
});

// --- Reabrir OT concluida (Planificador, quien valida y firma — regla crítica 38) ---
router.post('/:id/reabrir', requireRole(ROLES.PLANIFICADOR), (req, res, next) => {
  const id = Number(req.params.id);
  const { comentario } = req.body;
  const o = get('SELECT * FROM orden WHERE id = ?', id);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  if (o.estado !== 'concluida') return next(new ApiError(409, 'Solo se pueden reabrir OT concluidas.'));
  run("UPDATE orden SET estado='reabierta', fecha_conclusion=NULL, updated_at=datetime('now') WHERE id=?", id);
  registrarHistorial('orden', id, 'concluida', 'reabierta', req.user.id, comentario || 'OT reabierta');
  auditar(req.user.id, 'orden.reabrir', 'orden', id, { comentario });
  res.json({ ok: true });
});

// --- Mis OT (técnico) ---
router.get('/mias/lista', (req, res) => {
  const rows = all(
    SELECT_OT + ` WHERE o.activo=1 AND es.es_final=0 AND (o.tecnico_responsable_id=?
       OR EXISTS (SELECT 1 FROM orden_tecnico ot WHERE ot.orden_id=o.id AND ot.usuario_id=?))
     ORDER BY o.updated_at DESC`,
    req.user.id, req.user.id,
  );
  res.json(rows);
});

export default router;

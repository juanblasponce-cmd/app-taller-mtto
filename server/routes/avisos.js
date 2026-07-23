// =====================================================================
//  Módulo de Avisos (secciones 7, 8) + registro manual SAP (sección 9)
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole, ROLES } from '../lib/auth.js';
import { nextCodigo, registrarHistorial, auditar, ApiError } from '../lib/helpers.js';

const router = Router();

const SELECT_AVISO = `
  SELECT av.*, e.codigo AS equipo_codigo, e.descripcion AS equipo_desc,
         ar.nombre AS area, u.nombre AS solicitante,
         pa.etiqueta AS prioridad_label, pa.color AS prioridad_color,
         ea.etiqueta AS estado_label
  FROM aviso av
  LEFT JOIN equipo e ON e.id = av.equipo_id
  LEFT JOIN area ar ON ar.id = av.area_id
  LEFT JOIN usuario u ON u.id = av.solicitante_id
  LEFT JOIN catalogo pa ON pa.tipo='prioridad' AND pa.codigo = av.prioridad
  LEFT JOIN catalogo ea ON ea.tipo='estado_aviso' AND ea.codigo = av.estado`;

// --- Listado con filtros ---
router.get('/', (req, res) => {
  const { estado, area_id, prioridad, q, solicitante_id } = req.query;
  let sql = SELECT_AVISO + ' WHERE av.activo = 1';
  const p = [];
  if (estado) { sql += ' AND av.estado = ?'; p.push(estado); }
  if (area_id) { sql += ' AND av.area_id = ?'; p.push(Number(area_id)); }
  if (prioridad) { sql += ' AND av.prioridad = ?'; p.push(prioridad); }
  if (solicitante_id) { sql += ' AND av.solicitante_id = ?'; p.push(Number(solicitante_id)); }
  if (q) {
    sql += ' AND (av.codigo LIKE ? OR av.sintoma LIKE ? OR av.descripcion LIKE ?)';
    const like = `%${q}%`; p.push(like, like, like);
  }
  sql += ' ORDER BY av.created_at DESC';
  res.json(all(sql, ...p));
});

// --- Detalle ---
router.get('/:id', (req, res, next) => {
  const av = get(SELECT_AVISO + ' WHERE av.id = ?', Number(req.params.id));
  if (!av) return next(new ApiError(404, 'Aviso no encontrado.'));
  av.historial = all(
    `SELECT h.*, u.nombre AS usuario FROM historial_estado h
     LEFT JOIN usuario u ON u.id = h.usuario_id
     WHERE h.entidad='aviso' AND h.entidad_id = ? ORDER BY h.created_at`,
    av.id,
  );
  av.adjuntos = all("SELECT * FROM adjunto WHERE entidad='aviso' AND entidad_id = ?", av.id);
  av.orden = get('SELECT id, codigo, estado FROM orden WHERE aviso_id = ?', av.id);
  res.json(av);
});

// --- Crear aviso (solicitante) ---
router.post('/', requireRole(ROLES.SOLICITANTE, ROLES.SUPERVISOR, ROLES.PLANIFICADOR), (req, res) => {
  const b = req.body;
  const codigo = nextCodigo('AV', 'aviso');
  const estado = b.enviar ? 'pendiente_validacion' : 'borrador';
  const r = run(
    `INSERT INTO aviso
      (codigo, equipo_id, equipo_desconocido, centro_coste, area_id, ubicacion, sintoma,
       descripcion, tipo_aviso, prioridad, criticidad, estado, solicitante_id, geo_lat, geo_lng,
       duracion_estimada, tecnicos_estimados, especialidad, complejidad, created_by, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    codigo, b.equipo_id ?? null, b.equipo_desconocido ? 1 : 0, b.centro_coste ?? null,
    b.area_id ?? null, b.ubicacion ?? null, b.sintoma ?? null, b.descripcion ?? null,
    b.tipo_aviso ?? null, b.prioridad ?? 'media', b.criticidad ?? null, estado,
    req.user.id, b.geo_lat ?? null, b.geo_lng ?? null, b.duracion_estimada ?? null,
    b.tecnicos_estimados ?? null, b.especialidad ?? null, b.complejidad ?? null,
    req.user.id, req.user.id,
  );
  const id = Number(r.lastInsertRowid);
  registrarHistorial('aviso', id, null, estado, req.user.id, 'Aviso creado');
  auditar(req.user.id, 'aviso.crear', 'aviso', id, { codigo, estado });
  res.status(201).json({ id, codigo });
});

// --- Editar aviso (antes del envío o para responder observaciones) ---
router.put('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const av = get('SELECT * FROM aviso WHERE id = ?', id);
  if (!av) return next(new ApiError(404, 'Aviso no encontrado.'));
  if (!['borrador', 'observado'].includes(av.estado) && req.user.rol !== ROLES.ADMIN) {
    return next(new ApiError(409, 'El aviso solo puede editarse en estado Borrador u Observado.'));
  }
  const b = req.body;
  run(
    `UPDATE aviso SET equipo_id=?, equipo_desconocido=?, centro_coste=?, area_id=?, ubicacion=?,
        sintoma=?, descripcion=?, tipo_aviso=?, prioridad=?, criticidad=?, geo_lat=?, geo_lng=?,
        duracion_estimada=?, tecnicos_estimados=?, especialidad=?, complejidad=?,
        updated_by=?, updated_at=datetime('now')
     WHERE id=?`,
    b.equipo_id ?? av.equipo_id, b.equipo_desconocido ? 1 : 0, b.centro_coste ?? av.centro_coste,
    b.area_id ?? av.area_id, b.ubicacion ?? av.ubicacion, b.sintoma ?? av.sintoma,
    b.descripcion ?? av.descripcion, b.tipo_aviso ?? av.tipo_aviso, b.prioridad ?? av.prioridad,
    b.criticidad ?? av.criticidad, b.geo_lat ?? av.geo_lat, b.geo_lng ?? av.geo_lng,
    b.duracion_estimada ?? av.duracion_estimada, b.tecnicos_estimados ?? av.tecnicos_estimados,
    b.especialidad ?? av.especialidad, b.complejidad ?? av.complejidad, req.user.id, id,
  );
  auditar(req.user.id, 'aviso.editar', 'aviso', id);
  res.json({ ok: true });
});

// --- Enviar a validación ---
router.post('/:id/enviar', (req, res, next) => {
  const id = Number(req.params.id);
  const av = get('SELECT * FROM aviso WHERE id = ?', id);
  if (!av) return next(new ApiError(404, 'Aviso no encontrado.'));
  if (!['borrador', 'observado'].includes(av.estado)) {
    return next(new ApiError(409, 'Solo se pueden enviar avisos en Borrador u Observado.'));
  }
  run("UPDATE aviso SET estado='pendiente_validacion', updated_at=datetime('now') WHERE id=?", id);
  registrarHistorial('aviso', id, av.estado, 'pendiente_validacion', req.user.id, 'Enviado a validación');
  auditar(req.user.id, 'aviso.enviar', 'aviso', id);
  res.json({ ok: true });
});

// --- Validación (sección 8): aprobar / rechazar / observar ---
router.post('/:id/validar', requireRole(ROLES.SUPERVISOR, ROLES.PLANIFICADOR), (req, res, next) => {
  const id = Number(req.params.id);
  const { accion, comentario, prioridad, area_id, tipo_aviso, equipo_id } = req.body;
  const av = get('SELECT * FROM aviso WHERE id = ?', id);
  if (!av) return next(new ApiError(404, 'Aviso no encontrado.'));
  if (!['pendiente_validacion', 'observado'].includes(av.estado)) {
    return next(new ApiError(409, 'El aviso no está pendiente de validación.'));
  }
  // El validador puede corregir equipo, área, prioridad, tipo (sección 8)
  run(
    `UPDATE aviso SET prioridad=COALESCE(?,prioridad), area_id=COALESCE(?,area_id),
        tipo_aviso=COALESCE(?,tipo_aviso), equipo_id=COALESCE(?,equipo_id) WHERE id=?`,
    prioridad ?? null, area_id ?? null, tipo_aviso ?? null, equipo_id ?? null, id,
  );

  let nuevo;
  if (accion === 'aprobar') nuevo = 'validado';
  else if (accion === 'rechazar') nuevo = 'rechazado';
  else if (accion === 'observar') nuevo = 'observado';
  else return next(new ApiError(400, 'Acción inválida (aprobar|rechazar|observar).'));

  const extra = nuevo === 'validado'
    ? ", fecha_aprobacion=datetime('now'), estado='pendiente_registro_sap'"
    : `, estado='${nuevo}'`;
  // Al aprobar: pasa a bandeja SAP (pendiente_registro_sap) y se notifica al Gestor Enlace SAP
  run(`UPDATE aviso SET observaciones=?${extra}, updated_at=datetime('now') WHERE id=?`,
    comentario ?? null, id);

  const estadoFinal = nuevo === 'validado' ? 'pendiente_registro_sap' : nuevo;
  registrarHistorial('aviso', id, av.estado, estadoFinal, req.user.id, comentario || `Validación: ${accion}`);
  auditar(req.user.id, `aviso.${accion}`, 'aviso', id, { comentario });
  res.json({ ok: true, estado: estadoFinal });
});

// --- Registro manual en SAP (Gestor Enlace SAP — sección 9) ---
router.post('/:id/registrar-sap', requireRole(ROLES.GESTOR_SAP), (req, res, next) => {
  const id = Number(req.params.id);
  const { aviso_sap } = req.body;
  if (!aviso_sap) return next(new ApiError(400, 'Falta el número de aviso SAP.'));
  const av = get('SELECT * FROM aviso WHERE id = ?', id);
  if (!av) return next(new ApiError(404, 'Aviso no encontrado.'));
  // Los números SAP no deben duplicarse (sección 9 / regla crítica 38)
  if (get('SELECT id FROM aviso WHERE aviso_sap = ? AND id <> ?', aviso_sap, id)) {
    return next(new ApiError(409, 'Ese número de aviso SAP ya está registrado en otro aviso.'));
  }
  run(
    `UPDATE aviso SET aviso_sap=?, fecha_registro_sap=datetime('now'), gestor_sap_id=?,
        estado='pendiente_creacion_ot', updated_at=datetime('now') WHERE id=?`,
    aviso_sap, req.user.id, id,
  );
  registrarHistorial('aviso', id, av.estado, 'pendiente_creacion_ot', req.user.id, `Aviso SAP ${aviso_sap} registrado`);
  auditar(req.user.id, 'aviso.registrar_sap', 'aviso', id, { aviso_sap });
  res.json({ ok: true });
});

// --- Bandeja SAP: avisos validados pendientes de registro/OT ---
router.get('/bandeja/sap', requireRole(ROLES.GESTOR_SAP), (req, res) => {
  res.json(all(
    SELECT_AVISO + ` WHERE av.activo=1 AND av.estado IN ('pendiente_registro_sap','pendiente_creacion_ot')
     ORDER BY av.fecha_aprobacion`,
  ));
});

export default router;

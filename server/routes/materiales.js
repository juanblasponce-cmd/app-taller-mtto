// =====================================================================
//  Módulo de Materiales (sección 13). Solicitud del técnico +
//  gestión y feedback del Gestor Enlace SAP (proceso manual).
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole, ROLES } from '../lib/auth.js';
import { nextCodigo, auditar, ApiError } from '../lib/helpers.js';

const router = Router();

// Bandeja del Gestor Enlace SAP: solicitudes que requieren atención
router.get('/bandeja', requireRole(ROLES.GESTOR_SAP), (req, res) => {
  res.json(all(
    `SELECT m.*, o.codigo AS ot_codigo, em.etiqueta AS estado_label, u.nombre AS solicitante
     FROM material_solicitud m
     JOIN orden o ON o.id=m.orden_id
     LEFT JOIN catalogo em ON em.tipo='estado_material' AND em.codigo=m.estado
     LEFT JOIN usuario u ON u.id=m.solicitante_id
     WHERE m.estado IN ('solicitado','en_revision')
     ORDER BY m.created_at`,
  ));
});

// Detalle de una solicitud con su conversación
router.get('/:id', (req, res, next) => {
  const m = get(
    `SELECT m.*, o.codigo AS ot_codigo, em.etiqueta AS estado_label FROM material_solicitud m
     JOIN orden o ON o.id=m.orden_id
     LEFT JOIN catalogo em ON em.tipo='estado_material' AND em.codigo=m.estado WHERE m.id=?`,
    Number(req.params.id),
  );
  if (!m) return next(new ApiError(404, 'Solicitud no encontrada.'));
  m.comentarios = all(
    `SELECT c.*, u.nombre AS usuario, u.rol FROM material_comentario c
     LEFT JOIN usuario u ON u.id=c.usuario_id WHERE c.solicitud_id=? ORDER BY c.created_at`,
    m.id,
  );
  res.json(m);
});

// Crear solicitud (técnico — sección 13.1: sin validar código/stock inicialmente)
router.post('/', requireRole(ROLES.TECNICO, ROLES.SUPERVISOR), (req, res, next) => {
  const b = req.body;
  if (!b.orden_id || !b.descripcion_libre) return next(new ApiError(400, 'Faltan OT y descripción.'));
  const codigo = nextCodigo('MT', 'material_solicitud');
  const r = run(
    `INSERT INTO material_solicitud
      (codigo, orden_id, descripcion_libre, cantidad_aprox, unidad, motivo, observaciones,
       estado, solicitante_id) VALUES (?,?,?,?,?,?,?, 'solicitado', ?)`,
    codigo, b.orden_id, b.descripcion_libre, b.cantidad_aprox ?? null, b.unidad ?? null,
    b.motivo ?? null, b.observaciones ?? null, req.user.id,
  );
  auditar(req.user.id, 'material.solicitar', 'material_solicitud', Number(r.lastInsertRowid), { codigo });
  res.status(201).json({ id: Number(r.lastInsertRowid), codigo });
});

// Gestión SAP: actualizar estado, código real, reserva (sección 13.4)
router.put('/:id', requireRole(ROLES.GESTOR_SAP), (req, res, next) => {
  const id = Number(req.params.id);
  const b = req.body;
  const m = get('SELECT * FROM material_solicitud WHERE id=?', id);
  if (!m) return next(new ApiError(404, 'Solicitud no encontrada.'));
  run(
    `UPDATE material_solicitud SET codigo_sap=?, descripcion_sap=?, cantidad_aprobada=?,
        numero_reserva=?, estado=COALESCE(?,estado), gestor_sap_id=?, fecha_respuesta=datetime('now'),
        updated_at=datetime('now') WHERE id=?`,
    b.codigo_sap ?? m.codigo_sap, b.descripcion_sap ?? m.descripcion_sap,
    b.cantidad_aprobada ?? m.cantidad_aprobada, b.numero_reserva ?? m.numero_reserva,
    b.estado ?? null, req.user.id, id,
  );
  auditar(req.user.id, 'material.gestionar', 'material_solicitud', id, { estado: b.estado });
  res.json({ ok: true });
});

// Conversación técnico <-> gestor (sección 13.4)
router.post('/:id/comentario', (req, res, next) => {
  const id = Number(req.params.id);
  const { texto } = req.body;
  if (!texto) return next(new ApiError(400, 'Falta el texto.'));
  if (!get('SELECT id FROM material_solicitud WHERE id=?', id)) {
    return next(new ApiError(404, 'Solicitud no encontrada.'));
  }
  run('INSERT INTO material_comentario (solicitud_id, usuario_id, texto) VALUES (?,?,?)', id, req.user.id, texto);
  res.status(201).json({ ok: true });
});

export default router;

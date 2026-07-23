// =====================================================================
//  Cierre parcial/total (16, 17), registro SAP de horas y
//  validación + firma del Planificador (18).
// =====================================================================
import { Router } from 'express';
import { all, get, run, tx } from '../db/index.js';
import { requireRole, ROLES } from '../lib/auth.js';
import { registrarHistorial, auditar, ApiError, nextCodigo } from '../lib/helpers.js';

const router = Router();

// --- El técnico solicita cierre (parcial o total) ---
router.post('/solicitar', requireRole(ROLES.TECNICO), (req, res, next) => {
  const b = req.body;
  const o = get('SELECT * FROM orden WHERE id=?', Number(b.orden_id));
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  if (!['parcial', 'total'].includes(b.tipo)) return next(new ApiError(400, 'Tipo de cierre inválido.'));

  // Cierre parcial (16): obligatorio trabajo realizado y pendiente
  if (b.tipo === 'parcial' && (!b.trabajo_realizado || !b.trabajo_pendiente)) {
    return next(new ApiError(400, 'El cierre parcial requiere trabajo realizado y trabajo pendiente.'));
  }
  // Cierre total (17): diagnóstico y trabajo realizado
  if (b.tipo === 'total' && !b.trabajo_realizado) {
    return next(new ApiError(400, 'El cierre total requiere el trabajo realizado.'));
  }

  const nuevoEstado = b.tipo === 'parcial' ? 'cierre_parcial_solicitado' : 'cierre_total_solicitado';
  tx(() => {
    run(
      `INSERT INTO cierre
        (orden_id, tipo, trabajo_realizado, trabajo_pendiente, estado_operativo, restricciones,
         riesgos, material_pendiente, proxima_accion, recomendacion, diagnostico_final, causa,
         materiales_utilizados, horas, condicion_final, solicitado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      o.id, b.tipo, b.trabajo_realizado ?? null, b.trabajo_pendiente ?? null, b.estado_operativo ?? null,
      b.restricciones ?? null, b.riesgos ?? null, b.material_pendiente ?? null, b.proxima_accion ?? null,
      b.recomendacion ?? null, b.diagnostico_final ?? null, b.causa ?? null, b.materiales_utilizados ?? null,
      b.horas ?? null, b.condicion_final ?? null, req.user.id,
    );
    run(
      `UPDATE orden SET estado=?, fecha_cierre_solicitado=datetime('now'),
          trabajo_realizado=COALESCE(?,trabajo_realizado), trabajo_pendiente=?,
          condicion_final=COALESCE(?,condicion_final), updated_at=datetime('now') WHERE id=?`,
      nuevoEstado, b.trabajo_realizado ?? null, b.trabajo_pendiente ?? null, b.condicion_final ?? null, o.id,
    );
    registrarHistorial('orden', o.id, o.estado, nuevoEstado, req.user.id, `Cierre ${b.tipo} solicitado`);
  });
  auditar(req.user.id, `cierre.solicitar_${b.tipo}`, 'orden', o.id);
  res.status(201).json({ ok: true, estado: nuevoEstado });
});

// --- Gestor Enlace SAP registra horas/materiales y cierra en SAP (solo total) ---
router.post('/:ordenId/sap', requireRole(ROLES.GESTOR_SAP), (req, res, next) => {
  const ordenId = Number(req.params.ordenId);
  const o = get('SELECT * FROM orden WHERE id=?', ordenId);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));
  if (o.estado !== 'cierre_total_solicitado') {
    return next(new ApiError(409, 'La OT no tiene un cierre total solicitado.'));
  }
  run(
    `UPDATE orden SET fecha_cierre_sap=datetime('now'), estado='cerrada_sap_pendiente_conclusion',
        updated_at=datetime('now') WHERE id=?`, ordenId,
  );
  registrarHistorial('orden', ordenId, o.estado, 'cerrada_sap_pendiente_conclusion', req.user.id,
    'Horas y cierre registrados en SAP');
  auditar(req.user.id, 'cierre.sap', 'orden', ordenId);
  res.json({ ok: true });
});

// --- El Planificador valida y firma (sección 18) → concluye la OT / confirma parcial ---
router.post('/:ordenId/firmar', requireRole(ROLES.PLANIFICADOR), (req, res, next) => {
  const ordenId = Number(req.params.ordenId);
  const b = req.body;
  const o = get('SELECT * FROM orden WHERE id=?', ordenId);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));

  const esParcial = o.estado === 'cierre_parcial_solicitado';
  const esTotal = o.estado === 'cerrada_sap_pendiente_conclusion' || o.estado === 'cierre_total_solicitado';
  if (!esParcial && !esTotal) {
    return next(new ApiError(409, 'La OT no está pendiente de validación/firma.'));
  }
  if (!b.firma_data) return next(new ApiError(400, 'Falta la firma manuscrita.'));

  const version = (get('SELECT COUNT(*) AS n FROM firma WHERE orden_id=?', ordenId).n) + 1;
  const codigoDoc = `${o.codigo}_V${String(version).padStart(2, '0')}`;

  tx(() => {
    run(
      `INSERT INTO firma
        (orden_id, supervisor_id, nombre, correo, cargo, area, firma_data, entra_id,
         observacion, codigo_documento, version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ordenId, req.user.id, req.user.nombre, req.user.correo, req.user.cargo,
      req.user.area_id, b.firma_data, req.user.entra_id, b.observacion ?? null, codigoDoc, version,
    );
    if (esParcial) {
      // Cierre parcial confirmado: permanece en backlog si hay pendiente (sección 16/38)
      const nuevo = 'cierre_parcial';
      run("UPDATE orden SET estado=?, updated_at=datetime('now') WHERE id=?", nuevo, ordenId);
      registrarHistorial('orden', ordenId, o.estado, nuevo, req.user.id, 'Cierre parcial validado y firmado');
      if (o.aviso_id) run("UPDATE aviso SET estado='cierre_parcial', updated_at=datetime('now') WHERE id=?", o.aviso_id);
    } else {
      // Cierre total: OT concluida, sale del backlog activo (sección 17/38)
      run("UPDATE orden SET estado='concluida', fecha_conclusion=datetime('now'), updated_at=datetime('now') WHERE id=?", ordenId);
      registrarHistorial('orden', ordenId, o.estado, 'concluida', req.user.id, 'Validada y firmada. OT concluida.');
      if (o.aviso_id) run("UPDATE aviso SET estado='concluido', updated_at=datetime('now') WHERE id=?", o.aviso_id);
    }
  });
  auditar(req.user.id, 'cierre.firmar', 'orden', ordenId, { codigoDoc, tipo: esParcial ? 'parcial' : 'total' });
  res.json({ ok: true, estado: esParcial ? 'cierre_parcial' : 'concluida', codigo_documento: codigoDoc });
});

// --- OT pendientes de firma (para el Planificador) ---
router.get('/pendientes-firma', requireRole(ROLES.PLANIFICADOR), (req, res) => {
  res.json(all(
    `SELECT o.id, o.codigo, o.estado, e.descripcion AS equipo, ar.nombre AS area
     FROM orden o LEFT JOIN equipo e ON e.id=o.equipo_id LEFT JOIN area ar ON ar.id=o.area_id
     WHERE o.estado IN ('cierre_parcial_solicitado','cierre_total_solicitado','cerrada_sap_pendiente_conclusion')
     ORDER BY o.fecha_cierre_solicitado`,
  ));
});

export default router;

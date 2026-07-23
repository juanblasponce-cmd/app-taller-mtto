// =====================================================================
//  Alertas automáticas (sección 15) — consulta y respuesta
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { ejecutarFlujoAlertas } from '../lib/alertas.js';
import { auditar, ApiError } from '../lib/helpers.js';

const router = Router();

// Alertas del usuario (sus OT) o todas si es supervisor/admin
router.get('/', (req, res) => {
  const esGestion = ['administrador', 'supervisor', 'planificador'].includes(req.user.rol);
  let sql = `SELECT a.*, o.codigo AS ot_codigo, o.tecnico_responsable_id FROM alerta a
             JOIN orden o ON o.id=a.orden_id WHERE a.atendida=0`;
  const p = [];
  if (!esGestion) {
    sql += ` AND (o.tecnico_responsable_id=? OR EXISTS
      (SELECT 1 FROM orden_tecnico ot WHERE ot.orden_id=o.id AND ot.usuario_id=?))`;
    p.push(req.user.id, req.user.id);
  }
  sql += ' ORDER BY a.created_at DESC';
  res.json(all(sql, ...p));
});

// Responder alerta (opciones rápidas — sección 15)
router.post('/:id/responder', (req, res, next) => {
  const id = Number(req.params.id);
  const { respuesta, nuevo_estado, comentario } = req.body;
  const a = get('SELECT * FROM alerta WHERE id=?', id);
  if (!a) return next(new ApiError(404, 'Alerta no encontrada.'));
  run("UPDATE alerta SET atendida=1, respuesta=? WHERE id=?", respuesta ?? comentario ?? 'Atendida', id);
  // Opcionalmente cambia el estado de la OT
  if (nuevo_estado) {
    run("UPDATE orden SET estado=?, updated_at=datetime('now') WHERE id=?", nuevo_estado, a.orden_id);
  } else {
    run("UPDATE orden SET updated_at=datetime('now') WHERE id=?", a.orden_id);
  }
  auditar(req.user.id, 'alerta.responder', 'orden', a.orden_id, { respuesta, nuevo_estado });
  res.json({ ok: true });
});

// Ejecutar el flujo manualmente (para pruebas)
router.post('/ejecutar', (req, res) => {
  ejecutarFlujoAlertas();
  res.json({ ok: true });
});

export default router;

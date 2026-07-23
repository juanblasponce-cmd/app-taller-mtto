// =====================================================================
//  Registro de tiempos (sección 14)
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole, ROLES } from '../lib/auth.js';
import { auditar, ApiError } from '../lib/helpers.js';

const router = Router();

/** Calcula duración en horas a partir de hora_inicio/hora_fin (HH:MM). */
function calcDuracion(inicio, fin) {
  if (!inicio || !fin) return null;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // cruce de medianoche
  return Math.round((mins / 60) * 100) / 100;
}

// Registrar tiempo (técnico)
router.post('/', requireRole(ROLES.TECNICO), (req, res, next) => {
  const b = req.body;
  if (!b.orden_id) return next(new ApiError(400, 'Falta la OT.'));
  const duracion = b.duracion_horas ?? calcDuracion(b.hora_inicio, b.hora_fin);
  const r = run(
    `INSERT INTO tiempo (orden_id, tecnico_id, actividad, fecha, hora_inicio, hora_fin,
        duracion_horas, observaciones) VALUES (?,?,?,?,?,?,?,?)`,
    b.orden_id, b.tecnico_id ?? req.user.id, b.actividad ?? 'trabajo',
    b.fecha ?? new Date().toISOString().slice(0, 10), b.hora_inicio ?? null, b.hora_fin ?? null,
    duracion, b.observaciones ?? null,
  );
  run("UPDATE orden SET updated_at=datetime('now') WHERE id=?", b.orden_id);
  auditar(req.user.id, 'tiempo.registrar', 'orden', b.orden_id, { duracion });
  res.status(201).json({ id: Number(r.lastInsertRowid), duracion_horas: duracion });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM tiempo WHERE id=?', Number(req.params.id));
  res.json({ ok: true });
});

// Resumen de tiempos de una OT (sección 14: cálculos)
router.get('/orden/:ordenId/resumen', (req, res) => {
  const ordenId = Number(req.params.ordenId);
  const porActividad = all(
    `SELECT t.actividad, ct.etiqueta AS actividad_label, SUM(t.duracion_horas) AS horas
     FROM tiempo t LEFT JOIN catalogo ct ON ct.tipo='categoria_tiempo' AND ct.codigo=t.actividad
     WHERE t.orden_id=? GROUP BY t.actividad`, ordenId);
  const porTecnico = all(
    `SELECT u.nombre AS tecnico, SUM(t.duracion_horas) AS horas FROM tiempo t
     LEFT JOIN usuario u ON u.id=t.tecnico_id WHERE t.orden_id=? GROUP BY t.tecnico_id`, ordenId);
  const total = get('SELECT COALESCE(SUM(duracion_horas),0) AS h FROM tiempo WHERE orden_id=?', ordenId).h;
  const productivo = get(
    "SELECT COALESCE(SUM(duracion_horas),0) AS h FROM tiempo WHERE orden_id=? AND actividad='trabajo'", ordenId).h;
  res.json({
    por_actividad: porActividad, por_tecnico: porTecnico,
    total_horas: total, tiempo_productivo: productivo, tiempo_espera: total - productivo,
  });
});

export default router;

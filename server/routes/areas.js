// =====================================================================
//  Áreas y zonas del taller (sección 12)
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole } from '../lib/auth.js';
import { auditar } from '../lib/helpers.js';

const router = Router();

router.get('/', (req, res) => {
  const areas = all(
    `SELECT a.*, s.nombre AS supervisor,
       (SELECT COUNT(*) FROM orden o JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado
          WHERE o.area_id = a.id AND c.es_final = 0) AS ot_activas,
       (SELECT COUNT(*) FROM orden o WHERE o.area_id = a.id
          AND o.fecha_requerida IS NOT NULL AND o.fecha_requerida < datetime('now')
          AND o.estado NOT IN ('concluida','anulada')) AS ot_vencidas
     FROM area a LEFT JOIN usuario s ON s.id = a.supervisor_id
     WHERE a.activo = 1 ORDER BY a.nombre`,
  );
  res.json(areas);
});

router.get('/:id', (req, res) => {
  const a = get('SELECT * FROM area WHERE id = ?', Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'No encontrada.' });
  res.json(a);
});

router.post('/', requireRole(), (req, res) => {
  const { nombre, supervisor_id, capacidad_semanal_horas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre.' });
  const r = run(
    'INSERT INTO area (nombre, supervisor_id, capacidad_semanal_horas) VALUES (?,?,?)',
    nombre, supervisor_id ?? null, capacidad_semanal_horas ?? 0,
  );
  auditar(req.user.id, 'area.crear', 'area', Number(r.lastInsertRowid), { nombre });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

router.put('/:id', requireRole(), (req, res) => {
  const { nombre, supervisor_id, capacidad_semanal_horas, activo } = req.body;
  run(
    `UPDATE area SET nombre = COALESCE(?, nombre), supervisor_id = ?,
        capacidad_semanal_horas = COALESCE(?, capacidad_semanal_horas),
        activo = COALESCE(?, activo), updated_at = datetime('now') WHERE id = ?`,
    nombre ?? null, supervisor_id ?? null, capacidad_semanal_horas ?? null, activo ?? null,
    Number(req.params.id),
  );
  auditar(req.user.id, 'area.actualizar', 'area', Number(req.params.id));
  res.json({ ok: true });
});

export default router;

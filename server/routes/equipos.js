// =====================================================================
//  Catálogo de equipos (sección 21)
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole } from '../lib/auth.js';
import { auditar } from '../lib/helpers.js';

const router = Router();

router.get('/', (req, res) => {
  const { q, area_id } = req.query;
  let sql = `SELECT e.*, a.nombre AS area FROM equipo e LEFT JOIN area a ON a.id = e.area_id WHERE e.activo = 1`;
  const p = [];
  if (q) {
    sql += ' AND (e.codigo LIKE ? OR e.descripcion LIKE ? OR e.modelo LIKE ? OR e.ubicacion LIKE ?)';
    const like = `%${q}%`; p.push(like, like, like, like);
  }
  if (area_id) { sql += ' AND e.area_id = ?'; p.push(Number(area_id)); }
  sql += ' ORDER BY e.codigo';
  res.json(all(sql, ...p));
});

router.get('/:id', (req, res) => {
  const e = get('SELECT e.*, a.nombre AS area FROM equipo e LEFT JOIN area a ON a.id = e.area_id WHERE e.id = ?', Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'No encontrado.' });
  // OT activas del equipo (sección 21)
  e.ot_activas = all(
    `SELECT o.id, o.codigo, o.estado, o.prioridad FROM orden o
     JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado
     WHERE o.equipo_id = ? AND c.es_final = 0 ORDER BY o.created_at DESC`,
    Number(req.params.id),
  );
  res.json(e);
});

router.post('/', requireRole('supervisor', 'planificador', 'gestor_sap'), (req, res) => {
  const { codigo, descripcion, modelo, ubicacion, area_id, criticidad } = req.body;
  if (!codigo || !descripcion) return res.status(400).json({ error: 'Faltan código y descripción.' });
  if (get('SELECT id FROM equipo WHERE codigo = ?', codigo)) {
    return res.status(409).json({ error: 'Ya existe un equipo con ese código.' });
  }
  const r = run(
    `INSERT INTO equipo (codigo, descripcion, modelo, ubicacion, area_id, criticidad)
     VALUES (?,?,?,?,?,?)`,
    codigo, descripcion, modelo ?? null, ubicacion ?? null, area_id ?? null, criticidad ?? null,
  );
  auditar(req.user.id, 'equipo.crear', 'equipo', Number(r.lastInsertRowid), { codigo });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

router.put('/:id', requireRole('supervisor', 'planificador', 'gestor_sap'), (req, res) => {
  const { descripcion, modelo, ubicacion, area_id, criticidad, activo } = req.body;
  run(
    `UPDATE equipo SET descripcion = COALESCE(?, descripcion), modelo = ?, ubicacion = ?,
        area_id = ?, criticidad = ?, activo = COALESCE(?, activo), updated_at = datetime('now')
     WHERE id = ?`,
    descripcion ?? null, modelo ?? null, ubicacion ?? null, area_id ?? null, criticidad ?? null,
    activo ?? null, Number(req.params.id),
  );
  auditar(req.user.id, 'equipo.actualizar', 'equipo', Number(req.params.id));
  res.json({ ok: true });
});

export default router;

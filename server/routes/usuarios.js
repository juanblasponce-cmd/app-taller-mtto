// =====================================================================
//  Usuarios operativos (administración — sección 5.1)
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole } from '../lib/auth.js';
import { auditar } from '../lib/helpers.js';

const router = Router();

router.get('/', (req, res) => {
  const { rol, area_id } = req.query;
  let sql = `SELECT u.*, a.nombre AS area FROM usuario u LEFT JOIN area a ON a.id = u.area_id WHERE 1=1`;
  const p = [];
  if (rol) { sql += ' AND u.rol = ?'; p.push(rol); }
  if (area_id) { sql += ' AND u.area_id = ?'; p.push(Number(area_id)); }
  sql += ' ORDER BY u.nombre';
  res.json(all(sql, ...p));
});

router.get('/:id', (req, res) => {
  const u = get('SELECT * FROM usuario WHERE id = ?', Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'No encontrado.' });
  res.json(u);
});

router.post('/', requireRole(), (req, res) => {
  const { nombre, correo, rol, cargo, area_id, especialidad } = req.body;
  if (!nombre || !correo || !rol) return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  const r = run(
    `INSERT INTO usuario (nombre, correo, rol, cargo, area_id, especialidad, entra_id)
     VALUES (?,?,?,?,?,?,?)`,
    nombre, correo, rol, cargo ?? null, area_id ?? null, especialidad ?? null,
    'entra-' + correo.split('@')[0],
  );
  auditar(req.user.id, 'usuario.crear', 'usuario', Number(r.lastInsertRowid), { correo, rol });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

router.put('/:id', requireRole(), (req, res) => {
  const { nombre, rol, cargo, area_id, especialidad, activo } = req.body;
  run(
    `UPDATE usuario SET nombre = COALESCE(?, nombre), rol = COALESCE(?, rol),
        cargo = COALESCE(?, cargo), area_id = ?, especialidad = ?,
        activo = COALESCE(?, activo), updated_at = datetime('now')
     WHERE id = ?`,
    nombre ?? null, rol ?? null, cargo ?? null, area_id ?? null, especialidad ?? null,
    activo ?? null, Number(req.params.id),
  );
  auditar(req.user.id, 'usuario.actualizar', 'usuario', Number(req.params.id));
  res.json({ ok: true });
});

export default router;

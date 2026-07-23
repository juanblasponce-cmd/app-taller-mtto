// =====================================================================
//  Catálogos (config. por Administrador — sección 5.1)
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole } from '../lib/auth.js';
import { auditar } from '../lib/helpers.js';

const router = Router();

// Todos los catálogos agrupados por tipo (para poblar selects del frontend)
router.get('/', (req, res) => {
  const rows = all('SELECT * FROM catalogo WHERE activo = 1 ORDER BY tipo, orden, etiqueta');
  const agrupado = {};
  for (const r of rows) (agrupado[r.tipo] ??= []).push(r);
  res.json(agrupado);
});

// Un tipo concreto
router.get('/:tipo', (req, res) => {
  res.json(all('SELECT * FROM catalogo WHERE tipo = ? ORDER BY orden, etiqueta', req.params.tipo));
});

// Crear / actualizar entrada (solo administrador)
router.post('/', requireRole(), (req, res) => {
  const { tipo, codigo, etiqueta, color, orden } = req.body;
  if (!tipo || !codigo || !etiqueta) return res.status(400).json({ error: 'Faltan campos.' });
  const existe = get('SELECT id FROM catalogo WHERE tipo = ? AND codigo = ?', tipo, codigo);
  if (existe) {
    run('UPDATE catalogo SET etiqueta = ?, color = ?, orden = ? WHERE id = ?',
      etiqueta, color ?? null, orden ?? 0, existe.id);
  } else {
    run('INSERT INTO catalogo (tipo, codigo, etiqueta, color, orden) VALUES (?,?,?,?,?)',
      tipo, codigo, etiqueta, color ?? null, orden ?? 0);
  }
  auditar(req.user.id, 'catalogo.upsert', 'catalogo', null, { tipo, codigo });
  res.json({ ok: true });
});

router.delete('/:id', requireRole(), (req, res) => {
  run('UPDATE catalogo SET activo = 0 WHERE id = ?', Number(req.params.id));
  auditar(req.user.id, 'catalogo.desactivar', 'catalogo', Number(req.params.id));
  res.json({ ok: true });
});

export default router;

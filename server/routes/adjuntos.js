// =====================================================================
//  Adjuntos: fotografías y documentos (sección 20).
//  En un despliegue real se guardarían en SharePoint; aquí en /uploads.
// =====================================================================
import { Router } from 'express';
import multer from 'multer';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { all, get, run } from '../db/index.js';
import { auditar, ApiError } from '../lib/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e6)}${extname(file.originalname)}`;
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// Subir archivo a una entidad (aviso|orden|material|cierre)
router.post('/:entidad/:entidadId', upload.single('archivo'), (req, res, next) => {
  if (!req.file) return next(new ApiError(400, 'No se recibió ningún archivo.'));
  const { entidad, entidadId } = req.params;
  const r = run(
    `INSERT INTO adjunto (entidad, entidad_id, categoria, nombre, ruta, mime, usuario_id)
     VALUES (?,?,?,?,?,?,?)`,
    entidad, Number(entidadId), req.body.categoria ?? 'documento', req.file.originalname,
    '/uploads/' + req.file.filename, req.file.mimetype, req.user.id,
  );
  auditar(req.user.id, 'adjunto.subir', entidad, Number(entidadId), { nombre: req.file.originalname });
  res.status(201).json({ id: Number(r.lastInsertRowid), ruta: '/uploads/' + req.file.filename });
});

router.get('/:entidad/:entidadId', (req, res) => {
  res.json(all(
    'SELECT * FROM adjunto WHERE entidad=? AND entidad_id=? ORDER BY created_at DESC',
    req.params.entidad, Number(req.params.entidadId),
  ));
});

router.delete('/:id', (req, res, next) => {
  const a = get('SELECT * FROM adjunto WHERE id=?', Number(req.params.id));
  if (!a) return next(new ApiError(404, 'Adjunto no encontrado.'));
  try {
    const abs = join(UPLOAD_DIR, a.ruta.replace('/uploads/', ''));
    if (existsSync(abs)) unlinkSync(abs);
  } catch { /* ignora errores de fichero */ }
  run('DELETE FROM adjunto WHERE id=?', a.id);
  res.json({ ok: true });
});

export default router;

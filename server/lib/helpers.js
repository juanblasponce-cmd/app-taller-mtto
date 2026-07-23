// =====================================================================
//  Utilidades compartidas del backend
// =====================================================================
import { get, run, all } from '../db/index.js';

/** Genera un código correlativo por entidad: AV-2026-000001, OT-2026-000123... */
export function nextCodigo(prefijo, tabla) {
  const year = new Date().getFullYear();
  const row = get(
    `SELECT codigo FROM ${tabla} WHERE codigo LIKE ? ORDER BY id DESC LIMIT 1`,
    `${prefijo}-${year}-%`,
  );
  let n = 0;
  if (row?.codigo) n = parseInt(row.codigo.split('-')[2], 10) || 0;
  return `${prefijo}-${year}-${String(n + 1).padStart(6, '0')}`;
}

/** Registra un cambio de estado en el historial (trazabilidad). */
export function registrarHistorial(entidad, entidadId, estadoAnterior, estadoNuevo, usuarioId, comentario) {
  run(
    `INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, usuario_id, comentario)
     VALUES (?,?,?,?,?,?)`,
    entidad, entidadId, estadoAnterior ?? null, estadoNuevo ?? null, usuarioId ?? null, comentario ?? null,
  );
}

/** Registra una acción en la auditoría funcional (sección 6/38). */
export function auditar(usuarioId, accion, entidad, entidadId, detalle) {
  run(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
     VALUES (?,?,?,?,?)`,
    usuarioId ?? null, accion, entidad ?? null, entidadId ?? null,
    detalle ? (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)) : null,
  );
}

/** Devuelve un mapa {codigo: {etiqueta, color, ...}} para un tipo de catálogo. */
export function catalogoMap(tipo) {
  const rows = all('SELECT * FROM catalogo WHERE tipo = ? ORDER BY orden', tipo);
  const map = {};
  for (const r of rows) map[r.codigo] = r;
  return map;
}

/** Error HTTP con código de estado. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

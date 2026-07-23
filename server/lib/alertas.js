// =====================================================================
//  Flujo de alertas automáticas (sección 15).
//  Se ejecuta periódicamente: detecta OT activas sin movimiento y
//  genera alertas evitando duplicados. Simula el flujo horario de
//  Power Automate.
// =====================================================================
import { all, run, get } from '../db/index.js';

// Horas sin actualización a partir de las cuales se considera "sin movimiento".
const HORAS_SIN_MOVIMIENTO = 24;

export function ejecutarFlujoAlertas() {
  try {
    // OT activas = en backlog (estado no final) y con técnico
    const otSinMovimiento = all(
      `SELECT o.id, o.codigo, o.tecnico_responsable_id,
              (julianday('now') - julianday(o.updated_at)) * 24 AS horas
       FROM orden o
       JOIN catalogo c ON c.tipo = 'estado_ot' AND c.codigo = o.estado
       WHERE c.es_final = 0 AND o.activo = 1
         AND (julianday('now') - julianday(o.updated_at)) * 24 >= ?`,
      HORAS_SIN_MOVIMIENTO,
    );

    let creadas = 0;
    for (const ot of otSinMovimiento) {
      // Evitar duplicados: no crear si ya existe una alerta sin atender para esta OT
      const dup = get(
        `SELECT 1 AS x FROM alerta WHERE orden_id = ? AND tipo = 'sin_movimiento' AND atendida = 0 LIMIT 1`,
        ot.id,
      );
      if (dup) continue;
      run(
        `INSERT INTO alerta (orden_id, tipo, mensaje) VALUES (?, 'sin_movimiento', ?)`,
        ot.id,
        `La OT ${ot.codigo} lleva ${Math.round(ot.horas)} h sin actualización. Confirma su estado.`,
      );
      creadas++;
    }
    if (creadas > 0) console.log(`🔔 Flujo de alertas: ${creadas} alerta(s) nueva(s).`);
  } catch (err) {
    console.error('Error en el flujo de alertas:', err.message);
  }
}

// =====================================================================
//  Dashboard principal — indicadores operativos (sección 29)
// =====================================================================
import { Router } from 'express';
import { all, get } from '../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  const cuenta = (sql, ...p) => get(sql, ...p).n;

  const indicadores = {
    // Avisos
    avisos_pendientes: cuenta("SELECT COUNT(*) AS n FROM aviso WHERE estado='pendiente_validacion' AND activo=1"),
    avisos_pendientes_sap: cuenta("SELECT COUNT(*) AS n FROM aviso WHERE estado IN ('pendiente_registro_sap','pendiente_creacion_ot') AND activo=1"),
    avisos_observados: cuenta("SELECT COUNT(*) AS n FROM aviso WHERE estado='observado' AND activo=1"),
    // OT
    ot_abiertas: cuenta(`SELECT COUNT(*) AS n FROM orden o JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado WHERE c.es_final=0 AND o.activo=1`),
    ot_en_ejecucion: cuenta("SELECT COUNT(*) AS n FROM orden WHERE estado='en_ejecucion' AND activo=1"),
    ot_pausadas: cuenta("SELECT COUNT(*) AS n FROM orden WHERE estado IN ('pausada','trabajo_detenido') AND activo=1"),
    ot_esperando_materiales: cuenta("SELECT COUNT(*) AS n FROM orden WHERE estado='esperando_materiales' AND activo=1"),
    ot_cierre_solicitado: cuenta("SELECT COUNT(*) AS n FROM orden WHERE estado IN ('cierre_parcial_solicitado','cierre_total_solicitado') AND activo=1"),
    ot_pendientes_firma: cuenta("SELECT COUNT(*) AS n FROM orden WHERE estado='cerrada_sap_pendiente_conclusion' AND activo=1"),
    ot_concluidas: cuenta("SELECT COUNT(*) AS n FROM orden WHERE estado='concluida' AND activo=1"),
    ot_prioridad_alta: cuenta(`SELECT COUNT(*) AS n FROM orden o JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado WHERE c.es_final=0 AND o.prioridad='alta' AND o.activo=1`),
    ot_sin_actualizacion: cuenta(`SELECT COUNT(*) AS n FROM orden o JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado WHERE c.es_final=0 AND (julianday('now')-julianday(o.updated_at)) >= 1 AND o.activo=1`),
    // Horas y tiempos
    horas_hombre: get('SELECT COALESCE(SUM(duracion_horas),0) AS n FROM tiempo').n,
  };

  // Tiempo promedio de atención (horas entre creación y conclusión de OT concluidas)
  const tprom = get(
    `SELECT AVG((julianday(fecha_conclusion)-julianday(fecha_creacion))*24) AS h
     FROM orden WHERE fecha_conclusion IS NOT NULL`,
  ).h;
  indicadores.tiempo_promedio_atencion = tprom ? +tprom.toFixed(1) : 0;

  // Equipos con más fallas (sección 29)
  const equiposFallas = all(
    `SELECT e.codigo, e.descripcion, COUNT(*) AS fallas
     FROM aviso av JOIN equipo e ON e.id=av.equipo_id
     WHERE av.activo=1 GROUP BY av.equipo_id ORDER BY fallas DESC LIMIT 5`,
  );

  // OT por estado (para gráfico)
  const otPorEstado = all(
    `SELECT c.etiqueta AS nombre, COUNT(o.id) AS valor
     FROM orden o JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado
     WHERE o.activo=1 AND c.es_final=0 GROUP BY o.estado ORDER BY valor DESC`,
  );

  // OT por prioridad
  const otPorPrioridad = all(
    `SELECT p.etiqueta AS nombre, p.color, COUNT(o.id) AS valor
     FROM orden o JOIN catalogo p ON p.tipo='prioridad' AND p.codigo=o.prioridad
     JOIN catalogo c ON c.tipo='estado_ot' AND c.codigo=o.estado AND c.es_final=0
     WHERE o.activo=1 GROUP BY o.prioridad ORDER BY p.orden`,
  );

  res.json({ indicadores, equipos_fallas: equiposFallas, ot_por_estado: otPorEstado, ot_por_prioridad: otPorPrioridad });
});

export default router;

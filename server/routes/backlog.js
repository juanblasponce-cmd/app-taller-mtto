// =====================================================================
//  Backlog de mantenimiento (secciones 22 a 34).
//  Backlog consolidado = avisos en etapa "Aviso" (aún sin OT) +
//  OT en estados no finales. Un aviso con OT NO se cuenta dos veces:
//  la OT es el registro principal (sección 22.2 / 38).
//  La antigüedad se calcula desde la creación del aviso (sección 25/38).
// =====================================================================
import { Router } from 'express';
import { all, get, run } from '../db/index.js';
import { requireRole, ROLES } from '../lib/auth.js';

const router = Router();

const diasDesde = (fecha) =>
  fecha ? Math.floor((Date.now() - new Date(fecha.replace(' ', 'T') + 'Z').getTime()) / 86400000) : 0;

function rangoAntiguedad(dias) {
  if (dias <= 2) return '0-2 días';
  if (dias <= 7) return '3-7 días';
  if (dias <= 15) return '8-15 días';
  if (dias <= 30) return '16-30 días';
  if (dias <= 60) return '31-60 días';
  return 'Más de 60 días';
}

/** Construye la lista unificada del backlog (una fila por trabajo). */
function construirBacklog() {
  const rows = [];

  // 1) OT en backlog (estado no final) — registro principal
  const ots = all(`
    SELECT o.*, e.codigo AS equipo_codigo, e.descripcion AS equipo_desc,
           ar.nombre AS area, tr.nombre AS tecnico,
           pr.etiqueta AS prioridad_label, pr.color AS prioridad_color,
           es.etiqueta AS estado_label, tm.etiqueta AS tipo_mant_label,
           mb.etiqueta AS motivo_bloqueo_label,
           av.created_at AS aviso_created, av.codigo AS aviso_codigo,
           (SELECT COALESCE(SUM(duracion_horas),0) FROM tiempo WHERE orden_id=o.id) AS horas_ejec
    FROM orden o
    LEFT JOIN equipo e ON e.id=o.equipo_id
    LEFT JOIN area ar ON ar.id=o.area_id
    LEFT JOIN usuario tr ON tr.id=o.tecnico_responsable_id
    LEFT JOIN catalogo pr ON pr.tipo='prioridad' AND pr.codigo=o.prioridad
    LEFT JOIN catalogo es ON es.tipo='estado_ot' AND es.codigo=o.estado
    LEFT JOIN catalogo tm ON tm.tipo='tipo_mantenimiento' AND tm.codigo=o.tipo_mantenimiento
    LEFT JOIN catalogo mb ON mb.tipo='motivo_bloqueo' AND mb.codigo=o.motivo_bloqueo
    LEFT JOIN aviso av ON av.id=o.aviso_id
    JOIN catalogo esf ON esf.tipo='estado_ot' AND esf.codigo=o.estado AND esf.es_final=0
    WHERE o.activo=1`);

  for (const o of ots) {
    const origen = o.aviso_created || o.fecha_creacion || o.created_at;
    const antiguedad = diasDesde(origen);
    const horasEst = o.horas_estimadas ?? 0;
    const horasRest = Math.max(0, horasEst - o.horas_ejec);
    rows.push({
      etapa: 'Orden de Trabajo', tipo: 'orden', id: o.id, codigo: o.codigo,
      aviso_sap: o.aviso_sap, ot_sap: o.ot_sap, equipo: o.equipo_desc, equipo_codigo: o.equipo_codigo,
      area: o.area, supervisor: null, tecnico: o.tecnico, tipo_mantenimiento: o.tipo_mant_label,
      prioridad: o.prioridad, prioridad_label: o.prioridad_label, prioridad_color: o.prioridad_color,
      criticidad: o.criticidad, estado: o.estado, estado_label: o.estado_label,
      fecha_creacion: origen, fecha_requerida: o.fecha_requerida, fecha_programada: o.fecha_programada,
      fecha_comprometida: o.fecha_comprometida, ultima_actualizacion: o.updated_at,
      antiguedad, rango_antiguedad: rangoAntiguedad(antiguedad),
      horas_estimadas: horasEst, horas_ejecutadas: o.horas_ejec, horas_restantes: horasRest,
      motivo_espera: o.motivo_bloqueo_label, estado_planificacion: o.estado_planificacion,
      vencido: o.fecha_requerida && new Date(o.fecha_requerida) < new Date(),
      sin_asignar: !o.tecnico_responsable_id, sin_estimacion: horasEst === 0,
      dias_sin_actualizacion: diasDesde(o.updated_at),
    });
  }

  // 2) Avisos en backlog que aún no tienen OT (etapa Aviso)
  const avisos = all(`
    SELECT av.*, e.codigo AS equipo_codigo, e.descripcion AS equipo_desc, ar.nombre AS area,
           pr.etiqueta AS prioridad_label, pr.color AS prioridad_color, ea.etiqueta AS estado_label
    FROM aviso av
    LEFT JOIN equipo e ON e.id=av.equipo_id
    LEFT JOIN area ar ON ar.id=av.area_id
    LEFT JOIN catalogo pr ON pr.tipo='prioridad' AND pr.codigo=av.prioridad
    LEFT JOIN catalogo ea ON ea.tipo='estado_aviso' AND ea.codigo=av.estado
    JOIN catalogo eb ON eb.tipo='estado_aviso' AND eb.codigo=av.estado AND eb.es_backlog=1
    WHERE av.activo=1 AND NOT EXISTS (SELECT 1 FROM orden o WHERE o.aviso_id=av.id)`);

  for (const av of avisos) {
    const antiguedad = diasDesde(av.created_at);
    const horasEst = (av.duracion_estimada ?? 0) * (av.tecnicos_estimados || 1);
    rows.push({
      etapa: 'Aviso', tipo: 'aviso', id: av.id, codigo: av.codigo,
      aviso_sap: av.aviso_sap, ot_sap: null, equipo: av.equipo_desc, equipo_codigo: av.equipo_codigo,
      area: av.area, supervisor: null, tecnico: null, tipo_mantenimiento: null,
      prioridad: av.prioridad, prioridad_label: av.prioridad_label, prioridad_color: av.prioridad_color,
      criticidad: av.criticidad, estado: av.estado, estado_label: av.estado_label,
      fecha_creacion: av.created_at, fecha_requerida: null, fecha_programada: null,
      fecha_comprometida: null, ultima_actualizacion: av.updated_at,
      antiguedad, rango_antiguedad: rangoAntiguedad(antiguedad),
      horas_estimadas: horasEst, horas_ejecutadas: 0, horas_restantes: horasEst,
      motivo_espera: av.estado_label, estado_planificacion: null,
      vencido: false, sin_asignar: true, sin_estimacion: horasEst === 0,
      dias_sin_actualizacion: diasDesde(av.updated_at),
    });
  }

  return rows;
}

function aplicarFiltros(rows, q) {
  let r = rows;
  if (q.etapa) r = r.filter((x) => x.etapa === q.etapa);
  if (q.area) r = r.filter((x) => x.area === q.area);
  if (q.prioridad) r = r.filter((x) => x.prioridad === q.prioridad);
  if (q.estado) r = r.filter((x) => x.estado === q.estado);
  if (q.rango) r = r.filter((x) => x.rango_antiguedad === q.rango);
  if (q.vencido === '1') r = r.filter((x) => x.vencido);
  if (q.sin_asignar === '1') r = r.filter((x) => x.sin_asignar);
  if (q.sin_estimacion === '1') r = r.filter((x) => x.sin_estimacion);
  if (q.busqueda) {
    const s = q.busqueda.toLowerCase();
    r = r.filter((x) => [x.codigo, x.equipo, x.ot_sap, x.aviso_sap].some((v) => v && String(v).toLowerCase().includes(s)));
  }
  return r;
}

// --- Vista detallada del backlog (sección 31) con filtros (sección 32) ---
router.get('/', (req, res) => {
  const rows = aplicarFiltros(construirBacklog(), req.query);
  rows.sort((a, b) => {
    const pr = { alta: 1, media: 2, baja: 3 };
    return (pr[a.prioridad] || 9) - (pr[b.prioridad] || 9) || b.antiguedad - a.antiguedad;
  });
  res.json(rows);
});

// --- Capacidad semanal disponible (suma de áreas) ---
function capacidadSemanal() {
  const r = get('SELECT COALESCE(SUM(capacidad_semanal_horas),0) AS h FROM area WHERE activo=1');
  return r?.h || 0;
}

// --- Resumen / tarjetas e indicadores (secciones 30 y 34) ---
router.get('/resumen', (req, res) => {
  const rows = construirBacklog();
  const total = rows.length;
  const avisosBl = rows.filter((r) => r.etapa === 'Aviso').length;
  const otBl = rows.filter((r) => r.etapa === 'Orden de Trabajo').length;
  const horasPend = rows.reduce((s, r) => s + (r.horas_restantes || 0), 0);
  const cap = capacidadSemanal();
  const semanas = cap > 0 ? +(horasPend / cap).toFixed(1) : null;
  const vencidos = rows.filter((r) => r.vencido).length;
  const sinAsignar = rows.filter((r) => r.sin_asignar).length;
  const espMat = rows.filter((r) => r.estado === 'esperando_materiales').length;
  const sinEst = rows.filter((r) => r.sin_estimacion).length;
  const prioridadAlta = rows.filter((r) => r.prioridad === 'alta').length;
  const bloqueados = rows.filter((r) => ['esperando_materiales', 'trabajo_detenido', 'pausada'].includes(r.estado)).length;
  const antigProm = total ? +(rows.reduce((s, r) => s + r.antiguedad, 0) / total).toFixed(1) : 0;
  const antigMax = total ? Math.max(...rows.map((r) => r.antiguedad)) : 0;
  const sinActualizacion = rows.filter((r) => r.dias_sin_actualizacion >= 1).length;
  const pendientesCierre = rows.filter((r) => ['cierre_parcial_solicitado', 'cierre_total_solicitado', 'cerrada_sap_pendiente_conclusion', 'cierre_parcial'].includes(r.estado)).length;
  const planificados = rows.filter((r) => r.estado_planificacion === 'planificado').length;
  const programados = rows.filter((r) => r.estado_planificacion === 'programado' || r.fecha_programada).length;

  res.json({
    backlog_total: total, avisos_backlog: avisosBl, ot_backlog: otBl,
    horas_pendientes: +horasPend.toFixed(1), semanas_backlog: semanas, capacidad_semanal: cap,
    prioridad_alta: prioridadAlta, trabajos_vencidos: vencidos, sin_asignar: sinAsignar,
    esperando_materiales: espMat, sin_estimacion: sinEst, bloqueados,
    antiguedad_promedio: antigProm, antiguedad_maxima: antigMax,
    sin_actualizacion: sinActualizacion, pendientes_cierre: pendientesCierre,
    planificados, programados,
    porcentaje_avisos: total ? Math.round(avisosBl / total * 100) : 0,
    porcentaje_ot: total ? Math.round(otBl / total * 100) : 0,
    porcentaje_vencido: total ? Math.round(vencidos / total * 100) : 0,
  });
});

// --- Datos para gráficos (sección 30) ---
router.get('/graficos', (req, res) => {
  const rows = construirBacklog();
  const agrupar = (key) => {
    const m = {};
    for (const r of rows) { const k = r[key] || 'Sin dato'; m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor }));
  };
  res.json({
    por_etapa: agrupar('etapa'),
    por_estado: agrupar('estado_label'),
    por_area: agrupar('area'),
    por_prioridad: agrupar('prioridad_label'),
    por_antiguedad: ['0-2 días', '3-7 días', '8-15 días', '16-30 días', '31-60 días', 'Más de 60 días']
      .map((r) => ({ nombre: r, valor: rows.filter((x) => x.rango_antiguedad === r).length })),
    por_tipo_mantenimiento: agrupar('tipo_mantenimiento'),
    por_motivo_espera: agrupar('motivo_espera'),
  });
});

// --- Capacidad vs demanda por área (semanas de backlog — sección 26) ---
router.get('/capacidad', (req, res) => {
  const rows = construirBacklog();
  const areas = all('SELECT id, nombre, capacidad_semanal_horas FROM area WHERE activo=1 ORDER BY nombre');
  const data = areas.map((a) => {
    const dem = rows.filter((r) => r.area === a.nombre).reduce((s, r) => s + (r.horas_restantes || 0), 0);
    const cap = a.capacidad_semanal_horas || 0;
    return {
      area: a.nombre, capacidad: cap, demanda: +dem.toFixed(1),
      semanas_backlog: cap > 0 ? +(dem / cap).toFixed(1) : null,
      trabajos: rows.filter((r) => r.area === a.nombre).length,
    };
  });
  res.json(data);
});

// --- Cortes históricos (sección 33) ---
router.post('/corte', requireRole(ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.PLANIFICADOR), (req, res) => {
  const periodo = req.body.periodo || 'diario';
  const rows = construirBacklog();
  const horasPend = rows.reduce((s, r) => s + (r.horas_restantes || 0), 0);
  const cap = capacidadSemanal();
  const ingresados = get("SELECT COUNT(*) AS n FROM aviso WHERE created_at >= date('now','-1 day')").n;
  const concluidos = get("SELECT COUNT(*) AS n FROM orden WHERE fecha_conclusion >= date('now','-1 day')").n;
  run(
    `INSERT INTO backlog_corte
      (fecha, periodo, avisos_pendientes, ot_pendientes, total_trabajos, horas_pendientes,
       capacidad, semanas_backlog, trabajos_criticos, trabajos_vencidos, esperando_materiales,
       trabajos_ingresados, trabajos_concluidos)
     VALUES (datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?)`,
    periodo, rows.filter((r) => r.etapa === 'Aviso').length, rows.filter((r) => r.etapa === 'Orden de Trabajo').length,
    rows.length, +horasPend.toFixed(1), cap, cap > 0 ? +(horasPend / cap).toFixed(1) : 0,
    rows.filter((r) => r.criticidad === 'critica').length, rows.filter((r) => r.vencido).length,
    rows.filter((r) => r.estado === 'esperando_materiales').length, ingresados, concluidos,
  );
  res.json({ ok: true });
});

router.get('/cortes', (req, res) => {
  res.json(all('SELECT * FROM backlog_corte ORDER BY fecha DESC LIMIT 60'));
});

export default router;

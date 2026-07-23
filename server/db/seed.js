// =====================================================================
//  Seed — catálogos, usuarios, áreas, equipos y datos de ejemplo.
//  Ejecutar:  npm run seed     (recrea catálogos y datos base)
// =====================================================================
import { db, applySchema, run, get } from './index.js';

const force = process.argv.includes('--force');

applySchema();

const yaSembrado = get('SELECT COUNT(*) AS n FROM catalogo')?.n > 0;
if (yaSembrado && !force) {
  console.log('La base ya contiene datos. Usa "npm run seed" para reiniciar catálogos.');
  process.exit(0);
}

// Limpieza cuando --force (respetando dependencias)
if (force) {
  const tablas = [
    'alerta', 'auditoria', 'historial_estado', 'adjunto', 'firma', 'cierre',
    'tiempo', 'material_comentario', 'material_solicitud', 'orden_tecnico',
    'orden', 'aviso', 'equipo', 'capacidad', 'backlog_corte', 'area',
    'usuario', 'catalogo',
  ];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of tablas) db.exec(`DELETE FROM ${t}; DELETE FROM sqlite_sequence WHERE name='${t}';`);
  db.exec('PRAGMA foreign_keys = ON;');
}

// ---------------------------------------------------------------------
//  CATÁLOGOS
// ---------------------------------------------------------------------
const cat = (tipo, codigo, etiqueta, extra = {}) =>
  run(
    `INSERT INTO catalogo (tipo, codigo, etiqueta, color, orden, es_backlog, es_final, etapa)
     VALUES (?,?,?,?,?,?,?,?)`,
    tipo, codigo, etiqueta,
    extra.color ?? null, extra.orden ?? 0,
    extra.es_backlog ? 1 : 0, extra.es_final ? 1 : 0, extra.etapa ?? null,
  );

// Prioridades (sección 11)
cat('prioridad', 'alta', 'Alta', { color: '#E53935', orden: 1 });
cat('prioridad', 'media', 'Media', { color: '#F9A825', orden: 2 });
cat('prioridad', 'baja', 'Baja', { color: '#43A047', orden: 3 });

// Criticidad
cat('criticidad', 'critica', 'Crítica', { color: '#B71C1C', orden: 1 });
cat('criticidad', 'alta', 'Alta', { color: '#E53935', orden: 2 });
cat('criticidad', 'media', 'Media', { color: '#F9A825', orden: 3 });
cat('criticidad', 'baja', 'Baja', { color: '#43A047', orden: 4 });

// Tipos de aviso
['Avería', 'Falla intermitente', 'Inspección', 'Preventivo', 'Mejora', 'Otro']
  .forEach((e, i) => cat('tipo_aviso', e.toLowerCase().replace(/[^a-z]/g, '_'), e, { orden: i + 1 }));

// Tipos de mantenimiento (sección 10.2)
['Correctivo', 'Preventivo', 'Fabricación', 'Mejora']
  .forEach((e, i) => cat('tipo_mantenimiento', e.toLowerCase().replace(/[^a-z]/g, '_'), e, { orden: i + 1 }));

// Estados de aviso (sección 7.3) — es_backlog según sección 22.1
const estadosAviso = [
  ['borrador', 'Borrador', false, false],
  ['pendiente_validacion', 'Pendiente de validación', true, false],
  ['observado', 'Observado', true, false],
  ['rechazado', 'Rechazado', false, false],
  ['validado', 'Validado', true, false],
  ['pendiente_registro_sap', 'Pendiente de registro SAP', true, false],
  ['pendiente_creacion_ot', 'Pendiente de creación de OT', true, false],
  ['ot_creada', 'OT creada', false, false],
  ['en_atencion', 'En atención', false, false],
  ['cierre_parcial', 'Cierre parcial', false, false],
  ['concluido', 'Concluido', false, true],
  ['anulado', 'Anulado', false, true],
];
estadosAviso.forEach(([c, e, bl, fin], i) =>
  cat('estado_aviso', c, e, { orden: i + 1, es_backlog: bl, es_final: fin, etapa: 'Aviso' }));

// Estados de OT (sección 10.3) — backlog = todos excepto concluida y anulada
const estadosOT = [
  'pendiente_asignacion|Pendiente de asignación',
  'asignada|Asignada',
  'aceptada|Aceptada',
  'en_transporte|En transporte',
  'en_diagnostico|En diagnóstico',
  'esperando_materiales|Esperando materiales',
  'materiales_en_curso|Materiales en curso',
  'en_ejecucion|En ejecución',
  'trabajo_detenido|Trabajo detenido',
  'pausada|Pausada',
  'en_pruebas|En pruebas',
  'cierre_parcial_solicitado|Cierre parcial solicitado',
  'cierre_parcial|Cierre parcial',
  'cierre_total_solicitado|Cierre total solicitado',
  'pendiente_registro_sap|Pendiente de registro SAP',
  'pendiente_validacion|Pendiente de validación',
  'cerrada_sap_pendiente_conclusion|Cerrada en SAP pendiente de conclusión',
  'concluida|Concluida',
  'reabierta|Reabierta',
  'anulada|Anulada',
];
estadosOT.forEach((row, i) => {
  const [c, e] = row.split('|');
  const fin = c === 'concluida' || c === 'anulada';
  cat('estado_ot', c, e, { orden: i + 1, es_backlog: !fin, es_final: fin, etapa: 'Orden de Trabajo' });
});

// Estados de material (sección 13.3)
[
  ['solicitado', 'Solicitado'], ['en_revision', 'En revisión'], ['en_stock', 'En stock'],
  ['reserva_creada', 'Reserva creada'], ['sin_stock', 'Sin stock'], ['cancelado', 'Cancelado'],
].forEach(([c, e], i) => cat('estado_material', c, e, { orden: i + 1 }));

// Categorías de tiempo (sección 14)
[
  ['trabajo', 'Trabajo productivo'], ['traslados', 'Traslados'], ['hora_charla', 'Hora Charla'],
  ['espera_almacen', 'Espera Almacén'], ['limpieza', 'Limpieza'],
].forEach(([c, e], i) => cat('categoria_tiempo', c, e, { orden: i + 1 }));

// Motivos de bloqueo (sección 28)
[
  'Pendiente de validación', 'Pendiente de creación SAP', 'Pendiente de OT',
  'Pendiente de asignación', 'Falta de técnico', 'Sin stock', 'Esperando reserva',
  'Esperando compra', 'Servicio externo', 'Falta de autorización', 'Condición de seguridad',
  'Condición ambiental', 'Información insuficiente', 'Reprogramación',
].forEach((e, i) => cat('motivo_bloqueo', e.toLowerCase().replace(/[^a-z]+/g, '_'), e, { orden: i + 1 }));

// Especialidades
['Mecánica', 'Eléctrica', 'Soldadura', 'Hidráulica', 'Neumática', 'Electrónica', 'Pintura', 'Torno']
  .forEach((e, i) => cat('especialidad', e.toLowerCase().replace(/[^a-z]/g, '_'), e, { orden: i + 1 }));

// Estados de planificación (sección 27.1)
[
  'Sin evaluar', 'Pendiente de alcance', 'Pendiente de estimación', 'Listo para planificar',
  'Planificado', 'Programado', 'Asignado', 'En ejecución', 'Bloqueado',
  'Pendiente de materiales', 'Pendiente de autorización', 'Pendiente de cierre', 'Reprogramado',
].forEach((e, i) => cat('estado_planificacion', e.toLowerCase().replace(/[^a-z]+/g, '_'), e, { orden: i + 1 }));

// ---------------------------------------------------------------------
//  ÁREAS (sección 12)
// ---------------------------------------------------------------------
const areas = [
  'Electricidad', 'Enllante', 'Equipos Menores Sanidad', 'Implementos Agrícolas',
  'Maquinaria Agrícola', 'Soldadura', 'Pintura', 'Torno',
];
const areaId = {};
areas.forEach((nombre) => {
  const r = run(
    'INSERT INTO area (nombre, capacidad_semanal_horas) VALUES (?, ?)',
    nombre, 160,
  );
  areaId[nombre] = Number(r.lastInsertRowid);
});

// ---------------------------------------------------------------------
//  USUARIOS (uno por rol + técnicos/supervisores) — sección 5
// ---------------------------------------------------------------------
const usuarios = [
  ['Juan Blas Ponce', 'juan.blas.ponce@gmail.com', 'administrador', 'Administrador del sistema', null, null],
  ['Carlos Ramírez', 'carlos.ramirez@taller.local', 'supervisor', 'Supervisor de mantenimiento', null, null],
  ['Lucía Fernández', 'lucia.fernandez@taller.local', 'gestor_sap', 'Gestor Enlace SAP', null, null],
  ['Jorge Núñez', 'jorge.nunez@taller.local', 'planificador', 'Planificador de mantenimiento', null, null],
  ['Pedro Gómez', 'pedro.gomez@taller.local', 'tecnico', 'Técnico mecánico', 'Maquinaria Agrícola', 'Mecánica'],
  ['Rosa Vega', 'rosa.vega@taller.local', 'tecnico', 'Técnico soldador', 'Soldadura', 'Soldadura'],
  ['Luis Mendoza', 'luis.mendoza@taller.local', 'tecnico', 'Técnico electricista', 'Electricidad', 'Eléctrica'],
];
const userId = {};
usuarios.forEach(([nombre, correo, rol, cargo, area, esp]) => {
  const r = run(
    `INSERT INTO usuario (nombre, correo, rol, cargo, area_id, especialidad, entra_id)
     VALUES (?,?,?,?,?,?,?)`,
    nombre, correo, rol, cargo, area ? areaId[area] : null, esp,
    'entra-' + correo.split('@')[0],
  );
  userId[correo] = Number(r.lastInsertRowid);
});

// Asignar el supervisor a las áreas
run('UPDATE area SET supervisor_id = ? WHERE nombre IN (?, ?)',
  userId['carlos.ramirez@taller.local'], 'Maquinaria Agrícola', 'Soldadura');

// ---------------------------------------------------------------------
//  EQUIPOS (sección 21)
// ---------------------------------------------------------------------
const equipos = [
  ['TR-125', 'Tractor 125', 'John Deere 6110', 'Patio A', 'Maquinaria Agrícola', 'alta'],
  ['TR-208', 'Tractor 208', 'Massey Ferguson 4708', 'Patio A', 'Maquinaria Agrícola', 'media'],
  ['COS-04', 'Cosechadora 04', 'New Holland TC5.30', 'Galpón 2', 'Maquinaria Agrícola', 'critica'],
  ['SOL-11', 'Soldadora MIG 11', 'Lincoln PowerMIG 260', 'Taller Soldadura', 'Soldadura', 'media'],
  ['TOR-02', 'Torno paralelo 02', 'Pinacho S90', 'Taller Torno', 'Torno', 'alta'],
  ['IMP-33', 'Rastra de discos 33', 'Baldan CRHP', 'Patio B', 'Implementos Agrícolas', 'baja'],
  ['TAB-07', 'Tablero eléctrico principal', 'Schneider NSX', 'Sala eléctrica', 'Electricidad', 'critica'],
];
const equipoId = {};
equipos.forEach(([codigo, desc, modelo, ubic, area, crit]) => {
  const r = run(
    `INSERT INTO equipo (codigo, descripcion, modelo, ubicacion, area_id, criticidad)
     VALUES (?,?,?,?,?,?)`,
    codigo, desc, modelo, ubic, areaId[area], crit,
  );
  equipoId[codigo] = Number(r.lastInsertRowid);
});

// ---------------------------------------------------------------------
//  DATOS DE EJEMPLO — avisos y OT en distintos estados (para dashboards/backlog)
// ---------------------------------------------------------------------
let avSeq = 0, otSeq = 0, matSeq = 0;
const nextAviso = () => `AV-2026-${String(++avSeq).padStart(6, '0')}`;
const nextOT = () => `OT-2026-${String(++otSeq).padStart(6, '0')}`;
const nextMat = () => `MT-2026-${String(++matSeq).padStart(6, '0')}`;

function crearAviso(o) {
  const codigo = nextAviso();
  const r = run(
    `INSERT INTO aviso
     (codigo, equipo_id, area_id, ubicacion, sintoma, descripcion, tipo_aviso, prioridad,
      criticidad, estado, solicitante_id, duracion_estimada, tecnicos_estimados, especialidad,
      created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now', ?), datetime('now', ?))`,
    codigo, o.equipo_id, o.area_id, o.ubicacion, o.sintoma, o.descripcion, o.tipo_aviso,
    o.prioridad, o.criticidad, o.estado, o.solicitante_id, o.duracion_estimada ?? null,
    o.tecnicos_estimados ?? null, o.especialidad ?? null, o.solicitante_id,
    o.antiguedad ?? '-1 days', o.antiguedad ?? '-1 days',
  );
  const id = Number(r.lastInsertRowid);
  run(`INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, usuario_id)
       VALUES ('aviso', ?, NULL, ?, ?)`, id, o.estado, o.solicitante_id);
  return { id, codigo };
}

function crearOT(o) {
  const codigo = nextOT();
  const r = run(
    `INSERT INTO orden
     (codigo, aviso_id, aviso_sap, ot_sap, equipo_id, area_id, ubicacion, tecnico_responsable_id,
      tipo_mantenimiento, prioridad, criticidad, estado, estado_planificacion, horas_estimadas,
      tecnicos_requeridos, especialidad, motivo_bloqueo, trabajo_realizado, condicion_final,
      fecha_requerida, created_by, fecha_creacion, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now', ?), ?, datetime('now', ?), datetime('now', ?), datetime('now', ?))`,
    codigo, o.aviso_id, o.aviso_sap ?? null, o.ot_sap ?? null, o.equipo_id, o.area_id, o.ubicacion,
    o.tecnico_responsable_id ?? null, o.tipo_mantenimiento, o.prioridad, o.criticidad, o.estado,
    o.estado_planificacion ?? 'sin_evaluar', o.horas_estimadas ?? null, o.tecnicos_requeridos ?? 1,
    o.especialidad ?? null, o.motivo_bloqueo ?? null, o.trabajo_realizado ?? null,
    o.condicion_final ?? null, o.fecha_requerida ?? '+3 days', o.created_by ?? 1,
    o.antiguedad ?? '-1 days', o.antiguedad ?? '-1 days', o.actualizado ?? o.antiguedad ?? '-1 days',
  );
  const id = Number(r.lastInsertRowid);
  if (o.tecnico_responsable_id) {
    run('INSERT OR IGNORE INTO orden_tecnico (orden_id, usuario_id) VALUES (?,?)', id, o.tecnico_responsable_id);
  }
  run(`INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, usuario_id)
       VALUES ('orden', ?, NULL, ?, ?)`, id, o.estado, o.created_by ?? 1);
  return { id, codigo };
}

const sol = userId['carlos.ramirez@taller.local'];
const tecPedro = userId['pedro.gomez@taller.local'];
const tecRosa = userId['rosa.vega@taller.local'];
const tecLuis = userId['luis.mendoza@taller.local'];

// --- Avisos en backlog (aún sin OT) ---
crearAviso({
  equipo_id: equipoId['TR-208'], area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Patio A',
  sintoma: 'Ruido en la caja de cambios', descripcion: 'Se escucha un golpeteo al cambiar de marcha.',
  tipo_aviso: 'averia', prioridad: 'media', criticidad: 'media', estado: 'pendiente_validacion',
  solicitante_id: sol, duracion_estimada: 4, tecnicos_estimados: 1, especialidad: 'mecanica',
  antiguedad: '-2 days',
});
crearAviso({
  equipo_id: equipoId['TAB-07'], area_id: areaId['Electricidad'], ubicacion: 'Sala eléctrica',
  sintoma: 'Disparo de térmico', descripcion: 'El tablero principal dispara el térmico de forma intermitente.',
  tipo_aviso: 'falla_intermitente', prioridad: 'alta', criticidad: 'critica', estado: 'validado',
  solicitante_id: sol, duracion_estimada: 6, tecnicos_estimados: 2, especialidad: 'electrica',
  antiguedad: '-9 days',
});
crearAviso({
  equipo_id: equipoId['IMP-33'], area_id: areaId['Implementos Agrícolas'], ubicacion: 'Patio B',
  sintoma: 'Disco desgastado', descripcion: 'Reemplazar discos de la rastra.',
  tipo_aviso: 'preventivo', prioridad: 'baja', criticidad: 'baja', estado: 'observado',
  solicitante_id: sol, duracion_estimada: 3, tecnicos_estimados: 1, especialidad: 'mecanica',
  antiguedad: '-18 days',
});
const avParaOT = crearAviso({
  equipo_id: equipoId['COS-04'], area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Galpón 2',
  sintoma: 'No enciende', descripcion: 'La cosechadora no arranca, posible falla eléctrica.',
  tipo_aviso: 'averia', prioridad: 'alta', criticidad: 'critica', estado: 'pendiente_creacion_ot',
  solicitante_id: sol, duracion_estimada: 8, tecnicos_estimados: 2, especialidad: 'electrica',
  antiguedad: '-5 days',
});

// --- OT en distintos estados (backlog en OT + historial) ---
const avOT1 = crearAviso({
  equipo_id: equipoId['TR-125'], area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Patio A',
  sintoma: 'Fuga de aceite hidráulico', descripcion: 'Pérdida de aceite en el cilindro del cargador frontal.',
  tipo_aviso: 'averia', prioridad: 'alta', criticidad: 'alta', estado: 'en_atencion',
  solicitante_id: sol, antiguedad: '-12 days',
});
crearOT({
  aviso_id: avOT1.id, aviso_sap: '10045871', ot_sap: '40001258', equipo_id: equipoId['TR-125'],
  area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Patio A', tecnico_responsable_id: tecPedro,
  tipo_mantenimiento: 'correctivo', prioridad: 'alta', criticidad: 'alta', estado: 'en_ejecucion',
  estado_planificacion: 'en_ejecucion', horas_estimadas: 6, tecnicos_requeridos: 1, especialidad: 'mecanica',
  antiguedad: '-12 days', actualizado: '-3 hours', created_by: userId['lucia.fernandez@taller.local'],
});

const avOT2 = crearAviso({
  equipo_id: equipoId['SOL-11'], area_id: areaId['Soldadura'], ubicacion: 'Taller Soldadura',
  sintoma: 'Alimentador de alambre atascado', descripcion: 'El alimentador de alambre no avanza.',
  tipo_aviso: 'averia', prioridad: 'media', criticidad: 'media', estado: 'en_atencion',
  solicitante_id: sol, antiguedad: '-7 days',
});
const ot2 = crearOT({
  aviso_id: avOT2.id, aviso_sap: '10045902', ot_sap: '40001263', equipo_id: equipoId['SOL-11'],
  area_id: areaId['Soldadura'], ubicacion: 'Taller Soldadura', tecnico_responsable_id: tecRosa,
  tipo_mantenimiento: 'correctivo', prioridad: 'media', criticidad: 'media', estado: 'esperando_materiales',
  estado_planificacion: 'pendiente_materiales', horas_estimadas: 4, tecnicos_requeridos: 1, especialidad: 'soldadura',
  motivo_bloqueo: 'sin_stock', antiguedad: '-7 days', actualizado: '-1 days',
  created_by: userId['lucia.fernandez@taller.local'],
});
// Solicitud de material para OT2
run(
  `INSERT INTO material_solicitud (codigo, orden_id, descripcion_libre, cantidad_aprox, unidad, motivo, estado, solicitante_id, created_at)
   VALUES (?,?,?,?,?,?,?,?, datetime('now','-1 days'))`,
  nextMat(), ot2.id, 'Rodillo alimentador de alambre 0.9mm', 1, 'unidad', 'Repuesto desgastado', 'en_revision', tecRosa,
);

const avOT3 = crearAviso({
  equipo_id: equipoId['TOR-02'], area_id: areaId['Torno'], ubicacion: 'Taller Torno',
  sintoma: 'Vibración excesiva', descripcion: 'Vibración anormal a altas RPM.',
  tipo_aviso: 'averia', prioridad: 'media', criticidad: 'alta', estado: 'en_atencion',
  solicitante_id: sol, antiguedad: '-20 days',
});
crearOT({
  aviso_id: avOT3.id, aviso_sap: '10045810', ot_sap: '40001240', equipo_id: equipoId['TOR-02'],
  area_id: areaId['Torno'], ubicacion: 'Taller Torno', tecnico_responsable_id: tecPedro,
  tipo_mantenimiento: 'correctivo', prioridad: 'media', criticidad: 'alta', estado: 'pausada',
  estado_planificacion: 'bloqueado', horas_estimadas: 10, tecnicos_requeridos: 2, especialidad: 'mecanica',
  motivo_bloqueo: 'esperando_compra', antiguedad: '-20 days', actualizado: '-4 days',
  created_by: userId['jorge.nunez@taller.local'],
});

// OT pendiente de asignación (recién creada)
crearOT({
  aviso_id: avParaOT.id, aviso_sap: '10045990', ot_sap: '40001270', equipo_id: equipoId['COS-04'],
  area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Galpón 2', tipo_mantenimiento: 'correctivo',
  prioridad: 'alta', criticidad: 'critica', estado: 'pendiente_asignacion',
  estado_planificacion: 'listo_planificar', horas_estimadas: 8, tecnicos_requeridos: 2, especialidad: 'electrica',
  antiguedad: '-5 days', actualizado: '-5 days', created_by: userId['lucia.fernandez@taller.local'],
});
run('UPDATE aviso SET estado = ? WHERE id = ?', 'ot_creada', avParaOT.id);

// OT concluida (va al historial, fuera del backlog)
const avOT5 = crearAviso({
  equipo_id: equipoId['TR-208'], area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Patio A',
  sintoma: 'Cambio de filtros', descripcion: 'Mantenimiento preventivo de 500 horas.',
  tipo_aviso: 'preventivo', prioridad: 'baja', criticidad: 'baja', estado: 'concluido',
  solicitante_id: sol, antiguedad: '-30 days',
});
const otConcl = crearOT({
  aviso_id: avOT5.id, aviso_sap: '10045700', ot_sap: '40001199', equipo_id: equipoId['TR-208'],
  area_id: areaId['Maquinaria Agrícola'], ubicacion: 'Patio A', tecnico_responsable_id: tecPedro,
  tipo_mantenimiento: 'preventivo', prioridad: 'baja', criticidad: 'baja', estado: 'concluida',
  estado_planificacion: 'en_ejecucion', horas_estimadas: 3, tecnicos_requeridos: 1, especialidad: 'mecanica',
  trabajo_realizado: 'Se reemplazaron filtros de aceite, aire y combustible. Equipo operativo.',
  condicion_final: 'Operativo', antiguedad: '-30 days', actualizado: '-25 days',
  created_by: userId['lucia.fernandez@taller.local'],
});
run("UPDATE orden SET fecha_conclusion = datetime('now','-25 days'), fecha_cierre_sap = datetime('now','-26 days') WHERE id = ?", otConcl.id);
// Tiempos de la OT concluida
run(`INSERT INTO tiempo (orden_id, tecnico_id, actividad, fecha, duracion_horas, observaciones, created_at)
     VALUES (?,?,?, date('now','-26 days'), ?, ?, datetime('now','-26 days'))`,
  otConcl.id, tecPedro, 'trabajo', 2.5, 'Cambio de filtros');
run(`INSERT INTO tiempo (orden_id, tecnico_id, actividad, fecha, duracion_horas, observaciones, created_at)
     VALUES (?,?,?, date('now','-26 days'), ?, ?, datetime('now','-26 days'))`,
  otConcl.id, tecPedro, 'traslados', 0.5, 'Traslado a patio');

// Capacidad de ejemplo por área (semana actual)
for (const nombre of areas) {
  run(
    `INSERT INTO capacidad (area_id, semana, tecnicos_activos, horas_por_turno, dias_laborables, capacidad_disponible)
     VALUES (?, strftime('%Y-W%W','now'), ?, ?, ?, ?)`,
    areaId[nombre], 2, 8, 5, 160,
  );
}

console.log('✅ Seed completado:');
console.log(`   Catálogos, ${areas.length} áreas, ${usuarios.length} usuarios, ${equipos.length} equipos.`);
console.log(`   ${avSeq} avisos y ${otSeq} órdenes de trabajo de ejemplo.`);

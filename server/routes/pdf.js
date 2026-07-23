// =====================================================================
//  Generación de PDF de la OT (sección 19). Usa PDFKit (sin nube).
//  Tipos: inicial (19.1), ejecución (19.2), final (19.3).
// =====================================================================
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { all, get } from '../db/index.js';
import { ApiError } from '../lib/helpers.js';

const router = Router();

const AZUL = '#1F3864';
const GRIS = '#555555';
const fmt = (v) => (v == null || v === '' ? '—' : String(v));
const fmtFecha = (v) => (v ? new Date(v.replace(' ', 'T') + 'Z').toLocaleString('es-PE') : '—');

router.get('/orden/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const tipo = req.query.tipo || 'final'; // inicial | ejecucion | final
  const o = get(`
    SELECT o.*, e.codigo AS equipo_codigo, e.descripcion AS equipo_desc, e.modelo,
           ar.nombre AS area, tr.nombre AS tecnico_responsable,
           pr.etiqueta AS prioridad_label, es.etiqueta AS estado_label,
           tm.etiqueta AS tipo_mant_label, av.codigo AS aviso_codigo
    FROM orden o
    LEFT JOIN equipo e ON e.id=o.equipo_id
    LEFT JOIN area ar ON ar.id=o.area_id
    LEFT JOIN usuario tr ON tr.id=o.tecnico_responsable_id
    LEFT JOIN catalogo pr ON pr.tipo='prioridad' AND pr.codigo=o.prioridad
    LEFT JOIN catalogo es ON es.tipo='estado_ot' AND es.codigo=o.estado
    LEFT JOIN catalogo tm ON tm.tipo='tipo_mantenimiento' AND tm.codigo=o.tipo_mantenimiento
    LEFT JOIN aviso av ON av.id=o.aviso_id
    WHERE o.id=?`, id);
  if (!o) return next(new ApiError(404, 'OT no encontrada.'));

  const tecnicos = all(`SELECT u.nombre FROM orden_tecnico ot JOIN usuario u ON u.id=ot.usuario_id WHERE ot.orden_id=?`, id);
  const materiales = all(`SELECT * FROM material_solicitud WHERE orden_id=?`, id);
  const tiempos = all(`SELECT t.*, u.nombre AS tecnico FROM tiempo t LEFT JOIN usuario u ON u.id=t.tecnico_id WHERE t.orden_id=?`, id);
  const cierre = get(`SELECT * FROM cierre WHERE orden_id=? ORDER BY created_at DESC LIMIT 1`, id);
  const firma = get(`SELECT * FROM firma WHERE orden_id=? ORDER BY created_at DESC LIMIT 1`, id);
  const totalHoras = tiempos.reduce((s, t) => s + (t.duracion_horas || 0), 0);
  const version = firma?.version || 1;

  const filename = `OT_${fmt(o.ot_sap || o.codigo)}_${(o.equipo_desc || 'equipo').replace(/[^A-Za-z0-9]/g, '_')}_V${String(version).padStart(2, '0')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  // --- Encabezado ---
  doc.rect(0, 0, doc.page.width, 90).fill(AZUL);
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
    .text('ORDEN DE TRABAJO', 50, 30);
  doc.fontSize(10).font('Helvetica')
    .text('Mantenimiento Industrial — Taller', 50, 55);
  const tituloTipo = { inicial: 'Reporte inicial', ejecucion: 'Reporte de ejecución', final: 'Reporte final' }[tipo] || 'Reporte';
  doc.fontSize(11).font('Helvetica-Bold').text(tituloTipo, 50, 30, { align: 'right', width: doc.page.width - 100 });
  doc.fontSize(9).font('Helvetica').text(o.codigo, 50, 48, { align: 'right', width: doc.page.width - 100 });
  doc.fontSize(9).text('OT SAP: ' + fmt(o.ot_sap), 50, 62, { align: 'right', width: doc.page.width - 100 });

  doc.fillColor('black');
  let y = 110;

  const seccion = (titulo) => {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#DDDDDD').stroke();
    y += 8;
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text(titulo, 50, y);
    y += 20;
    doc.fillColor('black').font('Helvetica').fontSize(10);
  };
  const campo = (label, valor) => {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(9).text(label, 50, y, { continued: false });
    doc.fillColor('black').font('Helvetica').fontSize(10).text(fmt(valor), 200, y, { width: doc.page.width - 250 });
    y = doc.y + 6;
  };

  // --- Datos generales ---
  seccion('Datos de la orden');
  campo('Equipo', `${fmt(o.equipo_codigo)} — ${fmt(o.equipo_desc)}`);
  campo('Modelo', o.modelo);
  campo('Área', o.area);
  campo('Ubicación', o.ubicacion);
  campo('Prioridad', o.prioridad_label);
  campo('Tipo de mantenimiento', o.tipo_mant_label);
  campo('Estado', o.estado_label);
  campo('Técnico responsable', o.tecnico_responsable);
  if (tecnicos.length) campo('Técnicos participantes', tecnicos.map((t) => t.nombre).join(', '));
  campo('Aviso relacionado', o.aviso_codigo);
  campo('Fecha de creación', fmtFecha(o.fecha_creacion));
  campo('Fecha requerida', fmtFecha(o.fecha_requerida));

  if (tipo === 'final' || tipo === 'ejecucion') {
    // --- Diagnóstico y ejecución ---
    seccion('Diagnóstico y trabajo realizado');
    campo('Trabajo realizado', o.trabajo_realizado);
    if (cierre) {
      campo('Diagnóstico final', cierre.diagnostico_final);
      campo('Causa', cierre.causa);
      campo('Trabajo pendiente', cierre.trabajo_pendiente);
      campo('Recomendaciones', cierre.recomendacion);
    }
    campo('Condición final', o.condicion_final);

    // --- Materiales ---
    seccion('Materiales');
    if (!materiales.length) { doc.text('Sin solicitudes de materiales.', 50, y); y += 16; }
    for (const m of materiales) {
      campo(m.codigo, `${fmt(m.descripcion_libre)} — ${fmt(m.cantidad_aprox)} ${fmt(m.unidad)} · ${fmt(m.estado)}${m.numero_reserva ? ' · Reserva ' + m.numero_reserva : ''}`);
    }

    // --- Tiempos ---
    seccion('Registro de tiempos');
    for (const t of tiempos) {
      campo(fmtFecha(t.fecha || t.created_at).split(',')[0], `${fmt(t.actividad)} — ${fmt(t.duracion_horas)} h (${fmt(t.tecnico)})`);
    }
    campo('Total horas', totalHoras.toFixed(2) + ' h');
  }

  if (tipo === 'final') {
    // --- Validación y firma ---
    seccion('Validación y firma del supervisor');
    if (firma) {
      campo('Validado por', firma.nombre);
      campo('Cargo', firma.cargo);
      campo('Correo', firma.correo);
      campo('Identificador Entra ID', firma.entra_id);
      campo('Código de documento', firma.codigo_documento);
      campo('Versión', 'V' + String(firma.version).padStart(2, '0'));
      campo('Fecha de firma', fmtFecha(firma.created_at));
      if (firma.observacion) campo('Observación', firma.observacion);
      // Imagen de la firma manuscrita
      if (firma.firma_data && firma.firma_data.startsWith('data:image')) {
        try {
          const b64 = firma.firma_data.split(',')[1];
          const buf = Buffer.from(b64, 'base64');
          if (y > 640) { doc.addPage(); y = 50; }
          doc.fillColor(GRIS).fontSize(9).font('Helvetica-Bold').text('Firma:', 50, y); y += 14;
          doc.image(buf, 50, y, { fit: [200, 80] });
          y += 90;
          doc.strokeColor('#999999').moveTo(50, y).lineTo(250, y).stroke();
          y += 6;
          doc.fillColor('black').fontSize(9).text(firma.nombre, 50, y);
        } catch { /* firma no renderizable */ }
      }
    } else {
      doc.fillColor('#C00000').text('Pendiente de validación y firma del supervisor.', 50, y);
    }
  }

  // Pie
  doc.fontSize(8).fillColor('#999999')
    .text(`Documento generado el ${new Date().toLocaleString('es-PE')} · ${filename}`, 50, 800, {
      align: 'center', width: doc.page.width - 100,
    });

  doc.end();
});

export default router;

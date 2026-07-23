import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PrioridadBadge, EstadoBadge, Spinner, Empty, fmtFechaCorta } from '../components/ui.jsx';

// Historial: OT concluidas y anuladas (fuera del backlog activo).
export default function Historial() {
  const [rows, setRows] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api.get('/ordenes?activas=0').then(setRows).catch(() => setRows([])); }, []);

  return (
    <div>
      <div className="alert-banner" style={{ background: 'rgba(67,160,71,.1)', borderColor: 'var(--verde)', color: 'var(--text)' }}>
        🗄️ Órdenes concluidas y anuladas. Nunca se eliminan definitivamente (regla crítica 38); una OT concluida requiere reapertura autorizada para modificarse.
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon="🗄️">Aún no hay OT en el historial.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>OT SAP</th><th>Equipo</th><th>Área</th><th>Prioridad</th><th>Estado</th><th>Concluida</th><th>PDF</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="row-click" onClick={() => nav('/ordenes/' + o.id)}>
                  <td className="mono">{o.codigo}</td>
                  <td className="mono">{o.ot_sap || '—'}</td>
                  <td>{o.equipo_desc}</td>
                  <td>{o.area}</td>
                  <td><PrioridadBadge codigo={o.prioridad} label={o.prioridad_label} /></td>
                  <td><EstadoBadge label={o.estado_label} /></td>
                  <td className="muted">{fmtFechaCorta(o.fecha_conclusion)}</td>
                  <td onClick={(e) => e.stopPropagation()}><a className="btn btn-sm" href={`/api/pdf/orden/${o.id}?tipo=final`} target="_blank" rel="noreferrer">📄</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

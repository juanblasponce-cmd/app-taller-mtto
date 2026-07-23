import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { EstadoBadge, Spinner, Empty, hace } from '../components/ui.jsx';

// Bandeja de materiales del Gestor Enlace SAP (sección 13).
export default function Materiales() {
  const [items, setItems] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api.get('/materiales/bandeja').then(setItems).catch(() => setItems([])); }, []);

  return (
    <div>
      <div className="alert-banner" style={{ background: 'rgba(37,99,235,.08)', borderColor: 'var(--azul-acc)', color: 'var(--text)' }}>
        📦 Solicitudes de material que requieren búsqueda del código real, consulta de stock y creación de reserva en SAP.
      </div>
      {!items ? <Spinner /> : items.length === 0 ? <Empty icon="✅">No hay solicitudes pendientes.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>OT</th><th>Descripción</th><th>Cant.</th><th>Solicitante</th><th>Estado</th><th>Solicitado</th></tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="row-click" onClick={() => nav('/ordenes/' + m.orden_id)}>
                  <td className="mono">{m.codigo}</td>
                  <td className="mono">{m.ot_codigo}</td>
                  <td>{m.descripcion_libre}</td>
                  <td>{m.cantidad_aprox} {m.unidad}</td>
                  <td>{m.solicitante}</td>
                  <td><EstadoBadge label={m.estado_label} /></td>
                  <td className="muted">{hace(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

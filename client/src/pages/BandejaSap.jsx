import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { PrioridadBadge, EstadoBadge, Spinner, Empty, hace } from '../components/ui.jsx';

// Bandeja del Gestor Enlace SAP: avisos validados pendientes de registro/OT (sección 9).
export default function BandejaSap() {
  const [avisos, setAvisos] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api.get('/avisos/bandeja/sap').then(setAvisos).catch(() => setAvisos([])); }, []);

  return (
    <div>
      <div className="alert-banner" style={{ background: 'rgba(37,99,235,.08)', borderColor: 'var(--azul-acc)', color: 'var(--text)' }}>
        🗂️ Gestión manual con SAP. Registra los avisos en SAP y crea las OT. Los números SAP no deben duplicarse.
      </div>
      {!avisos ? <Spinner /> : avisos.length === 0 ? <Empty icon="✅">No hay avisos pendientes de SAP.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Equipo</th><th>Síntoma</th><th>Área</th><th>Prioridad</th><th>Estado</th><th>Aprobado</th></tr></thead>
            <tbody>
              {avisos.map((a) => (
                <tr key={a.id} className="row-click" onClick={() => nav('/avisos/' + a.id)}>
                  <td className="mono">{a.codigo}</td>
                  <td>{a.equipo_desc || 'Equipo desconocido'}</td>
                  <td>{a.sintoma}</td>
                  <td>{a.area}</td>
                  <td><PrioridadBadge codigo={a.prioridad} label={a.prioridad_label} /></td>
                  <td><EstadoBadge label={a.estado_label} /></td>
                  <td className="muted">{hace(a.fecha_aprobacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

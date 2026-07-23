import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Spinner, Empty, useToast, hace } from '../components/ui.jsx';

// Alertas automáticas de OT sin movimiento (sección 15).
const OPCIONES = [
  { l: 'Continúa en ejecución', estado: 'en_ejecucion' },
  { l: 'Esperando materiales', estado: 'esperando_materiales' },
  { l: 'Equipo no disponible', estado: 'pausada' },
  { l: 'Trabajo detenido', estado: 'trabajo_detenido' },
  { l: 'En pruebas', estado: 'en_pruebas' },
];

export default function Alertas() {
  const [alertas, setAlertas] = useState(null);
  const toast = useToast();
  const nav = useNavigate();

  const cargar = () => api.get('/alertas').then(setAlertas).catch(() => setAlertas([]));
  useEffect(() => { cargar(); }, []);

  const responder = async (a, opt) => {
    try { await api.post(`/alertas/${a.id}/responder`, { respuesta: opt.l, nuevo_estado: opt.estado }); toast('Alerta respondida.'); cargar(); }
    catch (e) { toast(e.message, 'err'); }
  };
  const ejecutar = () => api.post('/alertas/ejecutar').then(() => { toast('Flujo de alertas ejecutado.'); setTimeout(cargar, 500); }).catch(() => {});

  if (!alertas) return <Spinner />;

  return (
    <div>
      <div className="flex between center" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Power Automate ejecuta este flujo cada hora. Aquí puedes forzarlo para probar.</p>
        <button className="btn btn-sm" onClick={ejecutar}>▶️ Ejecutar flujo</button>
      </div>
      {alertas.length === 0 ? <Empty icon="🔔">No tienes alertas pendientes.</Empty> : (
        <div className="grid" style={{ gap: 12 }}>
          {alertas.map((a) => (
            <div key={a.id} className="card card-pad" style={{ borderLeft: '4px solid var(--amarillo)' }}>
              <div className="flex between center" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b onClick={() => nav('/ordenes/' + a.orden_id)} style={{ cursor: 'pointer' }}>{a.ot_codigo}</b>
                  <span className="muted"> · {hace(a.created_at)}</span>
                  <div>{a.mensaje}</div>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                {OPCIONES.map((o) => <button key={o.l} className="btn btn-sm" onClick={() => responder(a, o)}>{o.l}</button>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

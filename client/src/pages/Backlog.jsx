import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api.js';
import { useCatalogos } from '../lib/catalogos.jsx';
import { PrioridadBadge, EstadoBadge, EtapaBadge, Spinner, Empty, useToast } from '../components/ui.jsx';

function Stat({ v, l, tone }) {
  return <div className={`stat ${tone || ''}`}><div className="accent" /><div className="v">{v}</div><div className="l">{l}</div></div>;
}

export default function Backlog() {
  const [resumen, setResumen] = useState(null);
  const [rows, setRows] = useState(null);
  const [graficos, setGraficos] = useState(null);
  const [f, setF] = useState({ etapa: '', prioridad: '', busqueda: '', vencido: '', sin_asignar: '' });
  const { list } = useCatalogos();
  const toast = useToast();
  const nav = useNavigate();

  const cargar = () => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
    api.get('/backlog?' + qs.toString()).then(setRows).catch(() => setRows([]));
  };
  useEffect(() => {
    api.get('/backlog/resumen').then(setResumen).catch(() => {});
    api.get('/backlog/graficos').then(setGraficos).catch(() => {});
  }, []);
  useEffect(cargar, [f]);

  const corte = () => api.post('/backlog/corte', { periodo: 'diario' }).then(() => toast('Corte histórico generado.')).catch((e) => toast(e.message, 'err'));

  if (!resumen) return <Spinner />;

  return (
    <div>
      <div className="grid stat-grid" style={{ marginBottom: 20 }}>
        <Stat v={resumen.backlog_total} l="Trabajos en backlog" tone="blue" />
        <Stat v={resumen.avisos_backlog} l="En avisos" tone="blue" />
        <Stat v={resumen.ot_backlog} l="En órdenes" tone="blue" />
        <Stat v={resumen.horas_pendientes + ' h'} l="Horas pendientes" tone="yellow" />
        <Stat v={resumen.semanas_backlog ?? '—'} l="Semanas de backlog" tone="yellow" />
        <Stat v={resumen.prioridad_alta} l="Prioridad alta" tone="red" />
        <Stat v={resumen.trabajos_vencidos} l="Vencidos" tone="red" />
        <Stat v={resumen.sin_asignar} l="Sin asignar" tone="yellow" />
        <Stat v={resumen.esperando_materiales} l="Esperando materiales" tone="yellow" />
        <Stat v={resumen.sin_estimacion} l="Sin estimación" tone="red" />
        <Stat v={resumen.antiguedad_promedio + ' d'} l="Antigüedad prom." tone="blue" />
        <Stat v={resumen.antiguedad_maxima + ' d'} l="Más antiguo" tone="red" />
      </div>

      {graficos && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
          <div className="card card-pad">
            <h3 className="section-title">Backlog por antigüedad</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={graficos.por_antiguedad}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nombre" stroke="var(--text-soft)" fontSize={10} />
                <YAxis allowDecimals={false} stroke="var(--text-soft)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <Bar dataKey="valor" fill="#F9A825" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Backlog por área</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={graficos.por_area} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} stroke="var(--text-soft)" fontSize={12} />
                <YAxis type="category" dataKey="nombre" width={120} stroke="var(--text-soft)" fontSize={10} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <Bar dataKey="valor" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="toolbar">
        <input className="grow" placeholder="🔎 Buscar…" value={f.busqueda} onChange={(e) => setF((p) => ({ ...p, busqueda: e.target.value }))} />
        <select value={f.etapa} onChange={(e) => setF((p) => ({ ...p, etapa: e.target.value }))}>
          <option value="">Toda etapa</option><option>Aviso</option><option>Orden de Trabajo</option>
        </select>
        <select value={f.prioridad} onChange={(e) => setF((p) => ({ ...p, prioridad: e.target.value }))}>
          <option value="">Toda prioridad</option>
          {list('prioridad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
        <label className="btn btn-sm" style={{ gap: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.vencido === '1'} onChange={(e) => setF((p) => ({ ...p, vencido: e.target.checked ? '1' : '' }))} /> Vencidos</label>
        <label className="btn btn-sm" style={{ gap: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.sin_asignar === '1'} onChange={(e) => setF((p) => ({ ...p, sin_asignar: e.target.checked ? '1' : '' }))} /> Sin asignar</label>
        <button className="btn btn-sm" onClick={corte}>📸 Generar corte</button>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon="📚">Backlog vacío con esos filtros.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Etapa</th><th>Código</th><th>Equipo</th><th>Área</th><th>Prioridad</th>
              <th>Estado</th><th>Antig.</th><th>Hrs rest.</th><th>Motivo espera</th><th>Próx. acción</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tipo + r.id} className="row-click" onClick={() => nav((r.tipo === 'orden' ? '/ordenes/' : '/avisos/') + r.id)}>
                  <td><EtapaBadge etapa={r.etapa} /></td>
                  <td className="mono">{r.codigo}{r.ot_sap && <div className="muted" style={{ fontSize: 11 }}>SAP {r.ot_sap}</div>}</td>
                  <td>{r.equipo || '—'}</td>
                  <td>{r.area || '—'}</td>
                  <td><PrioridadBadge codigo={r.prioridad} label={r.prioridad_label} /></td>
                  <td><EstadoBadge label={r.estado_label} /></td>
                  <td><span className={r.antiguedad > 30 ? 'badge badge-prio-alta' : ''}>{r.antiguedad} d</span></td>
                  <td>{r.horas_restantes} h</td>
                  <td className="muted">{r.motivo_espera || '—'}</td>
                  <td className="muted">{r.tecnico || (r.sin_asignar ? 'Asignar' : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

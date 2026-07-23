import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { api } from '../lib/api.js';
import { Spinner } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

function Stat({ v, l, tone, onClick }) {
  return (
    <div className={`stat ${tone || ''}`} style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="accent" /><div className="v">{v}</div><div className="l">{l}</div>
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [bl, setBl] = useState(null);
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api.get('/dashboard').then(setD).catch(() => {});
    api.get('/backlog/resumen').then(setBl).catch(() => {});
  }, []);

  if (!d) return <Spinner />;
  const i = d.indicadores;
  const COLORS = ['#2563EB', '#F9A825', '#43A047', '#E53935', '#7C3AED', '#0891B2', '#64748B'];

  return (
    <div>
      <div className="alert-banner" style={{ background: 'rgba(37,99,235,.08)', borderColor: 'var(--azul-acc)', color: 'var(--text)' }}>
        👋 Bienvenido, <b>{user.nombre}</b>. Este es el panel operativo del taller.
      </div>

      <h3 className="section-title">📣 Avisos</h3>
      <div className="grid stat-grid" style={{ marginBottom: 22 }}>
        <Stat v={i.avisos_pendientes} l="Pendientes de validación" tone="yellow" onClick={() => nav('/avisos?estado=pendiente_validacion')} />
        <Stat v={i.avisos_observados} l="Observados" tone="yellow" onClick={() => nav('/avisos?estado=observado')} />
        <Stat v={i.avisos_pendientes_sap} l="Pendientes de SAP" tone="blue" onClick={() => nav('/avisos')} />
      </div>

      <h3 className="section-title">🔧 Órdenes de Trabajo</h3>
      <div className="grid stat-grid" style={{ marginBottom: 22 }}>
        <Stat v={i.ot_abiertas} l="OT abiertas" tone="blue" onClick={() => nav('/ordenes?activas=1')} />
        <Stat v={i.ot_en_ejecucion} l="En ejecución" tone="green" onClick={() => nav('/ordenes?estado=en_ejecucion')} />
        <Stat v={i.ot_esperando_materiales} l="Esperando materiales" tone="yellow" onClick={() => nav('/ordenes?estado=esperando_materiales')} />
        <Stat v={i.ot_pausadas} l="Pausadas / detenidas" tone="yellow" />
        <Stat v={i.ot_prioridad_alta} l="Prioridad alta" tone="red" onClick={() => nav('/ordenes?prioridad=alta')} />
        <Stat v={i.ot_sin_actualizacion} l="Sin actualización (>24h)" tone="red" />
        <Stat v={i.ot_pendientes_firma} l="Pendientes de firma" tone="blue" />
        <Stat v={i.ot_concluidas} l="Concluidas (histórico)" tone="green" onClick={() => nav('/historial')} />
      </div>

      {bl && (
        <>
          <h3 className="section-title">📚 Backlog</h3>
          <div className="grid stat-grid" style={{ marginBottom: 22 }}>
            <Stat v={bl.backlog_total} l="Trabajos en backlog" tone="blue" onClick={() => nav('/backlog')} />
            <Stat v={bl.horas_pendientes + ' h'} l="Horas hombre pendientes" tone="blue" />
            <Stat v={bl.semanas_backlog ?? '—'} l="Semanas de backlog" tone="yellow" />
            <Stat v={bl.trabajos_vencidos} l="Vencidos" tone="red" />
            <Stat v={bl.antiguedad_promedio + ' d'} l="Antigüedad promedio" tone="yellow" />
          </div>
        </>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: 8 }}>
        <div className="card card-pad">
          <h3 className="section-title">OT activas por estado</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.ot_por_estado} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" allowDecimals={false} stroke="var(--text-soft)" fontSize={12} />
              <YAxis type="category" dataKey="nombre" width={130} stroke="var(--text-soft)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <Bar dataKey="valor" fill="#2563EB" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card card-pad">
          <h3 className="section-title">OT por prioridad</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={d.ot_por_prioridad} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" outerRadius={95} label>
                {d.ot_por_prioridad.map((e, idx) => <Cell key={idx} fill={e.color || COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h3 className="section-title">🔩 Equipos con más fallas</h3>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table>
            <thead><tr><th>Código</th><th>Equipo</th><th className="right">Fallas</th></tr></thead>
            <tbody>
              {d.equipos_fallas.map((e) => (
                <tr key={e.codigo}><td className="mono">{e.codigo}</td><td>{e.descripcion}</td><td className="right"><b>{e.fallas}</b></td></tr>
              ))}
              {!d.equipos_fallas.length && <tr><td colSpan={3} className="muted">Sin datos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 22, fontSize: 12 }}>
        Tiempo promedio de atención: <b>{i.tiempo_promedio_atencion} h</b> · Horas hombre registradas: <b>{i.horas_hombre} h</b>
      </p>
    </div>
  );
}

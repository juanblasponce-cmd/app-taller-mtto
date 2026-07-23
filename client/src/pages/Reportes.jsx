import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { api } from '../lib/api.js';
import { Spinner } from '../components/ui.jsx';

// Reportes: capacidad vs demanda y cortes históricos (secciones 26, 33, 35).
export default function Reportes() {
  const [cap, setCap] = useState(null);
  const [cortes, setCortes] = useState(null);
  const [graficos, setGraficos] = useState(null);

  useEffect(() => {
    api.get('/backlog/capacidad').then(setCap).catch(() => setCap([]));
    api.get('/backlog/cortes').then(setCortes).catch(() => setCortes([]));
    api.get('/backlog/graficos').then(setGraficos).catch(() => {});
  }, []);

  if (!cap) return <Spinner />;
  const cortesData = (cortes || []).slice().reverse().map((c) => ({
    fecha: new Date(c.fecha.replace(' ', 'T') + 'Z').toLocaleDateString('es-PE'),
    total: c.total_trabajos, horas: c.horas_pendientes, semanas: c.semanas_backlog,
  }));

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <h3 className="section-title">📊 Capacidad vs. demanda por área (semanas de backlog)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={cap} margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="area" stroke="var(--text-soft)" fontSize={11} angle={-15} textAnchor="end" height={60} />
            <YAxis stroke="var(--text-soft)" fontSize={12} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
            <Legend />
            <Bar dataKey="capacidad" name="Capacidad (h/sem)" fill="#43A047" radius={[4, 4, 0, 0]} />
            <Bar dataKey="demanda" name="Demanda (h pend.)" fill="#E53935" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="table-wrap" style={{ border: 'none', marginTop: 12 }}>
          <table><thead><tr><th>Área</th><th>Capacidad (h/sem)</th><th>Demanda (h)</th><th>Semanas backlog</th><th>Trabajos</th></tr></thead>
            <tbody>{cap.map((c) => (
              <tr key={c.area}><td>{c.area}</td><td>{c.capacidad}</td><td>{c.demanda}</td>
                <td><b>{c.semanas_backlog ?? '—'}</b></td><td>{c.trabajos}</td></tr>
            ))}</tbody></table>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">📈 Evolución histórica del backlog</h3>
        {cortesData.length < 2 ? (
          <p className="muted">Genera cortes desde la pantalla de Backlog para ver la tendencia (se necesitan al menos 2).</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cortesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="fecha" stroke="var(--text-soft)" fontSize={11} />
              <YAxis stroke="var(--text-soft)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <Legend />
              <Line type="monotone" dataKey="total" name="Trabajos" stroke="#2563EB" strokeWidth={2} />
              <Line type="monotone" dataKey="horas" name="Horas pend." stroke="#F9A825" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

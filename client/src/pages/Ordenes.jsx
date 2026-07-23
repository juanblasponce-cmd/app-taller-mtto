import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCatalogos } from '../lib/catalogos.jsx';
import { PrioridadBadge, EstadoBadge, Spinner, Empty, hace } from '../components/ui.jsx';

export default function Ordenes() {
  const [params, setParams] = useSearchParams();
  const [ordenes, setOrdenes] = useState(null);
  const { user } = useAuth();
  const { list } = useCatalogos();
  const nav = useNavigate();

  const filtros = ['estado', 'prioridad', 'area_id', 'activas', 'q'];
  const val = (k) => params.get(k) || '';
  const soloMias = val('mias') === '1' || user.rol === 'tecnico';

  const cargar = () => {
    setOrdenes(null);
    if (soloMias) { api.get('/ordenes/mias/lista').then(setOrdenes).catch(() => setOrdenes([])); return; }
    const qs = new URLSearchParams();
    for (const k of filtros) if (val(k)) qs.set(k, val(k));
    api.get('/ordenes?' + qs.toString()).then(setOrdenes).catch(() => setOrdenes([]));
  };
  useEffect(cargar, [params.toString(), user.rol]);

  const setF = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p); };

  return (
    <div>
      <div className="toolbar">
        <input className="grow" placeholder="🔎 Código, OT SAP, equipo…" defaultValue={val('q')}
          onKeyDown={(e) => e.key === 'Enter' && setF('q', e.target.value)} />
        <select value={val('estado')} onChange={(e) => setF('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          {list('estado_ot').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
        <select value={val('prioridad')} onChange={(e) => setF('prioridad', e.target.value)}>
          <option value="">Toda prioridad</option>
          {list('prioridad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
        <select value={val('activas')} onChange={(e) => setF('activas', e.target.value)}>
          <option value="">Activas e históricas</option>
          <option value="1">Solo activas</option>
          <option value="0">Solo históricas</option>
        </select>
        {user.rol !== 'tecnico' && (
          <label className="btn btn-sm" style={{ gap: 6 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={val('mias') === '1'} onChange={(e) => setF('mias', e.target.checked ? '1' : '')} /> Mías
          </label>
        )}
      </div>

      {!ordenes ? <Spinner /> : ordenes.length === 0 ? <Empty icon="🔧">No hay órdenes con esos filtros.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Código</th><th>OT SAP</th><th>Equipo</th><th>Área</th><th>Técnico</th>
              <th>Prioridad</th><th>Estado</th><th>Horas</th><th>Actualizada</th>
            </tr></thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id} className="row-click" onClick={() => nav('/ordenes/' + o.id)}>
                  <td className="mono">{o.codigo}</td>
                  <td className="mono">{o.ot_sap || '—'}</td>
                  <td>{o.equipo_desc}</td>
                  <td>{o.area}</td>
                  <td>{o.tecnico_responsable || <span className="muted">Sin asignar</span>}</td>
                  <td><PrioridadBadge codigo={o.prioridad} label={o.prioridad_label} /></td>
                  <td><EstadoBadge label={o.estado_label} /></td>
                  <td className="muted">{(o.horas_ejecutadas ?? 0)}/{o.horas_estimadas ?? '—'}</td>
                  <td className="muted">{hace(o.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

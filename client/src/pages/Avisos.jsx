import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCatalogos } from '../lib/catalogos.jsx';
import { PrioridadBadge, EstadoBadge, Spinner, Empty, Modal, Field, useToast, hace } from '../components/ui.jsx';

const PUEDE_CREAR = ['supervisor', 'administrador'];

export default function Avisos() {
  const [params, setParams] = useSearchParams();
  const [avisos, setAvisos] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const { user } = useAuth();
  const { list, label } = useCatalogos();
  const nav = useNavigate();

  const estado = params.get('estado') || '';
  const prioridad = params.get('prioridad') || '';
  const q = params.get('q') || '';

  const cargar = () => {
    const qs = new URLSearchParams();
    if (estado) qs.set('estado', estado);
    if (prioridad) qs.set('prioridad', prioridad);
    if (q) qs.set('q', q);
    setAvisos(null);
    api.get('/avisos?' + qs.toString()).then(setAvisos).catch(() => setAvisos([]));
  };
  useEffect(cargar, [estado, prioridad, q]);

  const setFiltro = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p); };

  return (
    <div>
      <div className="toolbar">
        <input className="grow" placeholder="🔎 Buscar por código, síntoma…" defaultValue={q}
          onKeyDown={(e) => e.key === 'Enter' && setFiltro('q', e.target.value)} />
        <select value={estado} onChange={(e) => setFiltro('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          {list('estado_aviso').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
        <select value={prioridad} onChange={(e) => setFiltro('prioridad', e.target.value)}>
          <option value="">Toda prioridad</option>
          {list('prioridad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
        {PUEDE_CREAR.includes(user.rol) && (
          <button className="btn btn-primary" onClick={() => setNuevo(true)}>＋ Nuevo aviso</button>
        )}
      </div>

      {!avisos ? <Spinner /> : avisos.length === 0 ? <Empty icon="📣">No hay avisos con esos filtros.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Código</th><th>Equipo</th><th>Síntoma</th><th>Área</th>
              <th>Prioridad</th><th>Estado</th><th>Creado</th>
            </tr></thead>
            <tbody>
              {avisos.map((a) => (
                <tr key={a.id} className="row-click" onClick={() => nav('/avisos/' + a.id)}>
                  <td className="mono">{a.codigo}</td>
                  <td>{a.equipo_desc || <span className="muted">Equipo desconocido</span>}</td>
                  <td>{a.sintoma}</td>
                  <td>{a.area}</td>
                  <td><PrioridadBadge codigo={a.prioridad} label={a.prioridad_label} /></td>
                  <td><EstadoBadge label={a.estado_label} /></td>
                  <td className="muted">{hace(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nuevo && <NuevoAviso onClose={() => setNuevo(false)} onDone={() => { setNuevo(false); cargar(); }} />}
    </div>
  );
}

function NuevoAviso({ onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [equipos, setEquipos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [desconocido, setDesconocido] = useState(false);
  const [f, setF] = useState({ prioridad: 'media', tipo_aviso: '', criticidad: 'media' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/equipos').then(setEquipos).catch(() => {});
    api.get('/areas').then(setAreas).catch(() => {});
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const guardar = async (enviar) => {
    if (!f.sintoma) return toast('Indica el síntoma.', 'err');
    if (desconocido && !f.centro_coste) return toast('Indica el centro de coste para equipo desconocido.', 'err');
    setBusy(true);
    try {
      await api.post('/avisos', { ...f, equipo_desconocido: desconocido, enviar });
      toast(enviar ? 'Aviso enviado a validación.' : 'Borrador guardado.');
      onDone();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const geo = () => {
    if (!navigator.geolocation) return toast('Geolocalización no disponible.', 'err');
    navigator.geolocation.getCurrentPosition(
      (p) => { set('geo_lat', p.coords.latitude); set('geo_lng', p.coords.longitude); toast('Ubicación capturada.'); },
      () => toast('No se pudo obtener la ubicación.', 'err'));
  };

  return (
    <Modal title="Nuevo aviso" onClose={onClose} size="lg"
      footer={<>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn" onClick={() => guardar(false)} disabled={busy}>Guardar borrador</button>
        <button className="btn btn-primary" onClick={() => guardar(true)} disabled={busy}>Enviar a validación</button>
      </>}>
      <div className="form-grid">
        <Field label="Equipo">
          <select value={f.equipo_id || ''} disabled={desconocido}
            onChange={(e) => { const id = Number(e.target.value); set('equipo_id', id); const eq = equipos.find((x) => x.id === id); if (eq) { set('area_id', eq.area_id); set('ubicacion', eq.ubicacion); } }}>
            <option value="">Seleccionar…</option>
            {equipos.map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.descripcion}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={desconocido}
              onChange={(e) => { setDesconocido(e.target.checked); if (e.target.checked) set('equipo_id', null); }} />
            <span style={{ margin: 0 }}>Equipo desconocido</span>
          </label>
        </Field>
        <Field label="Área operativa">
          <select value={f.area_id || ''} onChange={(e) => set('area_id', Number(e.target.value))}>
            <option value="">Seleccionar…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Field>
        {desconocido && (
          <Field label="Centro de coste" req>
            <input value={f.centro_coste || ''} onChange={(e) => set('centro_coste', e.target.value)} />
          </Field>
        )}
        <Field label="Ubicación">
          <input value={f.ubicacion || ''} onChange={(e) => set('ubicacion', e.target.value)} />
        </Field>
        <Field label="Síntoma" req>
          <input value={f.sintoma || ''} onChange={(e) => set('sintoma', e.target.value)} placeholder="Qué se observa" />
        </Field>
        <Field label="Tipo de aviso">
          <select value={f.tipo_aviso} onChange={(e) => set('tipo_aviso', e.target.value)}>
            <option value="">Seleccionar…</option>
            {list('tipo_aviso').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
        <Field label="Prioridad sugerida">
          <select value={f.prioridad} onChange={(e) => set('prioridad', e.target.value)}>
            {list('prioridad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
        <Field label="Criticidad">
          <select value={f.criticidad} onChange={(e) => set('criticidad', e.target.value)}>
            {list('criticidad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Descripción">
        <textarea value={f.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="Duración estimada (h)"><input type="number" min="0" step="0.5" value={f.duracion_estimada || ''} onChange={(e) => set('duracion_estimada', Number(e.target.value))} /></Field>
        <Field label="Técnicos estimados"><input type="number" min="1" value={f.tecnicos_estimados || ''} onChange={(e) => set('tecnicos_estimados', Number(e.target.value))} /></Field>
      </div>
      <button type="button" className="btn btn-sm" onClick={geo}>📍 Capturar ubicación GPS</button>
      {f.geo_lat && <span className="chip">📍 {f.geo_lat.toFixed(4)}, {f.geo_lng.toFixed(4)}</span>}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCatalogos } from '../lib/catalogos.jsx';
import { Spinner, Empty, Modal, Field, useToast } from '../components/ui.jsx';

const PUEDE = ['supervisor', 'planificador', 'gestor_sap', 'administrador'];

export default function Equipos() {
  const [equipos, setEquipos] = useState(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const { user } = useAuth();
  const toast = useToast();

  const cargar = () => api.get('/equipos?q=' + encodeURIComponent(q)).then(setEquipos).catch(() => setEquipos([]));
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [q]);

  return (
    <div>
      <div className="toolbar">
        <input className="grow" placeholder="🔎 Código, descripción, modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
        {PUEDE.includes(user.rol) && <button className="btn btn-primary" onClick={() => setModal({})}>＋ Nuevo equipo</button>}
      </div>
      {!equipos ? <Spinner /> : equipos.length === 0 ? <Empty icon="⚙️">Sin equipos.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Descripción</th><th>Modelo</th><th>Ubicación</th><th>Área</th><th>Criticidad</th>{PUEDE.includes(user.rol) && <th></th>}</tr></thead>
            <tbody>
              {equipos.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.codigo}</td><td>{e.descripcion}</td><td>{e.modelo || '—'}</td>
                  <td>{e.ubicacion || '—'}</td><td>{e.area || '—'}</td><td>{e.criticidad || '—'}</td>
                  {PUEDE.includes(user.rol) && <td><button className="btn btn-sm" onClick={() => setModal(e)}>Editar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <EquipoModal equipo={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); cargar(); toast('Equipo guardado.'); }} />}
    </div>
  );
}

function EquipoModal({ equipo, onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [areas, setAreas] = useState([]);
  const [f, setF] = useState({ criticidad: 'media', ...equipo });
  const esNuevo = !equipo.id;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => { api.get('/areas').then(setAreas).catch(() => {}); }, []);
  const guardar = async () => {
    if (!f.codigo || !f.descripcion) return toast('Código y descripción son obligatorios.', 'err');
    try {
      if (esNuevo) await api.post('/equipos', f);
      else await api.put('/equipos/' + equipo.id, f);
      onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title={esNuevo ? 'Nuevo equipo' : 'Editar equipo'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Código" req><input value={f.codigo || ''} disabled={!esNuevo} onChange={(e) => set('codigo', e.target.value)} /></Field>
        <Field label="Modelo"><input value={f.modelo || ''} onChange={(e) => set('modelo', e.target.value)} /></Field>
      </div>
      <Field label="Descripción" req><input value={f.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} /></Field>
      <div className="form-grid">
        <Field label="Ubicación"><input value={f.ubicacion || ''} onChange={(e) => set('ubicacion', e.target.value)} /></Field>
        <Field label="Área">
          <select value={f.area_id || ''} onChange={(e) => set('area_id', Number(e.target.value))}>
            <option value="">Seleccionar…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Field>
        <Field label="Criticidad">
          <select value={f.criticidad || ''} onChange={(e) => set('criticidad', e.target.value)}>
            {list('criticidad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

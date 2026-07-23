import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { ROL_LABEL } from '../lib/auth.jsx';
import { useCatalogos } from '../lib/catalogos.jsx';
import { Spinner, Modal, Field, useToast } from '../components/ui.jsx';

const TABS = [['usuarios', '👤 Usuarios'], ['areas', '🏭 Áreas'], ['catalogos', '📋 Catálogos']];

export default function Admin() {
  const [tab, setTab] = useState('usuarios');
  return (
    <div>
      <div className="toolbar">
        {TABS.map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'usuarios' && <Usuarios />}
      {tab === 'areas' && <Areas />}
      {tab === 'catalogos' && <Catalogos />}
    </div>
  );
}

function Usuarios() {
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(null);
  const toast = useToast();
  const cargar = () => api.get('/usuarios').then(setUsers).catch(() => setUsers([]));
  useEffect(cargar, []);
  if (!users) return <Spinner />;
  return (
    <div>
      <div className="flex between center" style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Usuarios operativos</h3>
        <button className="btn btn-primary" onClick={() => setModal({})}>＋ Nuevo usuario</button>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Área</th><th>Estado</th><th></th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre}</td><td className="muted">{u.correo}</td><td>{ROL_LABEL[u.rol]}</td>
              <td>{u.area || '—'}</td><td>{u.activo ? <span className="badge badge-prio-baja">Activo</span> : <span className="badge badge-estado">Inactivo</span>}</td>
              <td><button className="btn btn-sm" onClick={() => setModal(u)}>Editar</button></td>
            </tr>
          ))}</tbody></table>
      </div>
      {modal && <UsuarioModal usuario={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); cargar(); toast('Usuario guardado.'); }} />}
    </div>
  );
}

function UsuarioModal({ usuario, onClose, onDone }) {
  const toast = useToast();
  const [areas, setAreas] = useState([]);
  const [f, setF] = useState({ rol: 'tecnico', activo: 1, ...usuario });
  const esNuevo = !usuario.id;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => { api.get('/areas').then(setAreas).catch(() => {}); }, []);
  const guardar = async () => {
    if (!f.nombre || !f.correo) return toast('Nombre y correo obligatorios.', 'err');
    try {
      if (esNuevo) await api.post('/usuarios', f);
      else await api.put('/usuarios/' + usuario.id, f);
      onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title={esNuevo ? 'Nuevo usuario' : 'Editar usuario'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre" req><input value={f.nombre || ''} onChange={(e) => set('nombre', e.target.value)} /></Field>
        <Field label="Correo" req><input value={f.correo || ''} disabled={!esNuevo} onChange={(e) => set('correo', e.target.value)} /></Field>
        <Field label="Rol">
          <select value={f.rol} onChange={(e) => set('rol', e.target.value)}>
            {Object.entries(ROL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Área">
          <select value={f.area_id || ''} onChange={(e) => set('area_id', Number(e.target.value) || null)}>
            <option value="">Sin área</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Field>
        <Field label="Cargo"><input value={f.cargo || ''} onChange={(e) => set('cargo', e.target.value)} /></Field>
        <Field label="Especialidad"><input value={f.especialidad || ''} onChange={(e) => set('especialidad', e.target.value)} /></Field>
      </div>
      {!esNuevo && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!f.activo} onChange={(e) => set('activo', e.target.checked ? 1 : 0)} />
          <span style={{ margin: 0 }}>Usuario activo</span>
        </label>
      )}
    </Modal>
  );
}

function Areas() {
  const [areas, setAreas] = useState(null);
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const cargar = () => api.get('/areas').then(setAreas).catch(() => setAreas([]));
  useEffect(cargar, []);
  if (!areas) return <Spinner />;
  const guardar = async (a) => {
    try { await api.put('/areas/' + a.id, { capacidad_semanal_horas: Number(a.capacidad_semanal_horas) }); setEdit(null); cargar(); toast('Área actualizada.'); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="table-wrap">
      <table><thead><tr><th>Área</th><th>Supervisor</th><th>Capacidad (h/sem)</th><th>OT activas</th><th>OT vencidas</th><th></th></tr></thead>
        <tbody>{areas.map((a) => (
          <tr key={a.id}>
            <td>{a.nombre}</td><td>{a.supervisor || '—'}</td>
            <td>{edit?.id === a.id ? <input type="number" value={edit.capacidad_semanal_horas} onChange={(e) => setEdit({ ...edit, capacidad_semanal_horas: e.target.value })} style={{ width: 90 }} /> : a.capacidad_semanal_horas}</td>
            <td>{a.ot_activas}</td><td>{a.ot_vencidas}</td>
            <td>{edit?.id === a.id
              ? <button className="btn btn-sm btn-primary" onClick={() => guardar(edit)}>Guardar</button>
              : <button className="btn btn-sm" onClick={() => setEdit(a)}>Editar</button>}</td>
          </tr>
        ))}</tbody></table>
    </div>
  );
}

function Catalogos() {
  const { cat } = useCatalogos();
  const tipos = Object.keys(cat);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
      {tipos.map((t) => (
        <div key={t} className="card card-pad">
          <h3 className="section-title" style={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</h3>
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            {cat[t].map((c) => (
              <span key={c.id} className="chip" style={c.color ? { borderColor: c.color, color: c.color } : {}}>{c.etiqueta}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCatalogos } from '../lib/catalogos.jsx';
import { PrioridadBadge, EstadoBadge, Spinner, Modal, Field, useToast, fmtFecha } from '../components/ui.jsx';
import Adjuntos from '../components/Adjuntos.jsx';

export default function AvisoDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { list, label } = useCatalogos();
  const toast = useToast();
  const [a, setA] = useState(null);
  const [modal, setModal] = useState(null); // 'validar' | 'sap' | 'ot'

  const cargar = () => api.get('/avisos/' + id).then(setA).catch(() => nav('/avisos'));
  useEffect(() => { cargar(); }, [id]);

  if (!a) return <Spinner />;

  const accion = async (fn, msg) => { try { await fn(); toast(msg); setModal(null); cargar(); } catch (e) { toast(e.message, 'err'); } };
  // El Gestor Enlace SAP valida los avisos, los registra en SAP y crea la OT.
  const esGestor = ['gestor_sap', 'administrador'].includes(user.rol);
  const esValidador = esGestor;
  const esDueno = a.solicitante_id === user.id || user.rol === 'administrador';

  return (
    <div>
      <button className="btn btn-sm" onClick={() => nav('/avisos')} style={{ marginBottom: 14 }}>← Avisos</button>
      <div className="flex between center" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>{a.codigo}</h2>
          <div className="muted">{a.sintoma}</div>
        </div>
        <div className="flex gap center">
          <PrioridadBadge codigo={a.prioridad} label={a.prioridad_label} />
          <EstadoBadge label={a.estado_label} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <h3 className="section-title">Datos del aviso</h3>
            <dl className="kv">
              <dt>Equipo</dt><dd>{a.equipo_desc ? `${a.equipo_codigo} — ${a.equipo_desc}` : 'Equipo desconocido' + (a.centro_coste ? ` (CC ${a.centro_coste})` : '')}</dd>
              <dt>Área</dt><dd>{a.area || '—'}</dd>
              <dt>Ubicación</dt><dd>{a.ubicacion || '—'}</dd>
              <dt>Tipo</dt><dd>{label('tipo_aviso', a.tipo_aviso)}</dd>
              <dt>Criticidad</dt><dd>{label('criticidad', a.criticidad)}</dd>
              <dt>Descripción</dt><dd>{a.descripcion || '—'}</dd>
              <dt>Solicitante</dt><dd>{a.solicitante || '—'}</dd>
              <dt>Estimación</dt><dd>{a.duracion_estimada ? `${a.duracion_estimada} h × ${a.tecnicos_estimados || 1} téc.` : '—'}</dd>
              {a.geo_lat && <><dt>Georreferencia</dt><dd>{a.geo_lat.toFixed(5)}, {a.geo_lng.toFixed(5)}</dd></>}
              {a.aviso_sap && <><dt>Aviso SAP</dt><dd className="mono">{a.aviso_sap}</dd></>}
              {a.observaciones && <><dt>Observaciones</dt><dd>{a.observaciones}</dd></>}
              <dt>Creado</dt><dd>{fmtFecha(a.created_at)}</dd>
            </dl>
            {a.orden && (
              <div className="alert-banner" style={{ marginTop: 14, marginBottom: 0, background: 'rgba(37,99,235,.1)', borderColor: 'var(--azul-acc)', color: 'var(--text)' }}>
                🔧 Este aviso generó la <b onClick={() => nav('/ordenes/' + a.orden.id)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>OT {a.orden.codigo}</b> ({label('estado_ot', a.orden.estado)}).
              </div>
            )}
          </div>

          <Adjuntos entidad="aviso" entidadId={a.id} onChange={cargar} adjuntos={a.adjuntos} categorias={['aviso_inicial', 'diagnostico', 'documento']} />
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <h3 className="section-title">Acciones</h3>
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {esDueno && ['borrador', 'observado'].includes(a.estado) &&
                <button className="btn btn-primary" onClick={() => accion(() => api.post(`/avisos/${id}/enviar`), 'Aviso enviado a validación.')}>📤 Enviar a validación</button>}
              {esValidador && ['pendiente_validacion', 'observado'].includes(a.estado) &&
                <button className="btn btn-primary" onClick={() => setModal('validar')}>✔️ Validar aviso</button>}
              {esGestor && a.estado === 'pendiente_registro_sap' &&
                <button className="btn btn-warn" onClick={() => setModal('sap')}>🗂️ Registrar en SAP</button>}
              {esGestor && a.estado === 'pendiente_creacion_ot' &&
                <button className="btn btn-success" onClick={() => setModal('ot')}>🔧 Crear Orden de Trabajo</button>}
              {!['borrador'].includes(a.estado) === false && esDueno &&
                <span className="muted" style={{ fontSize: 12 }}>Puedes editarlo desde el listado mientras esté en borrador.</span>}
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="section-title">Trazabilidad</h3>
            <ul className="timeline">
              {a.historial.map((h) => (
                <li key={h.id}>
                  <div><b>{label('estado_aviso', h.estado_nuevo)}</b></div>
                  {h.comentario && <div style={{ fontSize: 13 }}>{h.comentario}</div>}
                  <div className="t-when">{h.usuario || 'Sistema'} · {fmtFecha(h.created_at)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {modal === 'validar' && <ValidarModal aviso={a} onClose={() => setModal(null)} onDone={() => accion(async () => {}, 'Validación registrada.')} reload={cargar} />}
      {modal === 'sap' && <RegistrarSapModal id={id} onClose={() => setModal(null)} onDone={() => { toast('Aviso SAP registrado.'); setModal(null); cargar(); }} />}
      {modal === 'ot' && <CrearOtModal aviso={a} onClose={() => setModal(null)} onDone={(otId) => { toast('OT creada.'); nav('/ordenes/' + otId); }} />}
    </div>
  );
}

function ValidarModal({ aviso, onClose, reload }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [comentario, setComentario] = useState('');
  const [prioridad, setPrioridad] = useState(aviso.prioridad);
  const [busy, setBusy] = useState(false);

  const enviar = async (accion) => {
    if ((accion === 'observar' || accion === 'rechazar') && !comentario) return toast('Indica el motivo.', 'err');
    setBusy(true);
    try {
      await api.post(`/avisos/${aviso.id}/validar`, { accion, comentario, prioridad });
      toast(accion === 'aprobar' ? 'Aviso aprobado. Pasa a bandeja SAP.' : `Aviso ${accion === 'rechazar' ? 'rechazado' : 'observado'}.`);
      onClose(); reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <Modal title="Validar aviso" onClose={onClose}
      footer={<>
        <button className="btn btn-danger" onClick={() => enviar('rechazar')} disabled={busy}>Rechazar</button>
        <button className="btn btn-warn" onClick={() => enviar('observar')} disabled={busy}>Observar</button>
        <button className="btn btn-success" onClick={() => enviar('aprobar')} disabled={busy}>Aprobar</button>
      </>}>
      <Field label="Prioridad (ajustable)">
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
          {list('prioridad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
      </Field>
      <Field label="Comentario / motivo">
        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Requerido para observar o rechazar" />
      </Field>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>Al aprobar, el aviso pasa a <b>Pendiente de registro SAP</b> y se notifica al Gestor Enlace SAP.</p>
    </Modal>
  );
}

function RegistrarSapModal({ id, onClose, onDone }) {
  const toast = useToast();
  const [avisoSap, setAvisoSap] = useState('');
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    if (!avisoSap) return toast('Ingresa el número de aviso SAP.', 'err');
    setBusy(true);
    try { await api.post(`/avisos/${id}/registrar-sap`, { aviso_sap: avisoSap }); onDone(); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Registrar aviso en SAP" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={busy}>Registrar</button></>}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Proceso manual (sección 9). Ingresa el número generado en SAP.</p>
      <Field label="Número de aviso SAP" req><input value={avisoSap} onChange={(e) => setAvisoSap(e.target.value)} placeholder="p. ej. 10045990" /></Field>
    </Modal>
  );
}

function CrearOtModal({ aviso, onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [f, setF] = useState({ tipo_mantenimiento: 'correctivo', ot_sap: '', horas_estimadas: aviso.duracion_estimada ? aviso.duracion_estimada * (aviso.tecnicos_estimados || 1) : '', tecnicos_requeridos: aviso.tecnicos_estimados || 1 });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!f.ot_sap) return toast('Ingresa el número de OT SAP.', 'err');
    setBusy(true);
    try { const r = await api.post('/ordenes', { aviso_id: aviso.id, ...f }); onDone(r.id); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Crear Orden de Trabajo" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-success" onClick={guardar} disabled={busy}>Crear OT</button></>}>
      <div className="form-grid">
        <Field label="Número de OT SAP" req><input value={f.ot_sap} onChange={(e) => set('ot_sap', e.target.value)} placeholder="p. ej. 40001270" /></Field>
        <Field label="Tipo de mantenimiento">
          <select value={f.tipo_mantenimiento} onChange={(e) => set('tipo_mantenimiento', e.target.value)}>
            {list('tipo_mantenimiento').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
        <Field label="Horas hombre estimadas"><input type="number" min="0" step="0.5" value={f.horas_estimadas} onChange={(e) => set('horas_estimadas', Number(e.target.value))} /></Field>
        <Field label="Técnicos requeridos"><input type="number" min="1" value={f.tecnicos_requeridos} onChange={(e) => set('tecnicos_requeridos', Number(e.target.value))} /></Field>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>La OT quedará relacionada al aviso y será el registro principal del backlog (sección 22.2).</p>
    </Modal>
  );
}

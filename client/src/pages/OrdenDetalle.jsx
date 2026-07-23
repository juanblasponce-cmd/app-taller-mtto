import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCatalogos } from '../lib/catalogos.jsx';
import { PrioridadBadge, EstadoBadge, Spinner, Modal, Field, useToast, SignaturePad, fmtFecha, fmtFechaCorta } from '../components/ui.jsx';
import Adjuntos from '../components/Adjuntos.jsx';

export default function OrdenDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { list, label } = useCatalogos();
  const toast = useToast();
  const [o, setO] = useState(null);
  const [modal, setModal] = useState(null);

  const cargar = () => api.get('/ordenes/' + id).then(setO).catch(() => nav('/ordenes'));
  useEffect(() => { cargar(); }, [id]);
  if (!o) return <Spinner />;

  const done = (msg) => { toast(msg); setModal(null); cargar(); };
  const rol = user.rol;
  const esTecnico = rol === 'tecnico' || rol === 'administrador';
  const esSuper = ['supervisor', 'planificador', 'administrador'].includes(rol);
  const esGestor = ['gestor_sap', 'administrador'].includes(rol);
  const activa = !o.estado_final;
  const pct = o.horas_estimadas ? Math.min(100, Math.round((o.horas_ejecutadas / o.horas_estimadas) * 100)) : 0;

  return (
    <div>
      <button className="btn btn-sm" onClick={() => nav('/ordenes')} style={{ marginBottom: 14 }}>← Órdenes</button>
      <div className="flex between center" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>{o.codigo} {o.ot_sap && <span className="muted mono" style={{ fontSize: 15 }}>· SAP {o.ot_sap}</span>}</h2>
          <div className="muted">{o.equipo_codigo} — {o.equipo_desc} · {o.area}</div>
        </div>
        <div className="flex gap center">
          <PrioridadBadge codigo={o.prioridad} label={o.prioridad_label} />
          <EstadoBadge label={o.estado_label} />
        </div>
      </div>

      <div className="detail-grid">
        {/* ---------- Columna principal ---------- */}
        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <h3 className="section-title">Datos de la orden</h3>
            <dl className="kv">
              <dt>Aviso relacionado</dt><dd>{o.aviso_codigo || '—'} {o.aviso_id && <button className="btn btn-sm" onClick={() => nav('/avisos/' + o.aviso_id)}>ver</button>}</dd>
              <dt>Tipo de mantenimiento</dt><dd>{o.tipo_mantenimiento_label || '—'}</dd>
              <dt>Técnico responsable</dt><dd>{o.tecnico_responsable || <span className="muted">Sin asignar</span>}</dd>
              <dt>Participantes</dt><dd>{o.tecnicos.length ? o.tecnicos.map((t) => t.nombre).join(', ') : '—'}</dd>
              <dt>Especialidad</dt><dd>{label('especialidad', o.especialidad)}</dd>
              <dt>Estado planificación</dt><dd>{o.estado_planificacion_label || '—'}</dd>
              {o.motivo_bloqueo && <><dt>Motivo de espera</dt><dd>{o.motivo_bloqueo_label} {o.motivo_bloqueo_comentario && `· ${o.motivo_bloqueo_comentario}`}</dd></>}
              <dt>Fechas</dt><dd>
                Creada {fmtFechaCorta(o.fecha_creacion)} · Requerida {fmtFechaCorta(o.fecha_requerida)}
                {o.fecha_programada && ` · Programada ${fmtFechaCorta(o.fecha_programada)}`}
                {o.fecha_conclusion && ` · Concluida ${fmtFechaCorta(o.fecha_conclusion)}`}
              </dd>
              <dt>Horas</dt><dd>
                <div className="flex center gap"><span>{o.horas_ejecutadas} / {o.horas_estimadas ?? '—'} h</span>
                  {o.horas_estimadas ? <div className="progress" style={{ width: 120 }}><div style={{ width: pct + '%', background: o.desviacion ? 'var(--rojo)' : 'var(--azul-acc)' }} /></div> : null}
                  {o.desviacion && <span className="badge badge-prio-alta">Desviación</span>}
                </div>
              </dd>
              {o.trabajo_realizado && <><dt>Trabajo realizado</dt><dd>{o.trabajo_realizado}</dd></>}
              {o.trabajo_pendiente && <><dt>Trabajo pendiente</dt><dd>{o.trabajo_pendiente}</dd></>}
              {o.condicion_final && <><dt>Condición final</dt><dd>{o.condicion_final}</dd></>}
            </dl>
          </div>

          {/* Materiales */}
          <div className="card card-pad">
            <div className="flex between center"><h3 className="section-title" style={{ margin: 0 }}>📦 Materiales</h3>
              {esTecnico && activa && <button className="btn btn-sm btn-primary" onClick={() => setModal('material')}>＋ Solicitar</button>}</div>
            {o.materiales.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Sin solicitudes.</p> : (
              <div className="table-wrap" style={{ border: 'none', marginTop: 10 }}>
                <table><thead><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Estado</th><th>Reserva</th>{esGestor && <th></th>}</tr></thead>
                  <tbody>{o.materiales.map((m) => (
                    <tr key={m.id}><td className="mono">{m.codigo}</td><td>{m.descripcion_libre}{m.descripcion_sap && <div className="muted" style={{ fontSize: 12 }}>SAP: {m.codigo_sap} {m.descripcion_sap}</div>}</td>
                      <td>{m.cantidad_aprox} {m.unidad}</td><td><EstadoBadge label={m.estado_label} /></td><td className="mono">{m.numero_reserva || '—'}</td>
                      {esGestor && <td><button className="btn btn-sm" onClick={() => setModal({ t: 'gestmat', m })}>Gestionar</button></td>}</tr>
                  ))}</tbody></table>
              </div>
            )}
          </div>

          {/* Tiempos */}
          <div className="card card-pad">
            <div className="flex between center"><h3 className="section-title" style={{ margin: 0 }}>⏱️ Registro de tiempos</h3>
              {esTecnico && activa && <button className="btn btn-sm btn-primary" onClick={() => setModal('tiempo')}>＋ Registrar</button>}</div>
            {o.tiempos.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Sin registros.</p> : (
              <div className="table-wrap" style={{ border: 'none', marginTop: 10 }}>
                <table><thead><tr><th>Fecha</th><th>Actividad</th><th>Técnico</th><th className="right">Horas</th></tr></thead>
                  <tbody>{o.tiempos.map((t) => (
                    <tr key={t.id}><td>{fmtFechaCorta(t.fecha || t.created_at)}</td><td>{t.actividad_label || t.actividad}</td><td>{t.tecnico}</td><td className="right"><b>{t.duracion_horas}</b></td></tr>
                  ))}
                  <tr><td colSpan={3} className="right"><b>Total</b></td><td className="right"><b>{o.horas_ejecutadas} h</b></td></tr>
                  </tbody></table>
              </div>
            )}
          </div>

          {/* Cierres */}
          {o.cierres.length > 0 && (
            <div className="card card-pad">
              <h3 className="section-title">📝 Cierres</h3>
              {o.cierres.map((c) => (
                <div key={c.id} style={{ borderLeft: '3px solid var(--azul-acc)', paddingLeft: 12, marginBottom: 12 }}>
                  <b>Cierre {c.tipo}</b> · {fmtFecha(c.created_at)}
                  {c.trabajo_realizado && <div><span className="muted">Realizado:</span> {c.trabajo_realizado}</div>}
                  {c.trabajo_pendiente && <div><span className="muted">Pendiente:</span> {c.trabajo_pendiente}</div>}
                  {c.diagnostico_final && <div><span className="muted">Diagnóstico:</span> {c.diagnostico_final}</div>}
                  {c.causa && <div><span className="muted">Causa:</span> {c.causa}</div>}
                  {c.proxima_accion && <div><span className="muted">Próxima acción:</span> {c.proxima_accion}</div>}
                </div>
              ))}
            </div>
          )}

          <Adjuntos entidad="orden" entidadId={o.id} adjuntos={o.adjuntos} onChange={cargar}
            categorias={['diagnostico', 'material', 'ejecucion', 'pruebas', 'cierre', 'documento']} />
        </div>

        {/* ---------- Columna de acciones ---------- */}
        <div className="grid" style={{ gap: 16 }}>
          <div className="card card-pad">
            <h3 className="section-title">Acciones</h3>
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {esSuper && <button className="btn btn-primary" onClick={() => setModal('asignar')}>👷 Asignar / reprogramar</button>}
              {esSuper && <button className="btn" onClick={() => setModal('planif')}>🗓️ Planificación</button>}
              {esTecnico && activa && <button className="btn" onClick={() => setModal('estado')}>🔄 Cambiar estado</button>}
              {esTecnico && activa && !['cierre_parcial_solicitado', 'cierre_total_solicitado'].includes(o.estado) &&
                <button className="btn btn-warn" onClick={() => setModal('cierre')}>🏁 Solicitar cierre</button>}
              {esGestor && o.estado === 'cierre_total_solicitado' &&
                <button className="btn btn-warn" onClick={() => api.post(`/cierre/${o.id}/sap`).then(() => done('Cierre registrado en SAP.')).catch((e) => toast(e.message, 'err'))}>🗂️ Registrar cierre en SAP</button>}
              {esSuper && ['cierre_parcial_solicitado', 'cierre_total_solicitado', 'cerrada_sap_pendiente_conclusion'].includes(o.estado) &&
                <button className="btn btn-success" onClick={() => setModal('firmar')}>✍️ Validar y firmar</button>}
              {esSuper && o.estado === 'concluida' &&
                <button className="btn btn-danger" onClick={() => { const c = prompt('Motivo de reapertura:'); if (c) api.post(`/ordenes/${o.id}/reabrir`, { comentario: c }).then(() => done('OT reabierta.')).catch((e) => toast(e.message, 'err')); }}>↩️ Reabrir OT</button>}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <a className="btn btn-sm" href={`/api/pdf/orden/${o.id}?tipo=inicial`} target="_blank" rel="noreferrer">📄 PDF inicial</a>
              <a className="btn btn-sm" href={`/api/pdf/orden/${o.id}?tipo=ejecucion`} target="_blank" rel="noreferrer">📄 PDF ejecución</a>
              <a className="btn btn-sm" href={`/api/pdf/orden/${o.id}?tipo=final`} target="_blank" rel="noreferrer">📄 PDF final</a>
            </div>
          </div>

          {o.firma && (
            <div className="card card-pad">
              <h3 className="section-title">✍️ Firma</h3>
              <img src={o.firma.firma_data} alt="firma" style={{ maxWidth: '100%', background: '#fff', borderRadius: 8 }} />
              <dl className="kv" style={{ marginTop: 10, gridTemplateColumns: '110px 1fr' }}>
                <dt>Supervisor</dt><dd>{o.firma.nombre}</dd>
                <dt>Documento</dt><dd className="mono">{o.firma.codigo_documento}</dd>
                <dt>Fecha</dt><dd>{fmtFecha(o.firma.created_at)}</dd>
              </dl>
            </div>
          )}

          <div className="card card-pad">
            <h3 className="section-title">Trazabilidad</h3>
            <ul className="timeline">
              {o.historial.map((h) => (
                <li key={h.id}>
                  <div><b>{label('estado_ot', h.estado_nuevo)}</b></div>
                  {h.comentario && <div style={{ fontSize: 13 }}>{h.comentario}</div>}
                  <div className="t-when">{h.usuario || 'Sistema'} · {fmtFecha(h.created_at)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {modal === 'asignar' && <AsignarModal o={o} onClose={() => setModal(null)} onDone={() => done('Asignación guardada.')} />}
      {modal === 'planif' && <PlanifModal o={o} onClose={() => setModal(null)} onDone={() => done('Planificación actualizada.')} />}
      {modal === 'estado' && <EstadoModal o={o} onClose={() => setModal(null)} onDone={() => done('Estado actualizado.')} />}
      {modal === 'material' && <MaterialModal o={o} onClose={() => setModal(null)} onDone={() => done('Solicitud creada.')} />}
      {modal?.t === 'gestmat' && <GestionMaterial m={modal.m} onClose={() => setModal(null)} onDone={() => done('Solicitud actualizada.')} />}
      {modal === 'tiempo' && <TiempoModal o={o} onClose={() => setModal(null)} onDone={() => done('Tiempo registrado.')} />}
      {modal === 'cierre' && <CierreModal o={o} onClose={() => setModal(null)} onDone={() => done('Cierre solicitado.')} />}
      {modal === 'firmar' && <FirmarModal o={o} onClose={() => setModal(null)} onDone={() => done('OT validada y firmada.')} />}
    </div>
  );
}

/* ---------------- Modales ---------------- */
function AsignarModal({ o, onClose, onDone }) {
  const toast = useToast();
  const [tecnicos, setTecnicos] = useState([]);
  const [f, setF] = useState({ tecnico_responsable_id: o.tecnico_responsable_id || '', fecha_programada: '', fecha_comprometida: '' });
  const [participantes, setParticipantes] = useState(o.tecnicos.map((t) => t.id));
  useEffect(() => { api.get('/usuarios?rol=tecnico').then(setTecnicos).catch(() => {}); }, []);
  const guardar = async () => {
    try { await api.post(`/ordenes/${o.id}/asignar`, { ...f, tecnico_responsable_id: Number(f.tecnico_responsable_id) || null, participantes }); onDone(); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="Asignar / reprogramar" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
      <Field label="Técnico responsable">
        <select value={f.tecnico_responsable_id} onChange={(e) => setF((p) => ({ ...p, tecnico_responsable_id: e.target.value }))}>
          <option value="">Sin asignar</option>
          {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.especialidad ? ` (${t.especialidad})` : ''}</option>)}
        </select>
      </Field>
      <Field label="Técnicos participantes">
        <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>
          {tecnicos.map((t) => (
            <label key={t.id} className="chip" style={{ cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={participantes.includes(t.id)}
                onChange={(e) => setParticipantes((p) => e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id))} />
              {t.nombre}
            </label>
          ))}
        </div>
      </Field>
      <div className="form-grid">
        <Field label="Fecha programada"><input type="date" value={f.fecha_programada} onChange={(e) => setF((p) => ({ ...p, fecha_programada: e.target.value }))} /></Field>
        <Field label="Fecha comprometida"><input type="date" value={f.fecha_comprometida} onChange={(e) => setF((p) => ({ ...p, fecha_comprometida: e.target.value }))} /></Field>
      </div>
    </Modal>
  );
}

function PlanifModal({ o, onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [f, setF] = useState({ estado_planificacion: o.estado_planificacion, horas_estimadas: o.horas_estimadas || '', tecnicos_requeridos: o.tecnicos_requeridos || 1, prioridad: o.prioridad, fecha_requerida: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => { try { await api.post(`/ordenes/${o.id}/planificacion`, f); onDone(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Modal title="Planificación" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Estado de planificación">
          <select value={f.estado_planificacion} onChange={(e) => set('estado_planificacion', e.target.value)}>
            {list('estado_planificacion').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
        <Field label="Prioridad">
          <select value={f.prioridad} onChange={(e) => set('prioridad', e.target.value)}>
            {list('prioridad').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
        <Field label="Horas estimadas"><input type="number" min="0" step="0.5" value={f.horas_estimadas} onChange={(e) => set('horas_estimadas', Number(e.target.value))} /></Field>
        <Field label="Técnicos requeridos"><input type="number" min="1" value={f.tecnicos_requeridos} onChange={(e) => set('tecnicos_requeridos', Number(e.target.value))} /></Field>
        <Field label="Fecha requerida"><input type="date" value={f.fecha_requerida} onChange={(e) => set('fecha_requerida', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function EstadoModal({ o, onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [estado, setEstado] = useState(o.estado);
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState(o.motivo_bloqueo || '');
  const requiereMotivo = ['esperando_materiales', 'trabajo_detenido', 'pausada'].includes(estado);
  const guardar = async () => {
    try { await api.post(`/ordenes/${o.id}/estado`, { estado, comentario, motivo_bloqueo: motivo }); onDone(); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="Cambiar estado de la OT" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Actualizar</button></>}>
      <Field label="Nuevo estado">
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {list('estado_ot').filter((c) => !c.es_final || c.codigo === o.estado).map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
        </select>
      </Field>
      {requiereMotivo && (
        <Field label="Motivo de espera/bloqueo">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list('motivo_bloqueo').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
      )}
      <Field label="Comentario"><textarea value={comentario} onChange={(e) => setComentario(e.target.value)} /></Field>
    </Modal>
  );
}

function MaterialModal({ o, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ descripcion_libre: '', cantidad_aprox: 1, unidad: 'unidad', motivo: '', observaciones: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!f.descripcion_libre) return toast('Describe el material.', 'err');
    try { await api.post('/materiales', { orden_id: o.id, ...f }); onDone(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="Solicitar material" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Solicitar</button></>}>
      <Field label="Descripción libre" req hint="No necesitas el código SAP; el Gestor Enlace SAP lo completará.">
        <input value={f.descripcion_libre} onChange={(e) => set('descripcion_libre', e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="Cantidad aproximada"><input type="number" min="0" step="0.5" value={f.cantidad_aprox} onChange={(e) => set('cantidad_aprox', Number(e.target.value))} /></Field>
        <Field label="Unidad"><input value={f.unidad} onChange={(e) => set('unidad', e.target.value)} /></Field>
      </div>
      <Field label="Motivo"><input value={f.motivo} onChange={(e) => set('motivo', e.target.value)} /></Field>
      <Field label="Observaciones"><textarea value={f.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></Field>
    </Modal>
  );
}

function GestionMaterial({ m, onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [f, setF] = useState({ codigo_sap: m.codigo_sap || '', descripcion_sap: m.descripcion_sap || '', cantidad_aprobada: m.cantidad_aprobada || m.cantidad_aprox, numero_reserva: m.numero_reserva || '', estado: m.estado });
  const [coment, setComent] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    try {
      if (coment) await api.post(`/materiales/${m.id}/comentario`, { texto: coment });
      await api.put(`/materiales/${m.id}`, f); onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title={`Gestionar material ${m.codigo}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Solicitado: <b>{m.descripcion_libre}</b> ({m.cantidad_aprox} {m.unidad})</p>
      <div className="form-grid">
        <Field label="Código SAP"><input value={f.codigo_sap} onChange={(e) => set('codigo_sap', e.target.value)} /></Field>
        <Field label="Descripción SAP"><input value={f.descripcion_sap} onChange={(e) => set('descripcion_sap', e.target.value)} /></Field>
        <Field label="Cantidad aprobada"><input type="number" value={f.cantidad_aprobada} onChange={(e) => set('cantidad_aprobada', Number(e.target.value))} /></Field>
        <Field label="Número de reserva"><input value={f.numero_reserva} onChange={(e) => set('numero_reserva', e.target.value)} /></Field>
        <Field label="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            {list('estado_material').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Comentario al técnico"><textarea value={coment} onChange={(e) => setComent(e.target.value)} /></Field>
    </Modal>
  );
}

function TiempoModal({ o, onClose, onDone }) {
  const { list } = useCatalogos();
  const toast = useToast();
  const [f, setF] = useState({ actividad: 'trabajo', fecha: new Date().toISOString().slice(0, 10), hora_inicio: '', hora_fin: '', observaciones: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!f.hora_inicio || !f.hora_fin) return toast('Indica hora de inicio y fin.', 'err');
    try { await api.post('/tiempos', { orden_id: o.id, ...f }); onDone(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="Registrar tiempo" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Registrar</button></>}>
      <div className="form-grid">
        <Field label="Actividad">
          <select value={f.actividad} onChange={(e) => set('actividad', e.target.value)}>
            {list('categoria_tiempo').map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} /></Field>
        <Field label="Hora inicio"><input type="time" value={f.hora_inicio} onChange={(e) => set('hora_inicio', e.target.value)} /></Field>
        <Field label="Hora fin"><input type="time" value={f.hora_fin} onChange={(e) => set('hora_fin', e.target.value)} /></Field>
      </div>
      <Field label="Observaciones"><textarea value={f.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></Field>
    </Modal>
  );
}

function CierreModal({ o, onClose, onDone }) {
  const toast = useToast();
  const [tipo, setTipo] = useState('total');
  const [f, setF] = useState({ trabajo_realizado: '', trabajo_pendiente: '', estado_operativo: 'Operativo', condicion_final: 'Operativo', diagnostico_final: '', causa: '', proxima_accion: '', recomendacion: '', material_pendiente: '', riesgos: '', restricciones: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    try { await api.post('/cierre/solicitar', { orden_id: o.id, tipo, ...f }); onDone(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="Solicitar cierre" onClose={onClose} size="lg"
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-warn" onClick={guardar}>Solicitar cierre {tipo}</button></>}>
      <div className="flex gap" style={{ marginBottom: 14 }}>
        <label className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', borderColor: tipo === 'total' ? 'var(--azul-acc)' : 'var(--border)' }}>
          <input type="radio" style={{ width: 'auto' }} checked={tipo === 'total'} onChange={() => setTipo('total')} /> Cierre total
        </label>
        <label className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', borderColor: tipo === 'parcial' ? 'var(--azul-acc)' : 'var(--border)' }}>
          <input type="radio" style={{ width: 'auto' }} checked={tipo === 'parcial'} onChange={() => setTipo('parcial')} /> Cierre parcial
        </label>
      </div>
      <Field label="Trabajo realizado" req><textarea value={f.trabajo_realizado} onChange={(e) => set('trabajo_realizado', e.target.value)} /></Field>
      {tipo === 'total' ? (
        <div className="form-grid">
          <Field label="Diagnóstico final"><textarea value={f.diagnostico_final} onChange={(e) => set('diagnostico_final', e.target.value)} /></Field>
          <Field label="Causa"><textarea value={f.causa} onChange={(e) => set('causa', e.target.value)} /></Field>
          <Field label="Condición final">
            <select value={f.condicion_final} onChange={(e) => set('condicion_final', e.target.value)}><option>Operativo</option><option>Inoperativo</option></select>
          </Field>
          <Field label="Recomendaciones"><textarea value={f.recomendacion} onChange={(e) => set('recomendacion', e.target.value)} /></Field>
        </div>
      ) : (
        <div className="form-grid">
          <Field label="Trabajo pendiente" req><textarea value={f.trabajo_pendiente} onChange={(e) => set('trabajo_pendiente', e.target.value)} /></Field>
          <Field label="Estado operativo">
            <select value={f.estado_operativo} onChange={(e) => set('estado_operativo', e.target.value)}><option>Operativo</option><option>Inoperativo</option></select>
          </Field>
          <Field label="Material pendiente"><input value={f.material_pendiente} onChange={(e) => set('material_pendiente', e.target.value)} /></Field>
          <Field label="Próxima acción"><input value={f.proxima_accion} onChange={(e) => set('proxima_accion', e.target.value)} /></Field>
          <Field label="Riesgos"><input value={f.riesgos} onChange={(e) => set('riesgos', e.target.value)} /></Field>
          <Field label="Restricciones"><input value={f.restricciones} onChange={(e) => set('restricciones', e.target.value)} /></Field>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>El técnico no concluye la OT: el cierre total pasa por SAP, validación y firma del supervisor (sección 17).</p>
    </Modal>
  );
}

function FirmarModal({ o, onClose, onDone }) {
  const toast = useToast();
  const [firma, setFirma] = useState(null);
  const [observacion, setObservacion] = useState('');
  const [check, setCheck] = useState(false);
  const guardar = async () => {
    if (!check) return toast('Confirma tu conformidad e identidad.', 'err');
    if (!firma) return toast('Firma en el recuadro.', 'err');
    try { await api.post(`/cierre/${o.id}/firmar`, { firma_data: firma, observacion }); onDone(); }
    catch (e) { toast(e.message, 'err'); }
  };
  return (
    <Modal title="Validar y firmar" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-success" onClick={guardar}>Firmar y concluir</button></>}>
      <Field label="Observación"><textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} /></Field>
      <Field label="Firma manuscrita" req><SignaturePad onChange={setFirma} /></Field>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={check} onChange={(e) => setCheck(e.target.checked)} />
        <span style={{ margin: 0 }}>Confirmo la conformidad del trabajo y mi identidad corporativa (Entra ID).</span>
      </label>
    </Modal>
  );
}

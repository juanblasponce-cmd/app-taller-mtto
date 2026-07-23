import { useState, useRef } from 'react';
import { api } from '../lib/api.js';
import { useToast } from './ui.jsx';

// Adjuntos: fotografías y documentos (sección 20).
export default function Adjuntos({ entidad, entidadId, adjuntos = [], categorias = ['documento'], onChange }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [cat, setCat] = useState(categorias[0]);
  const [busy, setBusy] = useState(false);

  const subir = async (file) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('categoria', cat);
    try {
      await api.upload(`/adjuntos/${entidad}/${entidadId}`, fd);
      toast('Archivo adjuntado.');
      onChange?.();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const esImagen = (m) => m && m.startsWith('image');

  return (
    <div className="card card-pad">
      <h3 className="section-title">📎 Fotografías y documentos</h3>
      <div className="flex gap" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}>
          {categorias.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ width: 'auto' }}
          disabled={busy} onChange={(e) => subir(e.target.files[0])} />
      </div>
      {adjuntos.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Sin archivos adjuntos.</p> : (
        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
          {adjuntos.map((ad) => (
            <a key={ad.id} href={ad.ruta} target="_blank" rel="noreferrer" className="chip" style={{ padding: 6 }}>
              {esImagen(ad.mime)
                ? <img src={ad.ruta} alt={ad.nombre} style={{ width: 74, height: 74, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                : <span>📄 {ad.nombre}</span>}
              <div style={{ fontSize: 11 }} className="muted">{ad.categoria}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

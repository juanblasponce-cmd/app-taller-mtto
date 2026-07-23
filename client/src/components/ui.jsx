import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

/* ---------- Badges ---------- */
export function PrioridadBadge({ codigo, label }) {
  if (!codigo) return <span className="muted">—</span>;
  return <span className={`badge badge-prio-${codigo}`}><span className="dot" style={{ background: 'currentColor' }} />{label || codigo}</span>;
}
export function EstadoBadge({ label }) {
  return <span className="badge badge-estado">{label || '—'}</span>;
}
export function EtapaBadge({ etapa }) {
  const cls = etapa === 'Aviso' ? 'badge-etapa-aviso' : 'badge-etapa-ot';
  return <span className={`badge ${cls}`}>{etapa}</span>;
}

/* ---------- Estados de carga / vacío ---------- */
export const Spinner = () => <div className="spinner" />;
export function Empty({ icon = '📭', children }) {
  return <div className="empty"><div className="ico">{icon}</div><p>{children}</p></div>;
}

/* ---------- Modal ---------- */
export function Modal({ title, children, onClose, footer, size }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size || ''}`}>
        <div className="modal-head"><h3>{title}</h3><span className="spacer" style={{ flex: 1 }} />
          <button className="iconbtn" onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Campo de formulario ---------- */
export function Field({ label, req, children, hint }) {
  return (
    <label className="field">
      <span>{label} {req && <span className="req">*</span>}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </ToastCtx.Provider>
  );
}

/* ---------- Pad de firma manuscrita (sección 18) ---------- */
export function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1F3864';
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
    };
    const start = (e) => { drawing.current = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
    const move = (e) => { if (!drawing.current) return; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); };
    const end = () => { if (drawing.current) { drawing.current = false; onChange?.(canvas.toDataURL('image/png')); } };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move);
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [onChange]);

  const clear = () => {
    const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange?.(null);
  };
  return (
    <div>
      <canvas ref={ref} width={440} height={150} className="sig-pad" />
      <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={clear}>Limpiar firma</button>
    </div>
  );
}

/* ---------- Utilidades de formato ---------- */
export const fmtFecha = (v) => (v ? new Date(v.replace(' ', 'T') + 'Z').toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtFechaCorta = (v) => (v ? new Date(v.replace(' ', 'T') + 'Z').toLocaleDateString('es-PE') : '—');
export const hace = (v) => {
  if (!v) return '—';
  const s = (Date.now() - new Date(v.replace(' ', 'T') + 'Z').getTime()) / 1000;
  if (s < 60) return 'hace instantes';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} días`;
};

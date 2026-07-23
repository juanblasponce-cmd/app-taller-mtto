import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth, ROL_LABEL } from '../lib/auth.jsx';
import { Spinner } from '../components/ui.jsx';

// Selección de identidad (simula el inicio de sesión con Microsoft Entra ID).
export default function Login() {
  const { login } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const cargar = () => {
    setError(null); setUsuarios(null);
    api.get('/auth/usuarios')
      .then(setUsuarios)
      .catch((e) => setError(e.message || 'No se pudo conectar con el servidor.'));
  };
  useEffect(cargar, []);

  const entrar = async (u) => {
    setBusy(true);
    try { await login(u); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-head">
          <div className="logo">🔧</div>
          <h2 style={{ margin: '8px 0 4px' }}>App Taller · Mantenimiento</h2>
          <p style={{ margin: 0, opacity: .85, fontSize: 13 }}>Avisos · Órdenes de Trabajo · Backlog</p>
        </div>
        <div className="login-body">
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Inicia sesión seleccionando tu usuario. En producción esto lo resolvería
            Microsoft Entra ID con tu cuenta corporativa.
          </p>
          {error ? (
            <div>
              <div className="alert-banner" style={{ background: 'rgba(229,57,53,.12)', borderColor: 'var(--rojo)', color: 'var(--rojo)' }}>
                <b>No se pudo conectar con el servidor.</b>
                <div style={{ fontSize: 13, marginTop: 4 }}>{error}</div>
                <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-soft)' }}>
                  Comprueba que el backend esté corriendo (<code>npm run dev</code>) y vuelve a intentar.
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={cargar}>Reintentar</button>
            </div>
          ) : !usuarios || busy ? <Spinner /> : (
            <div>
              {usuarios.map((u) => (
                <button key={u.id} className="user-pick" onClick={() => entrar(u)}>
                  <div className="avatar">{u.nombre.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {ROL_LABEL[u.rol]}{u.area ? ' · ' + u.area : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

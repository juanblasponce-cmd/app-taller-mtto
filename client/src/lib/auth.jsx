import { createContext, useContext, useEffect, useState } from 'react';
import { api, getUserId, setUserId } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Etiquetas de rol legibles
export const ROL_LABEL = {
  administrador: 'Administrador',
  solicitante: 'Solicitante',
  gestor_sap: 'Gestor Enlace SAP',
  supervisor: 'Supervisor',
  tecnico: 'Técnico',
  planificador: 'Planificador',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getUserId();
    if (!id) { setLoading(false); return; }
    api.get('/auth/me').then(setUser).catch(() => setUserId(null)).finally(() => setLoading(false));
  }, []);

  const login = async (u) => {
    setUserId(u.id);
    const full = await api.get('/auth/me');
    setUser(full);
  };
  const logout = () => { setUserId(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

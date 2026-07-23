import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

const CatCtx = createContext(null);
export const useCatalogos = () => useContext(CatCtx);

export function CatalogoProvider({ children }) {
  const { user } = useAuth();
  const [cat, setCat] = useState({});

  useEffect(() => {
    if (!user) return;
    api.get('/catalogos').then(setCat).catch(() => {});
  }, [user]);

  // Lista de un tipo: [{codigo, etiqueta, color, ...}]
  const list = useCallback((tipo) => cat[tipo] || [], [cat]);
  // Etiqueta legible de un código
  const label = useCallback((tipo, codigo) => {
    const found = (cat[tipo] || []).find((c) => c.codigo === codigo);
    return found?.etiqueta || codigo || '—';
  }, [cat]);
  // Color asociado (prioridad/estado)
  const color = useCallback((tipo, codigo) => {
    const found = (cat[tipo] || []).find((c) => c.codigo === codigo);
    return found?.color || null;
  }, [cat]);

  return <CatCtx.Provider value={{ cat, list, label, color }}>{children}</CatCtx.Provider>;
}

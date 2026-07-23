import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth, ROL_LABEL } from './lib/auth.jsx';
import { ToastProvider, Spinner } from './components/ui.jsx';
import { api } from './lib/api.js';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Avisos from './pages/Avisos.jsx';
import AvisoDetalle from './pages/AvisoDetalle.jsx';
import Ordenes from './pages/Ordenes.jsx';
import OrdenDetalle from './pages/OrdenDetalle.jsx';
import Backlog from './pages/Backlog.jsx';
import Equipos from './pages/Equipos.jsx';
import Historial from './pages/Historial.jsx';
import Reportes from './pages/Reportes.jsx';
import Admin from './pages/Admin.jsx';
import BandejaSap from './pages/BandejaSap.jsx';
import Materiales from './pages/Materiales.jsx';
import Alertas from './pages/Alertas.jsx';

// Menú: cada item declara los roles que lo ven (vacío = todos)
const MENU = [
  { grupo: 'Operación' },
  { to: '/', ico: '📊', label: 'Dashboard', roles: [] },
  { to: '/avisos', ico: '📣', label: 'Avisos', roles: [] },
  { to: '/ordenes', ico: '🔧', label: 'Órdenes de Trabajo', roles: [] },
  { to: '/alertas', ico: '🔔', label: 'Alertas', roles: [], badge: 'alertas' },
  { grupo: 'Enlace SAP', roles: ['gestor_sap', 'administrador'] },
  { to: '/sap', ico: '🗂️', label: 'Bandeja SAP', roles: ['gestor_sap', 'administrador'] },
  { to: '/materiales', ico: '📦', label: 'Materiales', roles: ['gestor_sap', 'administrador'] },
  { grupo: 'Planificación' },
  { to: '/backlog', ico: '📚', label: 'Backlog', roles: ['planificador', 'administrador', 'gestor_sap', 'supervisor'] },
  { to: '/reportes', ico: '📈', label: 'Reportes', roles: ['planificador', 'administrador', 'supervisor'] },
  { grupo: 'Catálogos' },
  { to: '/equipos', ico: '⚙️', label: 'Equipos', roles: [] },
  { to: '/historial', ico: '🗄️', label: 'Historial', roles: [] },
  { to: '/admin', ico: '🛠️', label: 'Administración', roles: ['administrador'] },
];

function Sidebar({ open, onNav, alertas }) {
  const { user } = useAuth();
  const puede = (roles) => !roles || roles.length === 0 || roles.includes(user.rol);
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand"><span className="logo">🔧</span> App Taller</div>
      <nav className="nav" onClick={onNav}>
        {MENU.map((m, i) => {
          if (m.grupo) return puede(m.roles) ? <div className="nav-sep" key={i}>{m.grupo}</div> : null;
          if (!puede(m.roles)) return null;
          return (
            <NavLink key={m.to} to={m.to} end={m.to === '/'}>
              <span className="ico">{m.ico}</span>{m.label}
              {m.badge === 'alertas' && alertas > 0 && <span className="badge-count">{alertas}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const loc = useLocation();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  const titulo = { '/': 'Dashboard', '/avisos': 'Avisos', '/ordenes': 'Órdenes de Trabajo',
    '/backlog': 'Backlog', '/equipos': 'Equipos', '/historial': 'Historial', '/reportes': 'Reportes',
    '/admin': 'Administración', '/sap': 'Bandeja SAP', '/materiales': 'Materiales', '/alertas': 'Alertas' }[loc.pathname] || '';
  const iniciales = user.nombre.split(' ').map((s) => s[0]).slice(0, 2).join('');
  return (
    <header className="topbar">
      <button className="iconbtn menu-toggle" onClick={onMenu}>☰</button>
      <span className="page-title">{titulo}</span>
      <span className="spacer" />
      <span className="conn-dot" title="Conectado" />
      <button className="iconbtn" onClick={() => setDark((d) => !d)} title="Tema claro/oscuro">{dark ? '☀️' : '🌙'}</button>
      <div className="usermenu">
        <div className="avatar">{iniciales}</div>
        <div style={{ lineHeight: 1.2 }}>
          <div className="u-name">{user.nombre}</div>
          <div className="u-rol">{ROL_LABEL[user.rol]}{user.area ? ' · ' + user.area : ''}</div>
        </div>
        <button className="iconbtn" onClick={logout} title="Cambiar de usuario">⎋</button>
      </div>
    </header>
  );
}

function Shell() {
  const [open, setOpen] = useState(false);
  const [alertas, setAlertas] = useState(0);
  useEffect(() => {
    const load = () => api.get('/alertas').then((a) => setAlertas(a.length)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="app">
      <Sidebar open={open} onNav={() => setOpen(false)} alertas={alertas} />
      <div className="main">
        <Topbar onMenu={() => setOpen((o) => !o)} />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/avisos" element={<Avisos />} />
            <Route path="/avisos/:id" element={<AvisoDetalle />} />
            <Route path="/ordenes" element={<Ordenes />} />
            <Route path="/ordenes/:id" element={<OrdenDetalle />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route path="/sap" element={<BandejaSap />} />
            <Route path="/materiales" element={<Materiales />} />
            <Route path="/equipos" element={<Equipos />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}><Spinner /></div>;
  return <ToastProvider>{user ? <Shell /> : <Login />}</ToastProvider>;
}

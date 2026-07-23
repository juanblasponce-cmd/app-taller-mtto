// =====================================================================
//  APP TALLER MTTO — Servidor Express (API + frontend)
// =====================================================================
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { applySchema, get } from './db/index.js';
import { authenticate } from './lib/auth.js';
import { ApiError } from './lib/helpers.js';
import { ejecutarFlujoAlertas } from './lib/alertas.js';

import authRoutes from './routes/auth.js';
import catalogosRoutes from './routes/catalogos.js';
import usuariosRoutes from './routes/usuarios.js';
import areasRoutes from './routes/areas.js';
import equiposRoutes from './routes/equipos.js';
import avisosRoutes from './routes/avisos.js';
import ordenesRoutes from './routes/ordenes.js';
import materialesRoutes from './routes/materiales.js';
import tiemposRoutes from './routes/tiempos.js';
import backlogRoutes from './routes/backlog.js';
import dashboardRoutes from './routes/dashboard.js';
import cierreRoutes from './routes/cierre.js';
import pdfRoutes from './routes/pdf.js';
import adjuntosRoutes from './routes/adjuntos.js';
import alertasRoutes from './routes/alertas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = process.env.PORT || 3001;
const PROD = process.env.NODE_ENV === 'production';

applySchema();

// Si no hay catálogos, avisa cómo sembrar
if (!get('SELECT 1 AS x FROM catalogo LIMIT 1')) {
  console.log('⚠  Base vacía. Ejecuta:  npm run seed');
}

const app = express();
app.use(express.json({ limit: '15mb' }));

// Archivos subidos (fotografías/documentos — sección 20)
app.use('/uploads', express.static(join(ROOT, 'uploads')));

// --- Rutas públicas (login/selección de usuario) ---
app.use('/api/auth', authRoutes);

// --- A partir de aquí, todo requiere usuario autenticado ---
app.use('/api', authenticate);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/avisos', avisosRoutes);
app.use('/api/ordenes', ordenesRoutes);
app.use('/api/materiales', materialesRoutes);
app.use('/api/tiempos', tiemposRoutes);
app.use('/api/backlog', backlogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cierre', cierreRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/adjuntos', adjuntosRoutes);
app.use('/api/alertas', alertasRoutes);

// --- Frontend compilado (producción) ---
const dist = join(ROOT, 'client', 'dist');
if (PROD && existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(dist, 'index.html'));
  });
}

// --- Manejo de errores centralizado ---
app.use((err, req, res, next) => {
  const status = err instanceof ApiError ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`\n🔧 App Taller Mtto`);
  console.log(`   API:      http://localhost:${PORT}/api`);
  console.log(PROD ? `   App:      http://localhost:${PORT}` : `   Frontend: http://localhost:5173 (vite)`);

  // Flujo de alertas cada hora (sección 15). Primera corrida a los 30s.
  setTimeout(ejecutarFlujoAlertas, 30_000);
  setInterval(ejecutarFlujoAlertas, 60 * 60 * 1000);
});

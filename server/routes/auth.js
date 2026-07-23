// =====================================================================
//  Autenticación (simulada). Lista de usuarios para el selector de rol
//  y verificación del usuario activo. En producción esto lo resolvería
//  Microsoft Entra ID.
// =====================================================================
import { Router } from 'express';
import { all, get } from '../db/index.js';

const router = Router();

// Usuarios disponibles para "iniciar sesión" (selector de identidad)
router.get('/usuarios', (req, res) => {
  const usuarios = all(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.cargo, u.especialidad,
            a.nombre AS area
     FROM usuario u LEFT JOIN area a ON a.id = u.area_id
     WHERE u.activo = 1
     ORDER BY CASE u.rol
        WHEN 'administrador' THEN 1 WHEN 'solicitante' THEN 2 WHEN 'gestor_sap' THEN 3
        WHEN 'supervisor' THEN 4 WHEN 'planificador' THEN 5 WHEN 'tecnico' THEN 6 ELSE 7 END,
        u.nombre`,
  );
  res.json(usuarios);
});

// Datos del usuario activo (a partir de la cabecera x-user-id)
router.get('/me', (req, res) => {
  const id = req.header('x-user-id');
  if (!id) return res.status(401).json({ error: 'No autenticado.' });
  const user = get(
    `SELECT u.*, a.nombre AS area FROM usuario u
     LEFT JOIN area a ON a.id = u.area_id WHERE u.id = ? AND u.activo = 1`,
    Number(id),
  );
  if (!user) return res.status(401).json({ error: 'Usuario no válido.' });
  res.json(user);
});

export default router;

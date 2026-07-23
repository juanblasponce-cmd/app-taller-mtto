// =====================================================================
//  Autenticación simulada de Microsoft Entra ID (sección 6).
//  En un despliegue real, el token de Entra ID identificaría al usuario.
//  Aquí el cliente envía la cabecera x-user-id con el usuario activo;
//  el backend valida rol, área y estado (activo) desde Dataverse/SQLite.
//  La seguridad se aplica en el servidor: ocultar botones no es suficiente.
// =====================================================================
import { get } from '../db/index.js';
import { ApiError } from './helpers.js';

export const ROLES = {
  ADMIN: 'administrador',
  SOLICITANTE: 'solicitante',
  GESTOR_SAP: 'gestor_sap',
  SUPERVISOR: 'supervisor',
  TECNICO: 'tecnico',
  PLANIFICADOR: 'planificador',
};

/** Carga el usuario activo desde la cabecera x-user-id. */
export function authenticate(req, res, next) {
  const id = req.header('x-user-id');
  if (!id) return next(new ApiError(401, 'No autenticado (falta identificación de usuario).'));
  const user = get('SELECT * FROM usuario WHERE id = ? AND activo = 1', Number(id));
  if (!user) return next(new ApiError(401, 'Usuario no válido o inactivo.'));
  req.user = user;
  next();
}

/** Restringe el acceso a determinados roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'No autenticado.'));
    if (req.user.rol === ROLES.ADMIN) return next(); // el administrador puede todo
    if (!roles.includes(req.user.rol)) {
      return next(new ApiError(403, `Acción no permitida para el rol "${req.user.rol}".`));
    }
    next();
  };
}

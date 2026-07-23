# App Taller · Mantenimiento

Aplicación web para administrar el mantenimiento industrial de un taller: desde la
creación de un **aviso** hasta el cierre y la firma de la **Orden de Trabajo (OT)**,
con gestión de **materiales**, **tiempos**, **backlog**, **alertas**, **indicadores**
y generación de **PDF**.

Es una implementación **ejecutable localmente** del *Documento Maestro Consolidado*.
El documento original especificaba Microsoft Power Platform (Power Apps + Dataverse +
Power Automate), que es una plataforma en la nube con licencias. Esta versión reproduce
el **mismo dominio y flujos** como una app web autónoma que corre en tu PC, sin licencias
ni servicios en la nube.

## Requisitos

- **Node.js 22.5 o superior** (usa el módulo integrado `node:sqlite`, sin compilar nada).
  Verifica con:
  ```bash
  node --version
  ```

## Puesta en marcha

```bash
npm install
npm run seed
npm run dev
```

Luego abre **http://localhost:5173**. En la pantalla de inicio eliges con qué usuario
entrar (simula el inicio de sesión con Microsoft Entra ID).

- `npm run dev` levanta el backend (Express, puerto 3001) y el frontend (Vite, 5173) a la vez.
- `npm run seed` (re)crea catálogos, usuarios, áreas, equipos y datos de ejemplo.

### Modo producción (un solo servidor)

```bash
npm run build
npm start
```

Sirve todo en **http://localhost:3001**.

## Usuarios de ejemplo (roles del documento, sección 5)

| Usuario | Rol | Qué puede hacer |
|---|---|---|
| Juan Blas Ponce | Administrador | Todo: usuarios, áreas, catálogos |
| Carlos Ramírez | Solicitante | Crear avisos |
| Lucía Fernández | Gestor Enlace SAP | Registrar SAP, crear OT, gestionar materiales |
| Miguel Torres / Ana Díaz | Supervisor | Validar avisos, asignar, planificar, validar y firmar cierres |
| Jorge Núñez | Planificador | Backlog, estimaciones, planificación y programación |
| Pedro Gómez / Rosa Vega / Luis Mendoza | Técnico | Ejecutar OT, materiales, tiempos, solicitar cierre |

## Flujo principal (probado de punta a punta)

1. **Solicitante** crea un aviso → *Pendiente de validación*.
2. **Supervisor** lo valida (aprobar / observar / rechazar). Al aprobar pasa a bandeja SAP.
3. **Gestor Enlace SAP** registra el aviso en SAP y crea la OT (proceso manual, sección 9).
4. **Supervisor** asigna técnico y programa; **Técnico** cambia estados, pide materiales y registra tiempos.
5. **Técnico** solicita cierre (parcial o total) — *no puede concluir la OT por sí mismo*.
6. **Gestor SAP** registra horas y cierre en SAP; **Supervisor** valida, **firma** y se concluye.
7. Se genera el **PDF** (inicial / ejecución / final) y la OT pasa al **historial**.

El **backlog** acompaña todo el ciclo: consolida avisos (aún sin OT) y OT no concluidas
sin contar dos veces el mismo trabajo, calcula antigüedad, horas restantes y *semanas de backlog*.

## Estructura del proyecto

```
server/                Backend (Express + node:sqlite)
  db/schema.sql        Esquema de tablas (secciones 36–37 del documento)
  db/seed.js           Catálogos y datos de ejemplo
  lib/                 Auth por rol, alertas horarias, utilidades
  routes/              API REST: avisos, ordenes, materiales, tiempos,
                       backlog, dashboard, cierre, pdf, adjuntos, alertas
client/                Frontend (React + Vite)
  src/pages/           Dashboard, Avisos, Órdenes, Backlog, Reportes, etc.
  src/components/      UI reutilizable (badges, modal, firma, adjuntos)
data/taller.db         Base de datos SQLite (se crea con el seed)
uploads/               Fotografías y documentos adjuntos
```

## Notas sobre el alcance

- **Autenticación**: simula Entra ID con un selector de usuario. La seguridad se aplica
  en el servidor (no basta con ocultar botones): cada endpoint valida el rol.
- **SAP**: es un proceso **manual** a cargo del Gestor Enlace SAP (no hay integración automática),
  tal como define el documento (secciones 5.3 y 9).
- **Alertas**: un flujo revisa cada hora las OT sin movimiento y genera alertas (sección 15).
- **Offline / SharePoint / Teams / Power BI**: en esta versión local, los adjuntos se guardan
  en `uploads/` y los indicadores se ven en la propia app; en un despliegue Power Platform
  irían a SharePoint y Power BI.

## Reglas de negocio implementadas (sección 38)

Ninguna OT/aviso procesado se elimina; no se cuenta dos veces un aviso con OT; la antigüedad
se calcula desde el aviso; una OT concluida sale del backlog y requiere reapertura autorizada;
el cierre parcial permanece en backlog si hay pendiente; los números SAP no se duplican;
el técnico no concluye definitivamente; toda modificación crítica queda auditada.

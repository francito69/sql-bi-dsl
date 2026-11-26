# Changelog — `.SQL-BI` (Proyecto 2 - SW608 DSL)

Este archivo es la memoria viva del repositorio. Registra cada hito, decisión técnica y entregable realizado.

## [0.3.0] - 2026-11-26 (`feature/backend-sql-bi`)
### Added
- `backend/src/sqlValidator.js`: Parser SQL con `node-sql-parser` (PostgreSQL) en modo solo lectura obligatorio (bloquea `DROP`, `DELETE`, `UPDATE`, `INSERT`, etc.) y renderizador seguro de templates `{{variable}}`.
- `backend/src/alertEngine.js`: Motor de evaluación de alertas SQL con `node-cron` y registro en `alerta_historial`.
- `backend/src/app.js` y `server.js`: API REST completa (`/api/schema`, `/api/query/validate`, `/api/query/execute`, `/api/templates`, `/api/queries`, `/api/alerts`).

## [0.2.0] - 2026-11-26 (`feature/db-schema-seed`)
### Added
- `db/schema.sql`: Esquema PostgreSQL para ventas retail multicanal (`canales`, `tiendas`, `categorias`, `productos`, `clientes`, `ventas`, `detalle_ventas`) y tablas de plataforma (`sql_templates`, `consultas_guardadas`, `consulta_versiones`, `alertas_sql`, `alerta_historial`).
- `db/seed.sql`: Dataset semilla con 120 ventas históricas, 11 productos, 4 canales, 5 tiendas, 3 templates parametrizables, 1 consulta versionada y 1 alerta de ejemplo.

## [0.1.0] - 2026-11-26
### Added
- Inicialización del repositorio Git en `c:\UNIVERSIDAD\7mo\sql-bi-dsl` (rama `main`).
- Estructura modular base: `backend/`, `frontend/`, `db/`, `docs/`, `tests/`.
- Archivo `.gitignore` para Node.js, variables de entorno y archivos temporales.
- `README.md` base con guía reproducible (`clone → install → run`).

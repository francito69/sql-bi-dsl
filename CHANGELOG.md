# Changelog — `.SQL-BI` (Proyecto 2 - SW608 DSL)

Este archivo es la memoria viva del repositorio. Registra cada hito, decisión técnica y entregable realizado.

## [1.1.0] - 2026-11-26 (`main`)
### Changed
- `db/seed.sql`: Dataset histórico ampliado a **10,000 ventas en 5 años (2022–2026)** con estacionalidad real (picos en Nov/Dic), distribución no uniforme por canal (Web 38%, Tienda 30%, App 22%, Marketplace 10%) y 1–3 ítems por orden.
- `frontend/`: Agregado selector **Modo Analista / Modo Negocio**, tarjetas **KPI automáticas**, banner de errores inline, **Exportar CSV** y tooltips interactivos en **D3.js**.

## [1.0.0] - 2026-11-26 (`feature/docs-dsl`)
### Added
- `docs/ENTREGABLE_DSL.md`: Documentación completa del entregable (bases teóricas, justificación, demostración de abstracción, metamodelo UML en Mermaid, caso de uso `UC-001` + 3 historias de usuario en Gherkin `Given/When/Then` y guión de demo).
- `README.md`: Instrucciones reproducibles `clone → install → run` (Docker Compose y local).

## [0.5.0] - 2026-11-26 (`feature/tests-deploy`)
### Added
- `backend/tests/sqlValidator.test.js`: 7 pruebas unitarias con Jest (100% de funciones y 86.95% de líneas cubiertas en el módulo crítico `sqlValidator.js`).
- `Dockerfile` y `docker-compose.yml`: Despliegue reproducible con PostgreSQL 17 + inicialización automática de esquema y dataset semilla.

## [0.4.0] - 2026-11-26 (`feature/frontend-monaco-d3`)
### Added
- `frontend/index.html`, `styles.css`, `app.js`: Interfaz `.SQL-BI` con Monaco Editor (autocompletado dinámico desde `information_schema`), validación en tiempo real, biblioteca de templates parametrizables, versionado con rollback, gestión de alertas y gráficos interactivos con D3.js (barras/líneas).

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

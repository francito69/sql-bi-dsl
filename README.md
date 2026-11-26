# `.SQL-BI` — Self-service Analytics de Ventas con Editor SQL (DSL Textual)

Proyecto 2 del curso **SW608 Lenguajes de Dominio Específico (DSL)** — UNI FIIS (Semestre 2026-II).

## Stack Tecnológico
- **Base de Datos**: PostgreSQL 17 (esquema de ventas retail multicanal + `information_schema`).
- **Backend**: Node.js + Express + `pg` + `node-sql-parser` (modo solo lectura obligatorio) + `node-cron` (scheduler de alertas).
- **Frontend**: Monaco Editor (autocompletado SQL dinámico) + D3.js (visualización interactiva encadenada).
- **Testing**: Jest / Supertest (cobertura ≥ 60% del módulo crítico).

## Estructura del Proyecto
- `db/` — Esquema SQL y dataset semilla de ventas retail multicanal.
- `backend/` — API REST, parser/validador SQL, templates, versionado y motor de alertas.
- `frontend/` — Interfaz web con Monaco Editor, biblioteca de templates, diff/rollback y gráficos D3.js.
- `tests/` — Pruebas automatizadas unitarias y de integración.
- `docs/` — Bases teóricas, justificación del DSL, metamodelo UML, especificación Gherkin/BDD y guión de demo.

## Instalación y Ejecución (`clone → install → run`)
*(Se completará conforme avancemos con los módulos)*

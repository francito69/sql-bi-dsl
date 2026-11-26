# `.SQL-BI` — Self-service Analytics de Ventas con Editor SQL (DSL Textual)

Proyecto 2 del curso **SW608 Lenguajes de Dominio Específico (DSL)** — UNI FIIS (Semestre 2026-II).

## Stack Tecnológico
- **Base de Datos**: PostgreSQL 17 (esquema de ventas retail multicanal + `information_schema`).
- **Backend**: Node.js + Express + `pg` + `node-sql-parser` (modo solo lectura obligatorio) + `node-cron` (scheduler de alertas).
- **Frontend**: Monaco Editor (autocompletado SQL dinámico) + D3.js (visualización interactiva encadenada).
- **Testing**: Jest (cobertura ≥ 60% del módulo crítico).

## Estructura del Proyecto
- `db/` — `schema.sql` y `seed.sql` (120 ventas históricas, canales, tiendas, productos, templates, versiones y alertas).
- `backend/` — API REST, parser/validador SQL, templates, versionado y motor de alertas.
- `frontend/` — Interfaz web con Monaco Editor, biblioteca de templates, diff/rollback y gráficos D3.js.
- `backend/tests/` — Pruebas automatizadas unitarias.
- `docs/ENTREGABLE_DSL.md` — Bases teóricas, justificación, metamodelo UML, Gherkin/BDD y guión de demo.

## Instalación y Ejecución (`clone → install → run`)

### Opción A: Con Docker Compose (Recomendado)
```bash
git clone https://github.com/francito69/sql-bi-dsl.git
cd sql-bi-dsl
docker compose up --build
```
Abrir en el navegador: `http://localhost:3000`

### Opción B: Local (Node.js + PostgreSQL)
```bash
git clone https://github.com/francito69/sql-bi-dsl.git
cd sql-bi-dsl/backend
npm install
cp .env.example .env
# Crear BD 'sql_bi_dsl' en PostgreSQL y ejecutar db/schema.sql + db/seed.sql
npm start
```

### Ejecutar Tests
```bash
cd backend
npm test
```

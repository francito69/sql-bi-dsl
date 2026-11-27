const request = require('supertest');

const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockPoolQuery = jest.fn();
const mockExecuteReadOnlyQuery = jest.fn();

jest.mock('../src/db', () => ({
  pool: {
    query: (...args) => mockPoolQuery(...args),
    connect: jest.fn(async () => ({
      query: mockClientQuery,
      release: mockClientRelease,
    })),
  },
  executeReadOnlyQuery: (...args) => mockExecuteReadOnlyQuery(...args),
}));

const { app } = require('../src/app');
const { evaluateAlert } = require('../src/alertEngine');

describe('API REST .SQL-BI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/query/validate valida SELECT y rechaza DELETE', async () => {
    const okRes = await request(app)
      .post('/api/query/validate')
      .send({ sql: 'SELECT id, nombre FROM canales;' });
    expect(okRes.statusCode).toBe(200);
    expect(okRes.body.valid).toBe(true);

    const badRes = await request(app)
      .post('/api/query/validate')
      .send({ sql: 'DELETE FROM ventas;' });
    expect(badRes.statusCode).toBe(200);
    expect(badRes.body.valid).toBe(false);
    expect(badRes.body.error).toContain('Operación bloqueada');
  });

  test('POST /api/query/execute bloquea SQL destructivo con HTTP 400 y ejecuta SELECT en modo solo lectura', async () => {
    const blocked = await request(app)
      .post('/api/query/execute')
      .send({ sql: 'DROP TABLE ventas;' });
    expect(blocked.statusCode).toBe(400);
    expect(mockExecuteReadOnlyQuery).not.toHaveBeenCalled();

    mockExecuteReadOnlyQuery.mockResolvedValueOnce({
      fields: [{ name: 'canal' }, { name: 'ingresos' }],
      rows: [{ canal: 'E-commerce Web', ingresos: '12500.00' }],
      rowCount: 1,
    });

    const ok = await request(app)
      .post('/api/query/execute')
      .send({ sql: 'SELECT c.nombre AS canal, SUM(v.total) AS ingresos FROM ventas v JOIN canales c ON c.id = v.canal_id GROUP BY c.nombre;' });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.columns).toEqual(['canal', 'ingresos']);
    expect(ok.body.rowCount).toBe(1);
    expect(mockExecuteReadOnlyQuery).toHaveBeenCalledTimes(1);
  });

  test('POST /api/queries calcula MAX(version)+1 tras rollback para evitar colisión', async () => {
    // Simula consulta existente en version_actual = 1 (tras rollback), pero max_version = 2 en historial
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10, nombre: 'Ingresos', version_actual: 1 }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ max_version: 2 }] }) // SELECT MAX(version)
      .mockResolvedValueOnce({}) // INSERT consulta_versiones v3
      .mockResolvedValueOnce({ rows: [{ id: 10, nombre: 'Ingresos', version_actual: 3 }] }) // UPDATE consultas_guardadas
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .post('/api/queries')
      .send({ nombre: 'Ingresos', sql_texto: 'SELECT COUNT(*) FROM ventas;', comentario: 'Post-rollback' });

    expect(res.statusCode).toBe(200);
    expect(res.body.version).toBe(3);
    expect(mockClientRelease).toHaveBeenCalledTimes(1);
  });

  test('POST /api/alerts valida nombre, operador, umbral y SQL', async () => {
    const badOp = await request(app)
      .post('/api/alerts')
      .send({ nombre: 'Test', sql_condicion: 'SELECT 1;', operador: '!=', umbral: 5 });
    expect(badOp.statusCode).toBe(400);

    const badThreshold = await request(app)
      .post('/api/alerts')
      .send({ nombre: 'Test', sql_condicion: 'SELECT 1;', operador: '>', umbral: 'abc' });
    expect(badThreshold.statusCode).toBe(400);

    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'Anuladas', operador: '>', umbral: '3.00' }],
    });

    const ok = await request(app)
      .post('/api/alerts')
      .send({ nombre: 'Anuladas', sql_condicion: 'SELECT COUNT(*) FROM ventas;', operador: '>', umbral: 3 });
    expect(ok.statusCode).toBe(201);
    expect(ok.body.alert.id).toBe(1);
  });

  test('GET /api/health, /api/schema, /api/templates y /api/queries/:id/rollback', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ table_name: 'ventas', column_name: 'total', data_type: 'numeric' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Ventas por Canal' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, consulta_id: 1, version: 1, sql_texto: 'SELECT 1;' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, version_actual: 1 }] });

    const health = await request(app).get('/api/health');
    expect(health.statusCode).toBe(200);
    expect(health.body.db).toBe('connected');

    const schema = await request(app).get('/api/schema');
    expect(schema.statusCode).toBe(200);
    expect(schema.body.schema.ventas).toHaveLength(1);

    const templates = await request(app).get('/api/templates');
    expect(templates.statusCode).toBe(200);
    expect(templates.body.templates).toHaveLength(1);

    const rollback = await request(app).post('/api/queries/1/rollback').send({ version: 1 });
    expect(rollback.statusCode).toBe(200);
    expect(rollback.body.restoredSql).toBe('SELECT 1;');
  });
});

describe('alertEngine - Evaluación de Alertas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('evalúa alerta válida y registra disparo cuando supera umbral', async () => {
    mockExecuteReadOnlyQuery.mockResolvedValueOnce({ rows: [{ valor: '12' }] });
    mockPoolQuery.mockResolvedValueOnce({}).mockResolvedValueOnce({});

    const res = await evaluateAlert({
      id: 1,
      nombre: 'Ventas Anuladas Altas',
      sql_condicion: "SELECT COUNT(*) AS valor FROM ventas WHERE estado = 'anulada';",
      operador: '>',
      umbral: 3,
    });

    expect(res.disparada).toBe(true);
    expect(res.valorObtenido).toBe(12);
    expect(res.mensaje).toContain('ALERTA DISPARADA');
  });

  test('registra alerta normal y maneja SQL inválido en alerta', async () => {
    mockExecuteReadOnlyQuery.mockResolvedValueOnce({ rows: [{ valor: '1' }] });
    mockPoolQuery.mockResolvedValueOnce({}).mockResolvedValueOnce({});

    const normal = await evaluateAlert({
      id: 2,
      nombre: 'Anuladas bajas',
      sql_condicion: 'SELECT 1 AS valor;',
      operador: '>',
      umbral: 5,
    });
    expect(normal.disparada).toBe(false);
    expect(normal.mensaje).toContain('Normal');

    mockPoolQuery.mockResolvedValueOnce({});
    const invalid = await evaluateAlert({
      id: 3,
      nombre: 'Rota',
      sql_condicion: 'DROP TABLE ventas;',
      operador: '>',
      umbral: 0,
    });
    expect(invalid.disparada).toBe(false);
    expect(invalid.valorObtenido).toBeNull();
  });
});

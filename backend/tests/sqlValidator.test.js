const { validateReadOnlySQL, renderSqlTemplate } = require('../src/sqlValidator');

describe('sqlValidator - Modo Solo Lectura (DSL)', () => {
  test('acepta una consulta SELECT simple válida', () => {
    const res = validateReadOnlySQL('SELECT id, nombre FROM canales;');
    expect(res.valid).toBe(true);
    expect(res.ast.type).toBe('select');
  });

  test('acepta SELECT con JOIN, WHERE, GROUP BY y ORDER BY', () => {
    const sql = `
      SELECT c.nombre, COUNT(v.id) AS ordenes, SUM(v.total) AS ingresos
      FROM ventas v
      JOIN canales c ON c.id = v.canal_id
      WHERE v.estado = 'completada'
      GROUP BY c.nombre
      ORDER BY ingresos DESC;
    `;
    const res = validateReadOnlySQL(sql);
    expect(res.valid).toBe(true);
  });

  test('bloquea sentencias DROP, DELETE, UPDATE, INSERT', () => {
    expect(validateReadOnlySQL('DROP TABLE ventas;').valid).toBe(false);
    expect(validateReadOnlySQL('DELETE FROM ventas WHERE id = 1;').valid).toBe(false);
    expect(validateReadOnlySQL("UPDATE ventas SET estado = 'anulada';").valid).toBe(false);
    expect(validateReadOnlySQL("INSERT INTO canales (nombre, tipo) VALUES ('X', 'digital');").valid).toBe(false);
  });

  test('bloquea múltiples sentencias (inyección)', () => {
    const res = validateReadOnlySQL('SELECT * FROM canales; DROP TABLE ventas;');
    expect(res.valid).toBe(false);
  });

  test('rechaza consultas vacías o con sintaxis inválida', () => {
    expect(validateReadOnlySQL('').valid).toBe(false);
    expect(validateReadOnlySQL('SELEC * FORM ventas').valid).toBe(false);
  });

  test('permite palabras clave dentro de cadenas literales, comentarios o CTE SELECT válidos', () => {
    expect(validateReadOnlySQL("SELECT 'update' AS accion, 'drop' AS tipo FROM canales;").valid).toBe(true);
    expect(validateReadOnlySQL('SELECT id, nombre FROM canales -- delete;').valid).toBe(true);
    expect(validateReadOnlySQL('WITH c AS (SELECT id, nombre FROM canales) SELECT * FROM c;').valid).toBe(true);
  });

  test('bloquea DML dentro de CTEs (WITH) y sentencias TRUNCATE/GRANT', () => {
    expect(validateReadOnlySQL('WITH d AS (DELETE FROM ventas RETURNING id) SELECT * FROM d;').valid).toBe(false);
    expect(validateReadOnlySQL('TRUNCATE TABLE ventas;').valid).toBe(false);
    expect(validateReadOnlySQL('GRANT ALL ON ventas TO public;').valid).toBe(false);
  });
});

describe('renderSqlTemplate - Templates Parametrizables', () => {
  test('reemplaza variables {{param}} correctamente', () => {
    const tpl = "SELECT * FROM ventas WHERE fecha BETWEEN '{{fecha_inicio}}' AND '{{fecha_fin}}';";
    const rendered = renderSqlTemplate(tpl, { fecha_inicio: '2026-01-01', fecha_fin: '2026-06-30' });
    expect(rendered).toBe("SELECT * FROM ventas WHERE fecha BETWEEN '2026-01-01' AND '2026-06-30';");
  });

  test('escapa comillas simples en parámetros para prevenir inyección', () => {
    const tpl = "SELECT * FROM categorias WHERE nombre = '{{categoria}}';";
    const rendered = renderSqlTemplate(tpl, { categoria: "Audio' OR '1'='1" });
    expect(rendered).toContain("Audio'' OR ''1''=''1");
  });

  test('protege parámetros numéricos o sin comillas contra inyección SQL', () => {
    const tpl = 'SELECT * FROM ventas LIMIT {{limite}};';
    expect(renderSqlTemplate(tpl, { limite: 10 })).toBe('SELECT * FROM ventas LIMIT 10;');
    const injected = renderSqlTemplate(tpl, { limite: '10 UNION SELECT * FROM alertas_sql' });
    expect(injected).toBe("SELECT * FROM ventas LIMIT '10 UNION SELECT * FROM alertas_sql';");
  });

  test('reemplaza con cadena vacía cuando falta el parámetro', () => {
    const tpl = "SELECT * FROM categorias WHERE nombre = '{{categoria}}';";
    expect(renderSqlTemplate(tpl, {})).toBe("SELECT * FROM categorias WHERE nombre = '';");
  });
});

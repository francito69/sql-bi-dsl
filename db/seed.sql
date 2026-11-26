-- Dataset Semilla: .SQL-BI (Ventas Retail Multicanal)

INSERT INTO canales (nombre, tipo) VALUES
('Tienda Física', 'fisico'),
('E-commerce Web', 'digital'),
('App Móvil', 'digital'),
('Marketplace', 'externo')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tiendas (nombre, ciudad, region) VALUES
('Sede Lima Centro', 'Lima', 'Costa'),
('Sede Miraflores', 'Lima', 'Costa'),
('Sede Arequipa', 'Arequipa', 'Sur'),
('Sede Trujillo', 'Trujillo', 'Norte'),
('Sede Cusco', 'Cusco', 'Sur')
ON CONFLICT DO NOTHING;

INSERT INTO categorias (nombre, margen_objetivo) VALUES
('Electrónica', 22.00),
('Computación', 18.50),
('Hogar Inteligente', 28.00),
('Accesorios', 40.00),
('Audio', 32.00)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO productos (sku, nombre, categoria_id, precio_unitario, costo_unitario) VALUES
('ELEC-001', 'Smart TV 55" 4K', 1, 1899.00, 1450.00),
('ELEC-002', 'Tablet Pro 11"', 1, 1299.00, 980.00),
('COMP-001', 'Laptop Ultrabook 14"', 2, 3299.00, 2650.00),
('COMP-002', 'Monitor IPS 27" QHD', 2, 999.00, 760.00),
('COMP-003', 'Teclado Mecánico RGB', 2, 289.00, 175.00),
('HOG-001', 'Foco Wi-Fi Pack x4', 3, 149.00, 85.00),
('HOG-002', 'Cámara Seguridad 360', 3, 219.00, 130.00),
('ACC-001', 'Mouse Inalámbrico Ergonómico', 4, 119.00, 60.00),
('ACC-002', 'Hub USB-C 7 en 1', 4, 159.00, 80.00),
('AUD-001', 'Audífonos ANC Bluetooth', 5, 499.00, 310.00),
('AUD-002', 'Parlante Portátil Waterproof', 5, 299.00, 180.00)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO clientes (nombre, email, segmento, ciudad, fecha_registro) VALUES
('Carlos Mendoza', 'cmendoza@mail.com', 'VIP', 'Lima', '2025-02-10'),
('Lucía Paredes', 'lparedes@mail.com', 'Regular', 'Lima', '2025-03-15'),
('TechCorp SAC', 'compras@techcorp.pe', 'Corporativo', 'Lima', '2025-01-20'),
('Andrea Quispe', 'aquispe@mail.com', 'Regular', 'Arequipa', '2025-05-04'),
('Jorge Vargas', 'jvargas@mail.com', 'VIP', 'Trujillo', '2025-06-18'),
('Innova Retail SRL', 'logistica@innova.pe', 'Corporativo', 'Arequipa', '2025-04-12'),
('Sofía Castro', 'scastro@mail.com', 'Regular', 'Cusco', '2025-07-22'),
('Miguel Torres', 'mtorres@mail.com', 'VIP', 'Lima', '2025-08-30')
ON CONFLICT (email) DO NOTHING;

-- Generar 120 ventas históricas distribuidas entre 2025-10-01 y 2026-11-25
INSERT INTO ventas (fecha, canal_id, tienda_id, cliente_id, total, estado)
SELECT
    TIMESTAMP '2025-10-01 09:00:00' + (gs * INTERVAL '3 days') + ((gs % 10) * INTERVAL '1 hour'),
    ((gs % 4) + 1),
    CASE WHEN (gs % 4) = 0 THEN ((gs % 5) + 1) ELSE NULL END,
    ((gs % 8) + 1),
    0,
    CASE WHEN gs % 25 = 0 THEN 'anulada' ELSE 'completada' END
FROM generate_series(1, 120) AS gs;

-- Generar detalle_ventas para cada venta
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
SELECT
    v.id,
    p.id,
    ((v.id % 3) + 1) AS cantidad,
    p.precio_unitario,
    ((v.id % 3) + 1) * p.precio_unitario AS subtotal
FROM ventas v
JOIN productos p ON p.id = ((v.id % 11) + 1);

-- Actualizar totales de ventas
UPDATE ventas v
SET total = COALESCE((
    SELECT SUM(dv.subtotal) FROM detalle_ventas dv WHERE dv.venta_id = v.id
), 0);

-- Templates parametrizables iniciales
INSERT INTO sql_templates (nombre, descripcion, sql_template, parametros_json) VALUES
(
    'Ventas por Canal en Rango',
    'Resumen de ingresos y cantidad de órdenes por canal de venta.',
    'SELECT c.nombre AS canal, COUNT(v.id) AS ordenes, SUM(v.total) AS ingresos
FROM ventas v
JOIN canales c ON c.id = v.canal_id
WHERE v.estado = ''completada''
  AND v.fecha BETWEEN ''{{fecha_inicio}}'' AND ''{{fecha_fin}}''
GROUP BY c.nombre
ORDER BY ingresos DESC;',
    '[{"name":"fecha_inicio","default":"2026-01-01"},{"name":"fecha_fin","default":"2026-12-31"}]'::jsonb
),
(
    'Top Productos por Categoría',
    'Ranking de productos más vendidos filtrado por categoría.',
    'SELECT p.nombre AS producto, cat.nombre AS categoria, SUM(dv.cantidad) AS unidades, SUM(dv.subtotal) AS ingresos
FROM detalle_ventas dv
JOIN productos p ON p.id = dv.producto_id
JOIN categorias cat ON cat.id = p.categoria_id
WHERE cat.nombre = ''{{categoria}}''
GROUP BY p.nombre, cat.nombre
ORDER BY ingresos DESC;',
    '[{"name":"categoria","default":"Computación"}]'::jsonb
),
(
    'Ticket Promedio por Segmento',
    'Calcula el ticket promedio de compra según el segmento de cliente.',
    'SELECT cl.segmento, COUNT(v.id) AS compras, ROUND(AVG(v.total), 2) AS ticket_promedio
FROM ventas v
JOIN clientes cl ON cl.id = v.cliente_id
WHERE v.estado = ''completada''
GROUP BY cl.segmento
ORDER BY ticket_promedio DESC;',
    '[]'::jsonb
)
ON CONFLICT (nombre) DO NOTHING;

-- Consulta guardada de ejemplo con 2 versiones
INSERT INTO consultas_guardadas (nombre, descripcion, version_actual) VALUES
('Ingresos Mensuales 2026', 'Evolución mensual de ventas completadas.', 2)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO consulta_versiones (consulta_id, version, sql_texto, comentario)
SELECT id, 1, 'SELECT DATE_TRUNC(''month'', fecha) AS mes, SUM(total) AS ingresos FROM ventas GROUP BY 1 ORDER BY 1;', 'Versión inicial'
FROM consultas_guardadas WHERE nombre = 'Ingresos Mensuales 2026'
ON CONFLICT DO NOTHING;

INSERT INTO consulta_versiones (consulta_id, version, sql_texto, comentario)
SELECT id, 2, 'SELECT TO_CHAR(fecha, ''YYYY-MM'') AS mes, COUNT(*) AS ordenes, SUM(total) AS ingresos FROM ventas WHERE estado = ''completada'' GROUP BY 1 ORDER BY 1;', 'Filtrado por completadas y formato YYYY-MM'
FROM consultas_guardadas WHERE nombre = 'Ingresos Mensuales 2026'
ON CONFLICT DO NOTHING;

-- Alerta de ejemplo
INSERT INTO alertas_sql (nombre, sql_condicion, operador, umbral, intervalo_cron, activa) VALUES
('Ventas Anuladas Altas', 'SELECT COUNT(*) AS valor FROM ventas WHERE estado = ''anulada'';', '>', 3, '*/5 * * * *', TRUE)
ON CONFLICT DO NOTHING;

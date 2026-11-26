-- Esquema de Base de Datos: .SQL-BI (Ventas Retail Multicanal + Plataforma BI)
-- Compatible con PostgreSQL 17

-- 1. Tablas del Dominio: Ventas Retail Multicanal
CREATE TABLE IF NOT EXISTS canales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('fisico', 'digital', 'externo'))
);

CREATE TABLE IF NOT EXISTS tiendas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ciudad VARCHAR(80) NOT NULL,
    region VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    margen_objetivo NUMERIC(5,2) NOT NULL DEFAULT 25.00
);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    costo_unitario NUMERIC(10,2) NOT NULL CHECK (costo_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE,
    segmento VARCHAR(40) NOT NULL CHECK (segmento IN ('Regular', 'VIP', 'Corporativo')),
    ciudad VARCHAR(80) NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    canal_id INTEGER NOT NULL REFERENCES canales(id),
    tienda_id INTEGER REFERENCES tiendas(id),
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada', 'pendiente', 'anulada'))
);

CREATE TABLE IF NOT EXISTS detalle_ventas (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

-- 2. Tablas de Plataforma .SQL-BI (Templates, Versionado y Alertas)
CREATE TABLE IF NOT EXISTS sql_templates (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    descripcion TEXT,
    sql_template TEXT NOT NULL,
    parametros_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultas_guardadas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    descripcion TEXT,
    version_actual INTEGER NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consulta_versiones (
    id SERIAL PRIMARY KEY,
    consulta_id INTEGER NOT NULL REFERENCES consultas_guardadas(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    sql_texto TEXT NOT NULL,
    comentario VARCHAR(255),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (consulta_id, version)
);

CREATE TABLE IF NOT EXISTS alertas_sql (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    sql_condicion TEXT NOT NULL,
    operador VARCHAR(10) NOT NULL CHECK (operador IN ('>', '>=', '<', '<=', '=')),
    umbral NUMERIC(14,2) NOT NULL,
    intervalo_cron VARCHAR(60) NOT NULL DEFAULT '*/5 * * * *',
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_disparo TIMESTAMP,
    ultimo_valor NUMERIC(14,2),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerta_historial (
    id SERIAL PRIMARY KEY,
    alerta_id INTEGER NOT NULL REFERENCES alertas_sql(id) ON DELETE CASCADE,
    valor_obtenido NUMERIC(14,2),
    disparada BOOLEAN NOT NULL,
    mensaje TEXT,
    ejecutado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_canal ON ventas(canal_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta ON detalle_ventas(venta_id);

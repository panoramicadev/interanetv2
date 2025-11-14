-- Migration: Create Weekly Ventas Cliente Aggregate Table
-- Description: Creates table for pre-aggregating sales by client and week to optimize promise fulfillment calculations
-- Author: System
-- Date: 2025-11-12

-- Create weekly_ventas_cliente table in ventas schema
-- Drop existing table if present to ensure clean migration
DROP TABLE IF EXISTS ventas.weekly_ventas_cliente CASCADE;

CREATE TABLE ventas.weekly_ventas_cliente (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL,
  vendedor_id TEXT,
  semana VARCHAR(10) NOT NULL,
  anio INTEGER NOT NULL,
  numero_semana INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total_ventas NUMERIC(20, 2) NOT NULL DEFAULT 0,
  cantidad_transacciones INTEGER DEFAULT 0,
  ultima_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS IDX_weekly_ventas_cliente_semana 
  ON ventas.weekly_ventas_cliente(cliente_id, fecha_inicio);

CREATE INDEX IF NOT EXISTS IDX_weekly_ventas_vendedor_semana 
  ON ventas.weekly_ventas_cliente(vendedor_id, semana);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS UNQ_weekly_ventas_cliente_semana 
  ON ventas.weekly_ventas_cliente(cliente_id, semana);

-- Add comment explaining the table's purpose
COMMENT ON TABLE ventas.weekly_ventas_cliente IS 
  'Tabla agregada que pre-calcula las ventas semanales por cliente. Se popula automáticamente durante el ETL para optimizar el cálculo de cumplimiento de promesas de compra.';

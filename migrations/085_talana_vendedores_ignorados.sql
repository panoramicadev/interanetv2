-- Vendedores del ERP que no son personas.
--
-- `fact_ventas.nokofu` no guarda solo vendedores: también mostradores y canales
-- (MCT Temuco, Mercado Libre, Falabella, Venta Tienda Online, WhatsApp Venta…).
-- Verificado en producción: 14 de los 32 "vendedores" de 2026 son canales, y
-- uno de ellos —MCT TEMUCO— tiene 7% de comisión configurado sobre $241M
-- vendidos, así que aparece con comisión calculada y sin liquidación en Talana.
--
-- Esa alerta no se podía apagar: `talana_vinculos.ignorado` se guarda por
-- `talana_empleado_id`, y un canal no tiene empleado en Talana. Sin esta tabla,
-- la pantalla de Descuadres abre siempre con alertas que nadie puede resolver.
CREATE TABLE IF NOT EXISTS talana_vendedores_ignorados (
  salesperson_name varchar(255) PRIMARY KEY,
  motivo varchar(255),
  actualizado_por varchar,
  created_at timestamp DEFAULT now()
);

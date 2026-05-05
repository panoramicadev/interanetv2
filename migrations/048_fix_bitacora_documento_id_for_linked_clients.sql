-- Reasigna entradas de bitácora creadas vía API/MCP que quedaron con
-- documento_id = crm_seguimiento_clientes.id en vez del cliente_id del ERP.
-- La UI filtra por cliente_id del ERP cuando el seguimiento está vinculado,
-- por eso esas entradas no aparecían en el panel "Bitácora".

UPDATE pedido_bitacora pb
SET documento_id = csc.cliente_id,
    updated_at = NOW()
FROM crm_seguimiento_clientes csc
WHERE pb.documento_tipo = 'cliente'
  AND pb.documento_id = csc.id
  AND csc.cliente_id IS NOT NULL;

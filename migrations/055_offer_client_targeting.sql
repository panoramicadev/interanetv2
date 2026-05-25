-- Migration 055: Targeting de ofertas por cliente
-- Una oferta puede aplicar a TODOS los clientes (all_clients=true, comportamiento
-- previo) o solo a clientes específicos listados en price_list_offer_clients.
-- Las ofertas existentes se quedan como "todos" para no cambiar su alcance.
ALTER TABLE price_list_offers ADD COLUMN IF NOT EXISTS all_clients BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS price_list_offer_clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id VARCHAR NOT NULL REFERENCES price_list_offers(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (offer_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_clients_offer ON price_list_offer_clients(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_clients_client ON price_list_offer_clients(client_id);

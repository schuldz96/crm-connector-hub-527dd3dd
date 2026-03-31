-- Auto-register stage history when estagio_id changes

-- Deals: UPDATE
CREATE OR REPLACE FUNCTION saas.registrar_historico_estagio_negocio()
RETURNS trigger AS $$
BEGIN
  IF OLD.estagio_id IS DISTINCT FROM NEW.estagio_id THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'deal', NEW.id, OLD.estagio_id, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historico_estagio_negocio ON saas.crm_negocios;
CREATE TRIGGER trg_historico_estagio_negocio
  AFTER UPDATE OF estagio_id ON saas.crm_negocios
  FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_negocio();

-- Deals: INSERT (first stage)
CREATE OR REPLACE FUNCTION saas.registrar_historico_estagio_insert_negocio()
RETURNS trigger AS $$
BEGIN
  IF NEW.estagio_id IS NOT NULL THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'deal', NEW.id, NULL, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historico_estagio_insert_negocio ON saas.crm_negocios;
CREATE TRIGGER trg_historico_estagio_insert_negocio
  AFTER INSERT ON saas.crm_negocios
  FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_insert_negocio();

-- Tickets: UPDATE
CREATE OR REPLACE FUNCTION saas.registrar_historico_estagio_ticket()
RETURNS trigger AS $$
BEGIN
  IF OLD.estagio_id IS DISTINCT FROM NEW.estagio_id THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'ticket', NEW.id, OLD.estagio_id, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historico_estagio_ticket ON saas.crm_tickets;
CREATE TRIGGER trg_historico_estagio_ticket
  AFTER UPDATE OF estagio_id ON saas.crm_tickets
  FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_ticket();

-- Tickets: INSERT (first stage)
CREATE OR REPLACE FUNCTION saas.registrar_historico_estagio_insert_ticket()
RETURNS trigger AS $$
BEGIN
  IF NEW.estagio_id IS NOT NULL THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'ticket', NEW.id, NULL, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historico_estagio_insert_ticket ON saas.crm_tickets;
CREATE TRIGGER trg_historico_estagio_insert_ticket
  AFTER INSERT ON saas.crm_tickets
  FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_insert_ticket();

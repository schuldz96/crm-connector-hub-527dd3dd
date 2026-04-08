-- Adicionar novos papéis ao ENUM
ALTER TYPE saas.papel_usuario ADD VALUE IF NOT EXISTS 'bdr';
ALTER TYPE saas.papel_usuario ADD VALUE IF NOT EXISTS 'sdr';
ALTER TYPE saas.papel_usuario ADD VALUE IF NOT EXISTS 'closer';
ALTER TYPE saas.papel_usuario ADD VALUE IF NOT EXISTS 'key_account';
ALTER TYPE saas.papel_usuario ADD VALUE IF NOT EXISTS 'csm';
ALTER TYPE saas.papel_usuario ADD VALUE IF NOT EXISTS 'low_touch';

-- Trocar coluna de ENUM para TEXT para permitir flexibilidade futura
ALTER TABLE saas.usuarios ALTER COLUMN papel TYPE TEXT USING papel::TEXT;

-- Limpar "vendedor" (antigo Analista) para reatribuição manual pelo time
UPDATE saas.usuarios SET papel = 'sdr' WHERE papel = 'vendedor';

-- Disable RLS on CRM tables to match the pattern of other saas schema tables.
-- Access control is enforced at the application level via empresa_id filtering.

DROP POLICY IF EXISTS crm_pipelines_por_empresa ON saas.crm_pipelines;
DROP POLICY IF EXISTS crm_pipeline_estagios_por_empresa ON saas.crm_pipeline_estagios;
DROP POLICY IF EXISTS crm_negocios_por_empresa ON saas.crm_negocios;
DROP POLICY IF EXISTS crm_tickets_por_empresa ON saas.crm_tickets;
DROP POLICY IF EXISTS crm_contatos_por_empresa ON saas.crm_contatos;
DROP POLICY IF EXISTS crm_empresas_por_empresa ON saas.crm_empresas;
DROP POLICY IF EXISTS crm_associacoes_por_empresa ON saas.crm_associacoes;
DROP POLICY IF EXISTS crm_notas_por_empresa ON saas.crm_notas;
DROP POLICY IF EXISTS crm_atividades_por_empresa ON saas.crm_atividades;
DROP POLICY IF EXISTS crm_historico_estagios_por_empresa ON saas.crm_historico_estagios;
DROP POLICY IF EXISTS crm_estagio_ia_config_por_empresa ON saas.crm_estagio_ia_config;

ALTER TABLE saas.crm_pipelines DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_pipeline_estagios DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_negocios DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_contatos DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_associacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_notas DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_atividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_historico_estagios DISABLE ROW LEVEL SECURITY;
ALTER TABLE saas.crm_estagio_ia_config DISABLE ROW LEVEL SECURITY;

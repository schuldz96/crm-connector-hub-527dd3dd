-- Add inbox to modulos_sistema (required for FK in configuracoes_modulos_usuario)
INSERT INTO saas.modulos_sistema (codigo, nome, descricao, ativo)
VALUES ('inbox', 'Caixa de Entrada', 'Caixa de entrada WhatsApp Business API (Meta)', true)
ON CONFLICT (codigo) DO NOTHING;

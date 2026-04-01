# OWASP ASVS Level 1 — Checklist Mínimo

## V2 — Authentication
- [ ] Senhas com mínimo 8 caracteres
- [ ] Proteção contra brute force (rate limiting)
- [ ] Credenciais não armazenadas em texto plano
- [ ] Tokens de sessão gerados com entropia suficiente

## V3 — Session Management
- [ ] Session IDs não expostos na URL
- [ ] Sessões invalidadas após logout
- [ ] Timeout de inatividade configurado
- [ ] Tokens com tempo de expiração definido

## V4 — Access Control
- [ ] Princípio do menor privilégio implementado
- [ ] Controle de acesso server-side (não apenas UI)
- [ ] RBAC consistente em todas as rotas
- [ ] Isolamento multi-tenant por empresa_id

## V5 — Input Validation
- [ ] Toda entrada de usuário é validada server-side
- [ ] Queries parametrizadas (sem concatenação SQL)
- [ ] Output encoding para prevenir XSS
- [ ] Upload de arquivos com validação de tipo e tamanho

## V7 — Error Handling & Logging
- [ ] Erros não expõem stack traces em produção
- [ ] Logs registram eventos de segurança (login, falhas, alterações)
- [ ] Logs não contêm dados sensíveis (senhas, tokens)
- [ ] Logging centralizado e protegido

## V8 — Data Protection
- [ ] Dados sensíveis criptografados em repouso
- [ ] HTTPS forçado em todas as comunicações
- [ ] Cache de dados sensíveis desabilitado
- [ ] Dados pessoais com política de retenção

## V9 — Communication Security
- [ ] TLS 1.2+ em todas as conexões
- [ ] Certificados válidos e não auto-assinados
- [ ] HSTS habilitado

## V13 — API & Web Services
- [ ] Autenticação em todos os endpoints de API
- [ ] Rate limiting implementado
- [ ] CORS configurado restritivamente
- [ ] Resposta de API não expõe dados internos

# Pre-Deploy Security Checklist

## Código
- [ ] Nenhum segredo hardcoded no código (tokens, senhas, chaves)
- [ ] .env não está no git (verificar .gitignore)
- [ ] console.log não expõe dados sensíveis
- [ ] Sem TODO/FIXME de segurança pendentes
- [ ] Validação de input em todos os formulários

## Dependências
- [ ] `npm audit` sem vulnerabilidades critical/high
- [ ] Dependências atualizadas (sem CVEs conhecidos)
- [ ] Lock file íntegro e commitado

## Autenticação & Acesso
- [ ] Todas as rotas protegidas com autenticação
- [ ] RLS habilitado em todas as tabelas novas
- [ ] Permissões testadas para cada nível de cargo
- [ ] Tokens com expiração configurada

## Infraestrutura
- [ ] HTTPS forçado
- [ ] CORS restritivo (apenas domínios permitidos)
- [ ] Headers de segurança configurados
- [ ] Edge functions com validação de input

## Dados
- [ ] Dados pessoais novos mapeados no inventário LGPD
- [ ] Base legal definida para coleta
- [ ] Criptografia aplicada onde necessário
- [ ] Logs de auditoria implementados para ações sensíveis

## Build
- [ ] `npx tsc --noEmit --skipLibCheck` — zero erros
- [ ] `npx vite build` — build OK
- [ ] Sem warnings de segurança no build

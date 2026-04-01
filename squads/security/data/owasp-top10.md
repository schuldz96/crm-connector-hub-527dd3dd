# OWASP Top 10 — 2021 Reference

| Rank | ID | Name | Description |
|------|----|------|-------------|
| 1 | A01 | Broken Access Control | Controles de acesso não aplicados corretamente |
| 2 | A02 | Cryptographic Failures | Falhas em criptografia expondo dados sensíveis |
| 3 | A03 | Injection | SQL, NoSQL, OS, LDAP injection |
| 4 | A04 | Insecure Design | Falhas de design sem controles de segurança |
| 5 | A05 | Security Misconfiguration | Configurações padrão inseguras |
| 6 | A06 | Vulnerable Components | Componentes desatualizados com CVEs |
| 7 | A07 | Auth Failures | Falhas de autenticação e identificação |
| 8 | A08 | Data Integrity Failures | Falhas de integridade de software e dados |
| 9 | A09 | Logging Failures | Logging e monitoramento insuficientes |
| 10 | A10 | SSRF | Server-Side Request Forgery |

## Relevância para o Smart Deal Coach

| OWASP | Risco no Projeto | Componente |
|-------|-------------------|------------|
| A01 | ALTO — Multi-tenant, hierarquia de cargos | RLS, accessControl.ts |
| A02 | MÉDIO — Tokens OpenAI criptografados | token_criptografado |
| A03 | BAIXO — Supabase usa queries parametrizadas | Supabase SDK |
| A04 | MÉDIO — Novas features sem threat model | Processo |
| A05 | MÉDIO — Edge functions, CORS, headers | Supabase config |
| A06 | MÉDIO — Dependências npm | package.json |
| A07 | ALTO — Auth Supabase + sessões | AuthContext |
| A08 | MÉDIO — Deploy automático sem assinatura | Lovable CI/CD |
| A09 | ALTO — Logs limitados, sem SIEM | Audit context |
| A10 | BAIXO — Poucas chamadas server-side externas | Edge functions |

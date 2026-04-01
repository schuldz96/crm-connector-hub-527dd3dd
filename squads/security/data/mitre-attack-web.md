# MITRE ATT&CK — Web Application Tactics (Subset)

## Tactics Relevantes

### Initial Access
- **T1190** Exploit Public-Facing Application
- **T1078** Valid Accounts (credential stuffing, leaked credentials)

### Execution
- **T1059** Command and Scripting Interpreter (injection)
- **T1203** Exploitation for Client Execution (XSS)

### Persistence
- **T1098** Account Manipulation
- **T1136** Create Account

### Privilege Escalation
- **T1078** Valid Accounts (horizontal/vertical escalation)
- **T1548** Abuse Elevation Control Mechanism

### Defense Evasion
- **T1070** Indicator Removal (log tampering)
- **T1562** Impair Defenses (bypass RLS)

### Credential Access
- **T1110** Brute Force
- **T1539** Steal Web Session Cookie
- **T1528** Steal Application Access Token

### Discovery
- **T1087** Account Discovery
- **T1069** Permission Groups Discovery

### Collection
- **T1530** Data from Cloud Storage
- **T1213** Data from Information Repositories

### Exfiltration
- **T1567** Exfiltration Over Web Service
- **T1041** Exfiltration Over C2 Channel

## Mapeamento para Smart Deal Coach

| Technique | Componente Vulnerável | Risco |
|-----------|----------------------|-------|
| T1190 | Edge functions, APIs Meta/Evolution | Alto |
| T1078 | Supabase Auth, JWT | Alto |
| T1059/T1203 | Inputs não sanitizados, XSS | Médio |
| T1539 | Session tokens, cookies | Médio |
| T1528 | Tokens OpenAI, Meta, Evolution | Alto |
| T1530 | Supabase Storage (transcrições) | Médio |
| T1562 | RLS bypass via service role | Alto |

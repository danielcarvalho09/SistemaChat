# 🔒 Documentação de Segurança

Este documento descreve as medidas de segurança implementadas no projeto para proteger contra vulnerabilidades comuns, incluindo XSS, SQL Injection, Command Injection e outras ameaças.

## ✅ Proteções Implementadas

### 1. Backend - Proteções de Segurança

#### 1.1 Middleware de Sanitização (`sanitize.middleware.ts`)
- ✅ **Sanitização automática** de todos os inputs (body, query, params)
- ✅ **Detecção de conteúdo malicioso** antes do processamento
- ✅ **Sanitização específica por tipo de campo**:
  - HTML fields: Remove tags HTML perigosas
  - Text fields: Remove caracteres de controle
  - Email fields: Valida e normaliza emails
  - URL fields: Valida protocolos permitidos (http, https)
  - Phone fields: Remove caracteres não-numéricos

#### 1.2 Middleware de Segurança (`security.middleware.ts`)
- ✅ **Proteção contra SQL Injection**:
  - Detecção de padrões SQL maliciosos
  - Bloqueio de caracteres perigosos (`'`, `--`, `#`, `union`, etc)
  
- ✅ **Proteção contra XSS**:
  - Detecção de tags `<script>`, `javascript:`, eventos `on*`
  - Bloqueio de `<iframe>`, `<object>`, `<embed>`
  
- ✅ **Proteção contra Path Traversal**:
  - Detecção de `../` e `..\`
  - Validação de caminhos de arquivo

- ✅ **Proteção contra Brute Force**:
  - Limite de 1000 requisições por IP a cada 15 minutos
  - Bloqueio automático de IPs suspeitos

#### 1.3 Utilitários de Sanitização (`utils/sanitizer.ts`)
- ✅ **Biblioteca `xss`** (4M+ downloads/semana) para sanitização HTML
- ✅ **Funções especializadas**:
  - `sanitizeHTML()` - Remove todas as tags HTML
  - `sanitizeText()` - Remove caracteres de controle
  - `sanitizeEmail()` - Valida e normaliza emails
  - `sanitizeURL()` - Valida URLs e bloqueia protocolos perigosos
  - `sanitizePhone()` - Remove caracteres não-numéricos
  - `sanitizePath()` - Previne path traversal
  - `sanitizeChatMessage()` - Sanitização específica para mensagens (permite emojis)
  - `containsMaliciousContent()` - Detecta conteúdo suspeito

#### 1.4 Validação com Zod (`utils/validators.ts`)
- ✅ **Validação de schema** para todos os inputs
- ✅ **Type-safe validation** com TypeScript
- ✅ **Validação de tipos** (UUID, email, date, etc)

#### 1.5 Helmet.js (`app.ts`)
- ✅ **Content Security Policy (CSP)** em produção
- ✅ **Headers de segurança**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security` (HSTS) em produção
  - `Referrer-Policy: strict-origin-when-cross-origin`

#### 1.6 Rate Limiting (`@fastify/rate-limit`)
- ✅ **Limite de requisições** por IP
- ✅ **Configurável** via variáveis de ambiente

#### 1.7 CORS Configurado
- ✅ **Origins permitidas** configuráveis
- ✅ **Credenciais** controladas
- ✅ **Headers permitidos** restritos

### 2. Frontend - Proteções de Segurança

#### 2.1 React - Proteção Nativa
- ✅ **Sem `dangerouslySetInnerHTML`** - Nenhum uso encontrado
- ✅ **Sem `innerHTML` ou `outerHTML`** - Nenhum uso encontrado
- ✅ **React escapa automaticamente** todos os valores renderizados
- ✅ **JSX previne XSS** por padrão ao escapar strings

#### 2.2 Validação de Inputs
- ✅ **Validação no frontend** antes de enviar ao backend
- ✅ **Sanitização no backend** como camada adicional

#### 2.3 Axios Interceptors
- ✅ **Headers de autenticação** gerenciados automaticamente
- ✅ **Tratamento de erros** centralizado

### 3. Proteção contra "React2Shell" / Command Injection

#### 3.1 Backend
- ✅ **Nenhum uso de `eval()` ou `Function()`**
- ✅ **Nenhum uso de `child_process.exec()` ou `child_process.spawn()` com inputs do usuário**
- ✅ **Validação rigorosa de arquivos** antes de processar
- ✅ **Sanitização de nomes de arquivo** (`sanitizeFileName()`)
- ✅ **Validação de tipos MIME** antes de aceitar uploads

#### 3.2 Frontend
- ✅ **Nenhum uso de `eval()` ou `Function()`**
- ✅ **Nenhum uso de `dangerouslySetInnerHTML`**
- ✅ **React previne injeção de código** por design

### 4. Proteção de Dados Sensíveis

#### 4.1 Criptografia
- ✅ **AES-256** para dados sensíveis (authData do WhatsApp)
- ✅ **Bcrypt** para senhas (12 rounds)
- ✅ **JWT** para tokens de autenticação

#### 4.2 Variáveis de Ambiente
- ✅ **Validação de variáveis** com Zod
- ✅ **Secrets não expostos** no código
- ✅ **`.env` no `.gitignore`**

### 5. Proteção de Uploads

#### 5.1 Validação de Arquivos
- ✅ **Validação de tipo MIME** com `sharp` e `file-type`
- ✅ **Validação de tamanho** (configurável)
- ✅ **Sanitização de nomes de arquivo**
- ✅ **Tipos permitidos** restritos

#### 5.2 Armazenamento
- ✅ **Uploads para Supabase Storage** (não sistema de arquivos local)
- ✅ **URLs assinadas** para acesso seguro

## ⚠️ Vulnerabilidades Conhecidas e Mitigações

### 1. XSS (Cross-Site Scripting)
**Status**: ✅ **PROTEGIDO**

**Proteções**:
- React escapa automaticamente strings
- Backend sanitiza todos os inputs
- Middleware XSS detecta e bloqueia tentativas
- CSP em produção

**Recomendação**: Continuar evitando `dangerouslySetInnerHTML`

### 2. SQL Injection
**Status**: ✅ **PROTEGIDO**

**Proteções**:
- Prisma ORM previne SQL injection por design
- Middleware detecta padrões SQL maliciosos
- Validação de inputs com Zod
- Queries parametrizadas

**Recomendação**: Sempre usar Prisma, nunca queries raw com inputs do usuário

### 3. Command Injection
**Status**: ✅ **PROTEGIDO**

**Proteções**:
- Nenhum uso de `child_process` com inputs do usuário
- Validação rigorosa de arquivos
- Sanitização de nomes de arquivo
- Sem `eval()` ou `Function()`

**Recomendação**: Continuar evitando execução de comandos com inputs do usuário

### 4. Path Traversal
**Status**: ✅ **PROTEGIDO**

**Proteções**:
- Middleware detecta `../` e `..\`
- Sanitização de caminhos
- Uploads para Supabase Storage (não sistema de arquivos)

**Recomendação**: Continuar usando Supabase Storage para uploads

### 5. CSRF (Cross-Site Request Forgery)
**Status**: ⚠️ **PARCIALMENTE PROTEGIDO**

**Proteções**:
- CORS configurado
- JWT tokens
- SameSite cookies (se configurado)

**Recomendação**: Considerar adicionar tokens CSRF para operações críticas

### 6. Brute Force
**Status**: ✅ **PROTEGIDO**

**Proteções**:
- Rate limiting por IP
- Limite de tentativas de login
- Bloqueio automático de IPs suspeitos

## 🔍 Checklist de Segurança

### Backend
- [x] Sanitização de inputs
- [x] Validação com Zod
- [x] Proteção XSS
- [x] Proteção SQL Injection
- [x] Proteção Path Traversal
- [x] Rate limiting
- [x] Helmet.js (CSP, headers)
- [x] CORS configurado
- [x] Criptografia de dados sensíveis
- [x] Validação de uploads
- [x] Logging de tentativas de ataque

### Frontend
- [x] Sem `dangerouslySetInnerHTML`
- [x] Sem `eval()` ou `Function()`
- [x] React escapa strings automaticamente
- [x] Validação de inputs
- [x] Tratamento seguro de erros

## 📝 Recomendações Adicionais

1. **Auditoria de Segurança Regular**
   - Revisar logs de tentativas de ataque
   - Atualizar dependências regularmente
   - Executar scans de vulnerabilidade

2. **Monitoramento**
   - Alertas para tentativas de ataque
   - Monitoramento de rate limits
   - Logs de segurança centralizados

3. **Testes de Segurança**
   - Testes de penetração
   - Testes automatizados de segurança
   - Validação de inputs com payloads maliciosos

4. **Atualizações**
   - Manter dependências atualizadas
   - Aplicar patches de segurança rapidamente
   - Monitorar CVE (Common Vulnerabilities and Exposures)

## 🚨 Em Caso de Vulnerabilidade

1. **Não exponha** detalhes do erro em produção
2. **Registre** todas as tentativas de ataque
3. **Bloqueie** IPs suspeitos automaticamente
4. **Notifique** administradores sobre tentativas críticas
5. **Revise** logs regularmente

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Fastify Security](https://www.fastify.io/docs/latest/Guides/Security/)
- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)


# 🚀 WhatsApp Multi-Tenant Customer Service System - Backend

Sistema profissional de atendimento multi-tenant via WhatsApp com arquitetura escalável e moderna.

## ⚡ Principais Características

- 🔐 **Autenticação JWT** com refresh tokens
- 👥 **Multi-tenancy** com isolamento completo de dados
- 💬 **WhatsApp Integration** via Baileys (suporta múltiplas conexões)
- 🎯 **Departamentos e Tags** para organização de conversas
- 📊 **Kanban Board** para gestão visual de atendimentos
- 🔄 **Real-time** com WebSockets (Socket.IO)
- ⚡ **Cache inteligente** com Redis
- 📈 **Métricas e Analytics** de atendimento
- 🎨 **Broadcast** para envio em massa
- 🛡️ **Segurança avançada** (SQL Injection, XSS, Path Traversal)
- 📝 **Audit Logs** completo

## 🏗️ Stack Tecnológico

- **Runtime:** Node.js 20+
- **Framework:** Fastify (alta performance)
- **Language:** TypeScript (ESM)
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Prisma
- **Cache:** Redis Cloud
- **WhatsApp:** Baileys v7
- **Real-time:** Socket.IO
- **Validation:** Zod
- **Logging:** Winston
- **Security:** Helmet, bcrypt, JWT

## 📦 Instalação

### Pré-requisitos

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL (Supabase recomendado)
- Redis (Redis Cloud recomendado)

### Setup

```bash
# 1. Clone o repositório
git clone <repo-url>
cd Tom/backend

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 4. Execute as migrations
npx prisma migrate dev

# 5. (Opcional) Seed inicial de dados
npm run reset:core

# 6. Inicie o servidor de desenvolvimento
npm run dev
```

## 🔧 Variáveis de Ambiente

Veja `.env.example` para todas as variáveis. As principais são:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<gere um secret seguro>
JWT_REFRESH_SECRET=<gere outro secret seguro>
CORS_ORIGIN=http://localhost:5173
```

### Gerar Secrets Seguros

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 📜 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor com hot-reload
npm run build            # Compila TypeScript
npm start                # Inicia servidor de produção

# Database
npm run prisma:generate  # Gera Prisma Client
npm run prisma:migrate   # Executa migrations
npm run prisma:studio    # Abre Prisma Studio (GUI)

# Utilitários
npm run clear:messages   # Limpa todas as mensagens
npm run clean:connections # Remove conexões inativas
npm run reset:core       # Reset com dados essenciais
npm run reset:all        # Reset completo

# Qualidade de Código
npm run lint             # Verifica código
npm run lint:fix         # Corrige problemas automaticamente
npm run format           # Formata código com Prettier
npm test                 # Executa testes
```

## 🏗️ Arquitetura

```
src/
├── config/          # Configurações (DB, Redis, Cache, Logger)
├── controllers/     # Controladores (lógica de requisição/resposta)
├── services/        # Serviços (lógica de negócio)
├── middlewares/     # Middlewares (auth, cache, error, security)
├── routes/          # Definição de rotas
├── utils/           # Utilitários diversos
├── websocket/       # Socket.IO server
├── whatsapp/        # Integração Baileys
├── app.ts           # Configuração do Fastify
└── server.ts        # Entry point
```

### Princípios de Design

- **Clean Architecture**: Separação clara de responsabilidades
- **DRY**: Reutilização de código via services e utils
- **SOLID**: Princípios aplicados em toda a base
- **Type Safety**: TypeScript em modo strict
- **Security First**: Múltiplas camadas de proteção
- **Performance**: Cache, compressão, otimização de queries

## 🔒 Segurança

O sistema implementa múltiplas camadas de segurança:

1. **Helmet.js** - Headers de segurança HTTP
2. **CORS** configurado adequadamente
3. **Rate Limiting** global e por rota
4. **SQL Injection Protection** - Detecção de patterns maliciosos
5. **XSS Protection** - Sanitização de inputs
6. **Path Traversal Protection** - Validação de caminhos
7. **JWT** com expiração e refresh tokens
8. **Bcrypt** para hashing de senhas (12 rounds)
9. **File Type Validation** - Validação real de MIME types
10. **Audit Logs** - Rastreamento de todas as ações críticas

## 📊 Performance

- **Caching**: Redis com TTL inteligente
- **Compression**: GZIP automático (70-90% redução)
- **Database Indexes**: Otimizados no Prisma
- **Query Optimization**: Lazy loading e select específico
- **Connection Pooling**: Gerenciado pelo Prisma
- **Timeouts**: Configurados em todas as requisições

## 🌐 API Documentation

Quando em desenvolvimento, acesse:

```
http://localhost:3000/docs
```

Swagger/OpenAPI disponível automaticamente.

## 🚀 Deploy

### Railway (Recomendado)

O projeto está configurado para deploy no Railway:

```bash
# 1. Certifique-se de ter as configurações corretas
# - railway.toml
# - nixpacks.toml
# - Variáveis de ambiente no dashboard

# 2. Faça commit e push
git push origin main

# 3. Railway fará deploy automático
```

Variáveis necessárias no Railway:
- Todas do `.env.example`
- `NODE_ENV=production`
- `CORS_ORIGIN=<url-do-frontend>`

## 🧪 Testes

```bash
# Testes unitários
npm test

# Testes com coverage
npm run test:coverage

# Testes E2E
npm run test:e2e

# Watch mode
npm run test:watch
```

## 📝 Logging

Sistema de logs estruturado com Winston:

- **Console**: Desenvolvimento (colorido e legível)
- **Files**: Produção (`logs/combined.log`, `logs/error.log`)
- **Levels**: error, warn, info, debug

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add: amazing feature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Commit

- `Add:` Nova funcionalidade
- `Fix:` Correção de bug
- `Update:` Atualização de código existente
- `Refactor:` Refatoração sem mudança de comportamento
- `Docs:` Documentação
- `Test:` Testes
- `Chore:` Tarefas de manutenção

## 📄 Licença

Proprietary - Todos os direitos reservados

## 🆘 Suporte

Para questões e suporte:
- Abra uma issue no GitHub
- Contate o time de desenvolvimento

---

**Desenvolvido com ❤️ para excelência em atendimento ao cliente**

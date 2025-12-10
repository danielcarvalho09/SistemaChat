# 📱 Sistema de Atendimento WhatsApp Multi-Tenant

Sistema completo de atendimento ao cliente via WhatsApp com suporte multi-tenant, Kanban, broadcast, IA integrada e muito mais.

## 📁 Estrutura do Projeto

```
Tom/
├── backend/              # Backend Node.js + TypeScript + Fastify
│   ├── src/             # Código fonte
│   │   ├── controllers/ # Controladores das rotas
│   │   ├── services/    # Lógica de negócio
│   │   ├── routes/      # Definição de rotas
│   │   ├── middlewares/ # Middlewares (auth, cache, etc)
│   │   ├── scripts/     # Scripts utilitários
│   │   └── ...
│   ├── prisma/          # Schema e migrações do banco
│   ├── scripts/         # Scripts administrativos
│   └── ...
├── frontend/            # Frontend React + TypeScript + Vite
│   └── src/
│       ├── components/  # Componentes React
│       ├── pages/       # Páginas da aplicação
│       ├── store/       # Estado global (Zustand)
│       └── ...
├── docs/                # Documentação do projeto
├── scripts/             # Scripts de deployment e instalação
│   └── deployment/      # Scripts de deploy
├── database/            # Scripts SQL e schemas
└── README.md           # Este arquivo
```

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+
- PostgreSQL (ou Supabase)
- Redis (opcional, para cache)
- npm ou yarn

### Instalação

```bash
# Instalar dependências do backend
cd backend
npm install

# Instalar dependências do frontend
cd ../frontend
npm install
```

### Configuração

1. **Backend**: Configure as variáveis de ambiente em `backend/.env`
   - Veja `docs/MIGRACAO_SUPABASE.md` para detalhes das credenciais

2. **Frontend**: Configure as variáveis de ambiente em `frontend/.env`

### Executar

```bash
# Backend (desenvolvimento)
cd backend
npm run dev

# Frontend (desenvolvimento)
cd frontend
npm run dev
```

## 📚 Documentação

- [Guia de Migração Supabase](docs/MIGRACAO_SUPABASE.md) - Como migrar para nova conta Supabase
- [Script SQL de Replicação](database/replicate-database-schema.sql) - Script completo para replicar schema
- [Documentação de Segurança](docs/SEGURANCA.md) - Proteções contra XSS, SQL Injection, Command Injection e outras vulnerabilidades
- [Funis Inteligentes](docs/FUNIS_INTELIGENTES.md) - Sistema de geração automática de funis de vendas com IA
- [Configuração OpenRouter](backend/OPENROUTER_CONFIG.md) - Como configurar a API do OpenRouter

## 🛠️ Scripts Úteis

### Backend

```bash
# Seed do banco de dados
npm run seed

# Promover usuário a admin
npm run promote-admin [email]

# Gerar chave de criptografia
npm run generate:encryption-key

# Limpar conexões inativas
npm run clean:connections
```

### Scripts Administrativos

```bash
# Criar admin
cd backend/scripts/admin
tsx create-admin.ts

# Configurar departamentos
tsx setup-departments.js
```

Veja mais detalhes em:
- [Scripts do Backend](backend/scripts/README.md)
- [Scripts do Source](backend/src/scripts/README.md)
- [Scripts de Deployment](scripts/deployment/README.md)

## 📦 Tecnologias Principais

- **Backend**: Node.js, TypeScript, Fastify, Prisma, Socket.IO
- **Frontend**: React, TypeScript, Vite, TailwindCSS, Zustand, ReactFlow
- **Banco de Dados**: PostgreSQL (Supabase)
- **Cache**: Redis
- **WhatsApp**: Baileys
- **IA**: OpenRouter + Google Gemini 2.0 Flash (Funis Inteligentes)

## 🔐 Segurança

- Autenticação JWT
- Criptografia AES-256 para dados sensíveis
- Rate limiting
- Sanitização de inputs
- CORS configurável

## 📝 Licença

PROPRIETARY - Todos os direitos reservados


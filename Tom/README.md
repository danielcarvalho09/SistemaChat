# Sistema de Atendimento WhatsApp Multi-Tenant

Sistema empresarial completo de atendimento ao cliente via WhatsApp com suporte a múltiplas conexões, gerenciamento multi-usuário, controle granular de permissões (RBAC), sistema de setores e filas de atendimento.

## 🚀 Funcionalidades Principais

### Autenticação e Autorização
- ✅ Sistema de cadastro e login com JWT
- ✅ Controle de acesso baseado em roles (Admin/User)
- ✅ Multi-tenancy com isolamento de dados por conexão
- ✅ Refresh token com rotação automática

### Gerenciamento de Conexões WhatsApp
- ✅ Múltiplas conexões simultâneas via QR Code
- ✅ Reconexão automática com persistência de sessão
- ✅ Health check e monitoramento de status
- ✅ Gerenciamento de instâncias isoladas

### Sistema de Atendimento
- ✅ Interface estilo WhatsApp Web (3 colunas)
- ✅ Filas de atendimento (Aguardando → Em Atendimento)
- ✅ Sistema de setores departamentais
- ✅ Transferência de conversas entre setores/usuários
- ✅ Histórico completo de atendimentos

### Comunicação em Tempo Real
- ✅ WebSocket para sincronização instantânea
- ✅ Notificações desktop e sonoras
- ✅ Indicador de digitação
- ✅ Status de leitura de mensagens

### Dashboard Analítico
- ✅ Métricas de performance (TTFR, TTR)
- ✅ Gráficos de volume e distribuição
- ✅ Relatórios exportáveis (Excel/PDF)
- ✅ Monitoramento de equipe em tempo real

## 🛠️ Stack Tecnológica

### Backend
- **Runtime:** Node.js 20+ com TypeScript
- **Framework:** Fastify (alta performance)
- **ORM:** Prisma (type-safe database access)
- **WebSocket:** Socket.io
- **Queue:** BullMQ com Redis
- **Auth:** JWT + Bcrypt
- **WhatsApp:** whatsapp-web.js

### Frontend
- **Framework:** React 18+ com TypeScript
- **Build Tool:** Vite
- **UI:** TailwindCSS + Shadcn/ui
- **State:** Zustand
- **Data Fetching:** React Query
- **WebSocket:** Socket.io-client
- **Validation:** Zod

### Infraestrutura
- **Database:** PostgreSQL 15+
- **Cache:** Redis 7+
- **Proxy:** Nginx
- **Container:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana

## 📦 Instalação

### Pré-requisitos
- Node.js 20+
- Docker e Docker Compose
- Git

### 1. Clone o repositório
```bash
git clone <repository-url>
cd Tom
```

### 2. Configure as variáveis de ambiente

**Backend (.env):**
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/whatsapp_system"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Server
PORT=3000
NODE_ENV="development"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# WhatsApp
WHATSAPP_SESSION_PATH="./whatsapp-sessions"
MAX_CONNECTIONS=100
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

### 3. Inicie os serviços com Docker
```bash
docker-compose up -d
```

### 4. Instale as dependências

**Backend:**
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  React + TypeScript + TailwindCSS + Socket.io-client        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS/WSS
┌────────────────────▼────────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    BACKEND (Node.js + Fastify)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   REST API   │  │  WebSocket   │  │   WhatsApp   │      │
│  │  Controllers │  │    Server    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────┬───────────────┬───────────────┬────────────────┘
             │               │               │
    ┌────────▼────────┐ ┌───▼────┐ ┌────────▼────────┐
    │   PostgreSQL    │ │ Redis  │ │  WhatsApp Web   │
    │   (Database)    │ │(Cache) │ │   Instances     │
    └─────────────────┘ └────────┘ └─────────────────┘
```

## 📚 Estrutura do Projeto

```
Tom/
├── backend/
│   ├── src/
│   │   ├── config/          # Configurações (DB, Redis, JWT)
│   │   ├── controllers/     # Controladores REST
│   │   ├── middlewares/     # Auth, validation, error handling
│   │   ├── models/          # Tipos TypeScript
│   │   ├── services/        # Lógica de negócio
│   │   ├── routes/          # Definição de rotas
│   │   ├── websocket/       # Handlers WebSocket
│   │   ├── whatsapp/        # Integração WhatsApp
│   │   └── utils/           # Helpers e utilitários
│   ├── prisma/
│   │   └── schema.prisma    # Schema do banco de dados
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas/Views
│   │   ├── hooks/           # Custom hooks
│   │   ├── store/           # Zustand stores
│   │   ├── services/        # API clients
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## 🔐 Segurança

- ✅ HTTPS obrigatório (TLS 1.3)
- ✅ Proteção contra OWASP Top 10
- ✅ Rate limiting por IP e usuário
- ✅ Sanitização de inputs (client + server)
- ✅ Criptografia AES-256 para dados sensíveis
- ✅ HttpOnly cookies com flags Secure/SameSite
- ✅ Logs de auditoria imutáveis
- ✅ Validação de schemas com Zod

## 📊 Performance

- **Latência:** < 500ms (p95)
- **Usuários simultâneos:** 500+
- **Conexões WhatsApp:** 100 por instância
- **First Contentful Paint:** < 1.5s
- **Uptime:** 99.5%

## 🧪 Testes

```bash
# Backend
cd backend
npm run test          # Unit tests
npm run test:e2e      # Integration tests
npm run test:cov      # Coverage report

# Frontend
cd frontend
npm run test          # Component tests
npm run test:e2e      # E2E tests (Playwright)
```

## 📖 Documentação da API

Após iniciar o backend, acesse:
- **Swagger UI:** http://localhost:3000/docs
- **OpenAPI JSON:** http://localhost:3000/docs/json

## 🚀 Deploy

### Produção com Docker
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Variáveis de ambiente obrigatórias em produção:
- `DATABASE_URL` (PostgreSQL connection string)
- `REDIS_URL` (Redis connection string)
- `JWT_SECRET` (strong random key)
- `JWT_REFRESH_SECRET` (strong random key)
- `NODE_ENV=production`

## 📝 Licença

Proprietary - Todos os direitos reservados

## 👥 Suporte

Para suporte técnico, entre em contato com a equipe de desenvolvimento.

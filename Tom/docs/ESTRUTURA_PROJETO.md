# 📁 Estrutura Detalhada do Projeto

## Visão Geral

```
Tom/
├── backend/              # Backend Node.js + TypeScript
├── frontend/            # Frontend React + TypeScript
├── docs/                # Documentação
├── scripts/            # Scripts de deployment e instalação
└── database/           # Scripts SQL e schemas
```

## 📂 Backend

### Estrutura Principal

```
backend/
├── src/
│   ├── config/         # Configurações (database, cache, logger, etc)
│   ├── controllers/    # Controladores das rotas API
│   ├── services/       # Lógica de negócio
│   ├── routes/         # Definição de rotas
│   ├── middlewares/    # Middlewares (auth, cache, rate-limit, etc)
│   ├── scripts/        # Scripts utilitários
│   │   ├── admin/     # Scripts administrativos
│   │   └── maintenance/# Scripts de manutenção
│   ├── utils/          # Funções utilitárias
│   ├── websocket/      # Servidor WebSocket
│   └── whatsapp/       # Integração WhatsApp (Baileys)
├── prisma/             # Schema e migrações do banco
│   └── migrations/     # Migrações do Prisma
├── scripts/            # Scripts executáveis
│   ├── admin/          # Scripts administrativos
│   ├── maintenance/    # Scripts de manutenção
│   └── migration/      # Scripts de migração
└── dist/               # Código compilado (gerado)
```

### Scripts por Categoria

#### Admin (`backend/scripts/admin/`)
- `create-admin.ts` - Criar usuário administrador
- `generate-encryption-key.ts` - Gerar chave de criptografia
- `setup-departments.js` - Configurar departamentos iniciais

#### Maintenance (`backend/scripts/maintenance/`)
- `delete-inactive-connections.ts` - Limpar conexões inativas

#### Migration (`backend/scripts/migration/`)
- `migrate-encrypt-authdata.ts` - Migrar dados de autenticação para criptografia

#### Scripts do Source (`backend/src/scripts/`)

**Admin:**
- `promote-admin.ts` - Promover usuário a admin
- `ensure-admin-user.ts` - Garantir que existe um admin

**Maintenance:**
- `fix-duplicate-roles.ts` - Corrigir roles duplicadas
- `fix-multiple-roles.ts` - Garantir apenas uma role por usuário

## 📂 Frontend

```
frontend/
├── src/
│   ├── components/     # Componentes React reutilizáveis
│   ├── pages/          # Páginas da aplicação
│   ├── store/          # Estado global (Zustand)
│   ├── contexts/       # Contextos React
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Bibliotecas e utilitários
│   ├── routes/         # Configuração de rotas
│   └── types/          # Tipos TypeScript
└── dist/              # Build de produção (gerado)
```

## 📂 Docs

```
docs/
└── MIGRACAO_SUPABASE.md  # Guia de migração para Supabase
```

## 📂 Scripts

```
scripts/
├── deployment/        # Scripts de deployment
│   ├── instalar-tudo.sh
│   ├── migrar-para-cloud.sh
│   ├── install-hostinger.sh
│   ├── ecosystem.config.template.js
│   └── railway.json
└── database/          # Scripts relacionados ao banco (vazio por enquanto)
```

## 📂 Database

```
database/
└── replicate-database-schema.sql  # Script SQL para replicar schema completo
```

## 🔧 Comandos NPM Principais

### Backend

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Banco de dados
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio

# Scripts administrativos
npm run seed
npm run promote-admin [email]
npm run clean:connections
npm run generate:encryption-key
```

### Frontend

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview produção
npm run preview
```

## 📝 Convenções

### Nomenclatura de Arquivos
- **Controllers**: `*.controller.ts`
- **Services**: `*.service.ts`
- **Routes**: `*.routes.ts`
- **Middlewares**: `*.middleware.ts`
- **Scripts**: `*.ts` ou `*.js`

### Estrutura de Pastas
- Cada módulo tem sua própria pasta quando necessário
- Scripts são organizados por categoria (admin, maintenance, migration)
- Documentação centralizada em `docs/`

## 🚀 Próximos Passos

1. Adicionar mais documentação conforme necessário
2. Criar guias de contribuição
3. Adicionar testes automatizados
4. Configurar CI/CD


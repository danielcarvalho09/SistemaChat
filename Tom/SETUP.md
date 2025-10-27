# Guia de Instalação e Configuração

## 📋 Pré-requisitos

- **Node.js** 20+ e npm 10+
- **Docker** e Docker Compose
- **Git**

## 🚀 Instalação Rápida

### 1. Configurar Variáveis de Ambiente

**Backend (.env):**
```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/whatsapp_system"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="seu-secret-super-seguro-aqui-minimo-32-caracteres"
JWT_REFRESH_SECRET="seu-refresh-secret-super-seguro-aqui-minimo-32"
```

**Frontend (.env):**
```bash
cd frontend
cp .env.example .env
```

### 2. Iniciar Serviços com Docker

```bash
# Na raiz do projeto
docker-compose up -d postgres redis
```

### 3. Instalar Dependências e Iniciar Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

O backend estará rodando em `http://localhost:3000`

### 4. Instalar Dependências e Iniciar Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## 📝 Próximos Passos

### Criar Primeiro Usuário Admin

1. Acesse `http://localhost:5173/register`
2. Crie uma conta com seu email e senha
3. No banco de dados, promova o usuário para admin:

```sql
-- Conectar ao PostgreSQL
psql -U postgres -d whatsapp_system

-- Encontrar o ID do usuário e da role admin
SELECT id, email FROM users;
SELECT id, name FROM roles WHERE name = 'admin';

-- Atribuir role admin ao usuário
INSERT INTO user_roles (id, user_id, role_id, created_at)
VALUES (gen_random_uuid(), 'USER_ID_AQUI', 'ADMIN_ROLE_ID_AQUI', NOW());
```

### Testar API

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"suasenha"}'
```

## 🐳 Executar Tudo com Docker

```bash
# Build e iniciar todos os serviços
docker-compose up --build

# Parar todos os serviços
docker-compose down

# Ver logs
docker-compose logs -f backend
```

## 🔧 Comandos Úteis

### Backend

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Prisma Studio (GUI do banco)
npm run prisma:studio

# Gerar migration
npx prisma migrate dev --name nome_da_migration

# Reset do banco
npx prisma migrate reset
```

### Frontend

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview da build
npm run preview

# Lint
npm run lint

# Format
npm run format
```

## 📚 Estrutura do Projeto

```
Tom/
├── backend/                 # API Node.js + TypeScript
│   ├── src/
│   │   ├── config/         # Configurações (DB, Redis, Logger)
│   │   ├── controllers/    # Controladores REST
│   │   ├── middlewares/    # Auth, validação, erros
│   │   ├── models/         # Tipos TypeScript
│   │   ├── services/       # Lógica de negócio
│   │   ├── routes/         # Definição de rotas
│   │   ├── utils/          # Utilitários
│   │   └── server.ts       # Entry point
│   ├── prisma/
│   │   └── schema.prisma   # Schema do banco
│   └── package.json
│
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas
│   │   ├── store/         # Zustand stores
│   │   ├── lib/           # Axios, Socket.io, utils
│   │   ├── types/         # TypeScript types
│   │   └── main.tsx       # Entry point
│   └── package.json
│
└── docker-compose.yml     # Orquestração de containers
```

## 🔐 Segurança

### Produção

1. **Altere os secrets:**
   - `JWT_SECRET` e `JWT_REFRESH_SECRET` devem ser strings aleatórias de 32+ caracteres
   - Use `openssl rand -base64 32` para gerar

2. **Configure HTTPS:**
   - Use certificados SSL (Let's Encrypt)
   - Configure o Nginx como reverse proxy

3. **Variáveis de ambiente:**
   - Nunca commite arquivos `.env`
   - Use secrets management (AWS Secrets Manager, HashiCorp Vault)

4. **Database:**
   - Use senhas fortes
   - Configure backups automáticos
   - Restrinja acesso por IP

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"
```bash
# Verificar se PostgreSQL está rodando
docker-compose ps

# Reiniciar PostgreSQL
docker-compose restart postgres
```

### Erro: "Redis connection failed"
```bash
# Verificar se Redis está rodando
docker-compose ps

# Reiniciar Redis
docker-compose restart redis
```

### Erro: "Port already in use"
```bash
# Encontrar processo usando a porta
# Windows:
netstat -ano | findstr :3000

# Matar processo
taskkill /PID <PID> /F
```

### Limpar tudo e recomeçar
```bash
# Parar containers
docker-compose down -v

# Remover node_modules
rm -rf backend/node_modules frontend/node_modules

# Reinstalar
cd backend && npm install
cd ../frontend && npm install

# Recriar banco
cd backend
npx prisma migrate reset
npm run dev
```

## 📞 Suporte

Para problemas ou dúvidas, consulte a documentação completa no README.md

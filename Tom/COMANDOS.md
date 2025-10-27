# 🎯 Guia Rápido de Comandos

## 🚀 Primeira Execução (Setup Completo)

```powershell
# Execute UMA VEZ para configurar tudo
.\setup-local.ps1
```

**O que este script faz:**
- ✅ Verifica Node.js, npm e Docker
- ✅ Gera secrets JWT seguros automaticamente
- ✅ Cria arquivos .env (backend e frontend)
- ✅ Instala todas as dependências
- ✅ Inicia PostgreSQL e Redis (Docker)
- ✅ Executa migrations do banco de dados
- ✅ Deixa tudo pronto para usar

---

## ▶️ Iniciar Aplicação (Uso Diário)

```powershell
# Execute sempre que quiser usar o sistema
.\start.ps1
```

**O que este script faz:**
- ✅ Verifica se Docker está rodando
- ✅ Inicia PostgreSQL e Redis (se não estiverem rodando)
- ✅ Inicia Backend (porta 3000)
- ✅ Inicia Frontend (porta 5173)
- ✅ Mantém tudo rodando até você pressionar Ctrl+C

**Acessos:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

---

## ⏹️ Parar Aplicação

```powershell
# Para parar tudo
.\stop.ps1
```

**O que este script faz:**
- ✅ Para Backend e Frontend
- ✅ Para containers Docker (PostgreSQL e Redis)

---

## 👑 Promover Usuário para Admin

```powershell
# Após criar sua conta no sistema
.\promote-admin.ps1
```

**Passo a passo:**
1. Acesse http://localhost:5173
2. Clique em "Cadastre-se"
3. Crie sua conta (email + senha)
4. Execute `.\promote-admin.ps1`
5. Digite o email que você cadastrou
6. Faça logout e login novamente
7. Agora você é Admin! 🎉

---

## 🔧 Comandos Manuais (Avançado)

### Backend

```powershell
cd backend

# Iniciar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar produção
npm start

# Prisma Studio (GUI do banco)
npx prisma studio

# Nova migration
npx prisma migrate dev --name nome_da_migration

# Reset do banco (CUIDADO: apaga tudo)
npx prisma migrate reset
```

### Frontend

```powershell
cd frontend

# Iniciar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Lint
npm run lint

# Format
npm run format
```

### Docker

```powershell
# Ver containers rodando
docker ps

# Ver logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Parar containers
docker-compose down

# Parar e remover volumes (CUIDADO: apaga dados)
docker-compose down -v

# Reiniciar um container específico
docker-compose restart postgres
docker-compose restart redis

# Acessar PostgreSQL
docker exec -it whatsapp_postgres psql -U postgres -d whatsapp_system

# Acessar Redis
docker exec -it whatsapp_redis redis-cli -a redis_password

# Ver uso de recursos
docker stats
```

---

## 🗄️ Comandos do Banco de Dados

### Conectar ao PostgreSQL

```powershell
docker exec -it whatsapp_postgres psql -U postgres -d whatsapp_system
```

### Queries Úteis

```sql
-- Ver todos os usuários
SELECT id, email, name, is_active FROM users;

-- Ver roles
SELECT * FROM roles;

-- Ver quem é admin
SELECT u.email, u.name, r.name as role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'admin';

-- Ver departamentos
SELECT * FROM departments;

-- Ver conexões WhatsApp
SELECT id, name, phone_number, status FROM whatsapp_connections;

-- Ver conversas
SELECT c.id, co.name as contact, c.status, c.last_message_at
FROM conversations c
JOIN contacts co ON c.contact_id = co.id
ORDER BY c.last_message_at DESC
LIMIT 10;

-- Sair
\q
```

---

## 🐛 Troubleshooting

### Erro: "Docker não está rodando"

```powershell
# Inicie o Docker Desktop manualmente
# Aguarde alguns segundos e tente novamente
```

### Erro: "Porta já está em uso"

```powershell
# Ver o que está usando a porta 3000
netstat -ano | findstr :3000

# Matar processo (substitua <PID> pelo número mostrado)
taskkill /PID <PID> /F

# Ou use portas diferentes no .env
```

### Erro: "Cannot connect to database"

```powershell
# Verificar se PostgreSQL está rodando
docker ps | findstr postgres

# Se não estiver, inicie
docker-compose up -d postgres

# Aguarde 10 segundos e tente novamente
```

### Erro: "Prisma Client not generated"

```powershell
cd backend
npx prisma generate
```

### Limpar tudo e recomeçar

```powershell
# CUIDADO: Isso apaga TODOS os dados!

# 1. Parar tudo
.\stop.ps1

# 2. Remover containers e volumes
docker-compose down -v

# 3. Remover node_modules
Remove-Item -Recurse -Force backend\node_modules
Remove-Item -Recurse -Force frontend\node_modules

# 4. Executar setup novamente
.\setup-local.ps1
```

---

## 📊 Verificar Status

```powershell
# Ver containers rodando
docker ps

# Ver portas em uso
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :5433
netstat -ano | findstr :6380

# Testar API
curl http://localhost:3000/health

# Testar Frontend
start http://localhost:5173
```

---

## 🎯 Fluxo de Trabalho Diário

```powershell
# 1. Abrir PowerShell na pasta do projeto
cd "C:\Users\Dani\Desktop\projeto empresa\Projetos\Tom"

# 2. Iniciar aplicação
.\start.ps1

# 3. Trabalhar no sistema
# Frontend: http://localhost:5173
# Backend: http://localhost:3000

# 4. Quando terminar, pressione Ctrl+C
# Ou execute: .\stop.ps1
```

---

## 📝 Resumo dos Scripts

| Script | Quando Usar | O que Faz |
|--------|-------------|-----------|
| `setup-local.ps1` | **Uma vez** (primeira execução) | Configura tudo do zero |
| `start.ps1` | **Todo dia** (para usar o sistema) | Inicia backend + frontend |
| `stop.ps1` | Quando terminar de usar | Para tudo |
| `promote-admin.ps1` | Após criar conta | Torna você admin |

---

**Dica:** Adicione a pasta do projeto aos favoritos do Windows Explorer para acesso rápido! 🚀

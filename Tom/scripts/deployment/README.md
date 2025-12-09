# 🚀 Scripts de Deployment

Esta pasta contém scripts relacionados ao deployment e instalação do projeto.

## 📄 Arquivos

### `instalar-tudo.sh`
Script completo de instalação que configura todo o ambiente necessário para o projeto.

**Uso:**
```bash
chmod +x scripts/deployment/instalar-tudo.sh
./scripts/deployment/instalar-tudo.sh
```

### `migrar-para-cloud.sh`
Script para migrar o projeto para ambiente cloud (Railway, Heroku, etc).

**Uso:**
```bash
chmod +x scripts/deployment/migrar-para-cloud.sh
./scripts/deployment/migrar-para-cloud.sh
```

### `install-hostinger.sh`
Script específico para instalação em servidor Hostinger.

**Uso:**
```bash
chmod +x scripts/deployment/install-hostinger.sh
./scripts/deployment/install-hostinger.sh
```

### `ecosystem.config.template.js`
Template de configuração do PM2 para gerenciamento de processos.

**Uso:**
1. Copie o template: `cp ecosystem.config.template.js ecosystem.config.js`
2. Ajuste as configurações conforme necessário
3. Execute: `pm2 start ecosystem.config.js`

### `railway.json`
Configuração para deployment no Railway.

## ⚠️ Notas

- Todos os scripts `.sh` precisam ter permissão de execução (`chmod +x`)
- Revise as variáveis de ambiente antes de executar
- Faça backup antes de executar scripts de migração


# 📦 Como Instalar Node.js no Mac

## ❌ Erro: "command not found: npx"

Isso significa que o Node.js não está instalado no seu Mac.

---

## ✅ Solução: Instalar Node.js

### Opção 1: Instalador Oficial (Recomendado - Mais Fácil)

1. **Baixe o instalador:**
   - Acesse: https://nodejs.org/
   - Clique em **"Download Node.js (LTS)"** (versão 20.x ou 22.x)
   - Baixe o arquivo `.pkg` para macOS

2. **Execute o instalador:**
   - Abra o arquivo `.pkg` baixado
   - Siga o assistente de instalação (Next, Next, Install)
   - Digite sua senha quando solicitado

3. **Verifique a instalação:**
   ```bash
   node --version
   npm --version
   npx --version
   ```

4. **Reinicie o terminal** e tente novamente

---

### Opção 2: Via Homebrew (Se você já usa Homebrew)

```bash
# Instalar Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar Node.js
brew install node

# Verificar
node --version
npm --version
```

---

### Opção 3: Via NVM (Gerenciador de Versões - Recomendado para Desenvolvedores)

```bash
# 1. Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 2. Reiniciar terminal ou executar:
source ~/.zshrc

# 3. Instalar Node.js LTS
nvm install --lts

# 4. Usar a versão instalada
nvm use --lts

# 5. Verificar
node --version
npm --version
```

---

## 🚀 Após Instalar o Node.js

Execute os comandos de migração:

```bash
cd /Users/carvalhost/Documents/GitHub/SistemaChat/Tom/backend

# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Aplicar migrations
npx prisma migrate deploy

# Testar conexões
node test-connections.js
```

---

## 🔍 Verificar se Instalou Corretamente

```bash
# Deve mostrar a versão (ex: v20.11.0)
node --version

# Deve mostrar a versão (ex: 10.2.4)
npm --version

# Deve mostrar a versão (ex: 10.2.4)
npx --version
```

Se todos os comandos funcionarem, o Node.js está instalado corretamente! ✅

---

## ⚠️ Problemas Comuns

### "command not found" após instalar

**Solução:** Reinicie o terminal ou execute:
```bash
source ~/.zshrc
# ou
source ~/.bash_profile
```

### Permissões negadas

**Solução:** Não use `sudo` com npm. Se necessário, corrija permissões:
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

---

## 📚 Próximos Passos

Após instalar o Node.js:
1. ✅ Execute `npm install` na pasta backend
2. ✅ Configure suas credenciais no `.env`
3. ✅ Execute `npx prisma migrate deploy`
4. ✅ Inicie o sistema com `npm run dev`

---

## 🆘 Ainda com Problemas?

Se após instalar o Node.js ainda não funcionar:

1. **Feche TODOS os terminais abertos**
2. **Abra um novo terminal**
3. **Tente novamente**

O terminal precisa ser reiniciado para reconhecer o Node.js instalado.

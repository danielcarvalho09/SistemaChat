# 🧹 Como Limpar Cache do Navegador

## ⚠️ Problema: Cache da Versão Antiga

Se você está vendo a versão antiga do sistema mesmo após o deploy, o navegador está usando cache.

---

## ✅ Solução Rápida: Hard Refresh

### **Windows/Linux:**
- **Chrome/Edge:** `Ctrl + Shift + R` ou `Ctrl + F5`
- **Firefox:** `Ctrl + Shift + R` ou `Ctrl + F5`

### **Mac:**
- **Chrome/Edge:** `Cmd + Shift + R`
- **Firefox:** `Cmd + Shift + R`
- **Safari:** `Cmd + Option + R`

---

## 🔧 Solução Completa: Limpar Cache Manualmente

### **Google Chrome / Microsoft Edge:**

1. Pressione `F12` para abrir DevTools
2. Clique com botão direito no botão de **Recarregar** (ao lado da barra de endereço)
3. Selecione **"Limpar cache e recarregar forçadamente"** (ou "Empty Cache and Hard Reload")

**OU:**

1. Vá em `Configurações` → `Privacidade e segurança` → `Limpar dados de navegação`
2. Selecione **"Imagens e arquivos em cache"**
3. Clique em **"Limpar dados"**

### **Mozilla Firefox:**

1. Pressione `Ctrl + Shift + Delete` (ou `Cmd + Shift + Delete` no Mac)
2. Selecione **"Cache"**
3. Clique em **"Limpar agora"**

### **Safari (Mac):**

1. Vá em `Safari` → `Preferências` → `Avançado`
2. Marque **"Mostrar menu Desenvolver na barra de menus"**
3. Vá em `Desenvolver` → `Limpar Caches`

---

## 🚀 Solução Definitiva: Modo Anônimo/Privado

Teste em uma **janela anônima/privada** para garantir que não há cache:

- **Chrome/Edge:** `Ctrl + Shift + N` (Windows) ou `Cmd + Shift + N` (Mac)
- **Firefox:** `Ctrl + Shift + P` (Windows) ou `Cmd + Shift + P` (Mac)
- **Safari:** `Cmd + Shift + N`

---

## 🔍 Verificar se Está Usando Versão Nova

1. Abra o **Console do navegador** (`F12`)
2. Vá na aba **"Network"** (Rede)
3. Recarregue a página (`Ctrl + R`)
4. Procure por arquivos `.js` ou `.mjs`
5. Verifique se os nomes têm **hash** (ex: `index-abc123.js`)
6. Se os hashes mudaram, a versão nova está sendo carregada

---

## 📋 Checklist

- [ ] Fiz hard refresh (`Ctrl + Shift + R`)
- [ ] Limpei cache manualmente
- [ ] Testei em modo anônimo
- [ ] Verifiquei hashes dos arquivos JS no Network
- [ ] A versão nova está aparecendo

---

## ⚠️ Se Ainda Estiver com Problema

1. **Feche TODAS as abas** do site
2. **Feche o navegador completamente**
3. **Abra novamente** e acesse o site
4. Se persistir, **limpe TODOS os dados do site:**
   - Chrome: `Configurações` → `Privacidade` → `Configurações do site` → `Dados do site` → Procure pelo domínio → `Excluir`

---

## 🎯 Dica: Desabilitar Cache Durante Desenvolvimento

Se você é desenvolvedor, pode desabilitar cache no DevTools:

1. Abra DevTools (`F12`)
2. Vá em **"Network"** (Rede)
3. Marque **"Disable cache"** (Desabilitar cache)
4. **Mantenha o DevTools aberto** enquanto testa

---

## ✅ Após Limpar Cache

O sistema deve:
- ✅ Carregar a versão nova
- ✅ Mostrar as funcionalidades atualizadas
- ✅ Funcionar corretamente

Se ainda houver problemas, verifique se o **deploy no Railway foi concluído** com sucesso!


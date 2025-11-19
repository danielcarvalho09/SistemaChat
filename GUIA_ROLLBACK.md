# 🔄 Guia de Rollback - Voltar para Versão Anterior

## 📅 Commits Disponíveis

### **Hoje (19/11/2025)** - Versão Atual
- `6d1d982` - fix: melhorar processamento de mensagens e WebSocket
- `04ede2e` - docs: adicionar guia para configurar CORS no Railway
- `4d4494d` - fix: evitar mostrar desconectado durante autenticação com QR code
- ... (muitas mudanças recentes)

### **Ontem (18/11/2025)** - Versão de 1 dia atrás
- `3ce7628` - fix: corrigir reconexão Baileys e preservação de credenciais
- `5a71b68` - Update baileys.manager.ts
- `aea25a8` - Update baileys.manager.ts
- `629c685` - Update baileys.manager.ts

### **Anteontem (17/11/2025)** - Versão de 2 dias atrás
- `acd2f74` - .
- `6c5aebe` - .
- `cb3ae0a` - Update baileys.manager.ts
- `ab5d7a9` - .
- `5b61695` - .
- `850cac5` - .

---

## ⚠️ IMPORTANTE: Escolha o Método

### **Opção 1: Revert (Recomendado) - Mantém Histórico**
Cria novos commits que desfazem as mudanças, mantendo todo o histórico.

### **Opção 2: Reset Hard - Apaga Histórico**
Volta para o commit escolhido e **APAGA** todos os commits posteriores.

### **Opção 3: Checkout - Apenas Visualizar**
Apenas visualiza a versão antiga sem fazer mudanças permanentes.

---

## 🎯 Qual Versão Você Quer?

**Me diga qual commit você quer voltar:**

1. **`3ce7628`** (18/11) - "fix: corrigir reconexão Baileys e preservação de credenciais"
2. **`acd2f74`** (17/11) - Versão de 2 dias atrás
3. **Outro commit específico** - Me diga o hash do commit

---

## 📋 Comandos para Rollback

### **Método 1: Revert (Seguro - Mantém Histórico)**

```bash
# Reverter commits específicos (do mais recente para o mais antigo)
git revert 6d1d982
git revert 04ede2e
# ... continuar revertendo até o commit desejado

# OU reverter um range de commits
git revert HEAD~20..HEAD  # Reverte últimos 20 commits
```

### **Método 2: Reset Hard (Cuidado - Apaga Histórico)**

```bash
# ⚠️ CUIDADO: Isso apaga commits permanentemente!
# Substitua COMMIT_HASH pelo hash do commit desejado
git reset --hard COMMIT_HASH

# Exemplo: voltar para commit de 18/11
git reset --hard 3ce7628

# Depois, force push (APENAS se tiver certeza!)
git push origin main --force
```

### **Método 3: Checkout (Apenas Visualizar)**

```bash
# Apenas visualizar versão antiga (não faz mudanças permanentes)
git checkout COMMIT_HASH

# Para voltar ao estado atual:
git checkout main
```

---

## ✅ Recomendação

**Para produção, use REVERT** (mantém histórico e é mais seguro).

**Para desenvolvimento local, pode usar RESET HARD** (mais limpo, mas apaga histórico).

---

## 🚨 ANTES DE FAZER ROLLBACK

1. **Faça backup do código atual:**
   ```bash
   git branch backup-antes-rollback
   ```

2. **Verifique se há mudanças não commitadas:**
   ```bash
   git status
   ```

3. **Se houver mudanças, faça commit ou stash:**
   ```bash
   git stash  # Salva mudanças temporariamente
   # ou
   git commit -am "backup antes de rollback"
   ```

---

## 📞 Próximos Passos

**Me diga:**
1. Qual commit você quer voltar? (hash ou data)
2. Qual método prefere? (revert ou reset)
3. Quer que eu execute o rollback agora?


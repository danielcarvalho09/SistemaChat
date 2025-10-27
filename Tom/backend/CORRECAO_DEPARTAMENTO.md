# ✅ Correção: Erro ao Recriar Departamento

## 🐛 Problema

**Erro**: 409 Conflict ao tentar criar departamento com mesmo nome após deletar

**Causa**: O sistema usa **soft delete** (não deleta de verdade, apenas marca como `isActive: false`). Ao tentar criar novamente, o nome já existia no banco.

---

## ✅ Solução Implementada

### Antes (com erro):
```typescript
// Verificava se nome existe (incluindo inativos)
const existing = await prisma.department.findUnique({
  where: { name: data.name },
});

if (existing) {
  throw new ConflictError('Department with this name already exists');
}
```

### Depois (corrigido):
```typescript
// 1. Verifica apenas entre ativos
const existing = await prisma.department.findFirst({
  where: { 
    name: data.name,
    isActive: true,
  },
});

if (existing) {
  throw new ConflictError('Department with this name already exists');
}

// 2. Se existe inativo, reativa ao invés de criar novo
const inactive = await prisma.department.findFirst({
  where: {
    name: data.name,
    isActive: false,
  },
});

if (inactive) {
  // Reativa o departamento existente
  return await prisma.department.update({
    where: { id: inactive.id },
    data: { isActive: true, ...data },
  });
}

// 3. Se não existe, cria novo
return await prisma.department.create({ data });
```

---

## 🎯 Comportamento Agora

### Cenário 1: Criar departamento novo
```
POST /departments { name: "Vendas" }
→ Cria novo departamento ✅
```

### Cenário 2: Criar departamento com nome existente (ativo)
```
POST /departments { name: "Vendas" }
→ Erro 409: "Department with this name already exists" ❌
```

### Cenário 3: Criar departamento com nome de um inativo
```
1. DELETE /departments/123 (marca como inativo)
2. POST /departments { name: "Vendas" }
→ Reativa o departamento existente ✅
→ Mantém histórico de conversas
```

---

## 💡 Vantagens

1. **Sem perda de dados**: Conversas antigas permanecem vinculadas
2. **Histórico preservado**: Mantém ID e timestamps originais
3. **UX melhor**: Usuário pode "recriar" departamento sem erro
4. **Consistência**: Evita duplicação de nomes

---

## 🔄 Fluxo Completo

```
Criar "Vendas" → ✅ Criado (id: 1, isActive: true)
Deletar "Vendas" → ✅ Desativado (id: 1, isActive: false)
Criar "Vendas" → ✅ Reativado (id: 1, isActive: true)
```

---

## 🚀 Testando

### 1. Reinicie o backend
```bash
# O backend já está rodando com a correção
# Não precisa reiniciar se estiver em watch mode
```

### 2. Teste no frontend
```
1. Crie um departamento "Teste"
2. Delete o departamento
3. Crie novamente "Teste"
→ Deve funcionar sem erro! ✅
```

---

## 📝 Arquivos Modificados

- `src/services/department.service.ts`
  - Método `createDepartment()` - Reativa inativos
  - Método `updateDepartment()` - Verifica apenas ativos

---

## ✅ Problema Resolvido!

Agora você pode:
- ✅ Criar departamento
- ✅ Deletar departamento
- ✅ Recriar com mesmo nome (reativa o anterior)
- ✅ Sem perder histórico de conversas

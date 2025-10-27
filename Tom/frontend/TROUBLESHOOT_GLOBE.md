# 🌍 Troubleshooting - Globo não aparece

## ✅ Correções Aplicadas

1. **Removido `"use client"`** - Diretiva do Next.js que não funciona no Vite
2. **Adicionado verificações de segurança** no useEffect
3. **Corrigido dependências** do useEffect
4. **Adicionado cleanup** correto do event listener

---

## 🔍 Checklist de Verificação

### 1. Dependência Instalada
```bash
npm list cobe
# Deve mostrar: cobe@0.6.5 ✅
```

### 2. Verificar Console do Navegador
Abra o DevTools (F12) e procure por erros:
- ❌ Erros de importação do `cobe`
- ❌ Erros de WebGL
- ❌ Erros de canvas

### 3. Verificar se o Canvas está sendo renderizado
No console do navegador (F12), digite:
```javascript
document.querySelector('canvas')
```
- Se retornar `null` → Canvas não está sendo criado
- Se retornar um elemento → Canvas existe mas pode estar invisível

### 4. Verificar Estilos CSS
```javascript
const canvas = document.querySelector('canvas')
console.log(canvas.style.opacity)  // Deve ser "1"
console.log(getComputedStyle(canvas).display)  // Não deve ser "none"
```

---

## 🐛 Problemas Comuns

### Problema 1: Canvas com opacity 0
**Sintoma:** Canvas existe mas não aparece
**Solução:** O setTimeout pode não estar funcionando

Teste no console:
```javascript
const canvas = document.querySelector('canvas')
canvas.style.opacity = '1'
```

### Problema 2: WebGL não suportado
**Sintoma:** Erro no console sobre WebGL
**Solução:** Seu navegador/GPU pode não suportar WebGL

Teste:
```javascript
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
console.log(gl ? 'WebGL suportado' : 'WebGL NÃO suportado')
```

### Problema 3: Globo está fora da tela
**Sintoma:** Canvas existe mas está posicionado errado
**Solução:** Verificar CSS de posicionamento

Teste no console:
```javascript
const globeContainer = document.querySelector('.absolute.bottom-0')
console.log(globeContainer.getBoundingClientRect())
```

### Problema 4: Z-index incorreto
**Sintoma:** Globo está atrás de outros elementos
**Solução:** Ajustar z-index

---

## 🔧 Testes Manuais

### Teste 1: Globo Simples (sem posicionamento)
Temporariamente, altere o LoginPage.tsx:

```tsx
{/* Teste: Globo centralizado e visível */}
<div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
  <div className="w-[600px] h-[600px]">
    <Globe />
  </div>
</div>
```

Se aparecer assim, o problema é o posicionamento.

### Teste 2: Verificar se cobe está carregando
Adicione console.log no globe.tsx:

```tsx
useEffect(() => {
  console.log('🌍 Globe useEffect iniciado')
  console.log('Canvas ref:', canvasRef.current)
  
  // ... resto do código
  
  console.log('🌍 Globe criado com sucesso')
}, [onRender])
```

---

## 🎨 Ajustes de Posicionamento

Se o globo não aparecer na parte inferior, tente:

### Opção 1: Globo maior e mais visível
```tsx
<div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[40%] opacity-60 z-0">
  <Globe className="scale-[3]" />
</div>
```

### Opção 2: Globo centralizado (teste)
```tsx
<div className="absolute inset-0 flex items-center justify-center opacity-30 z-0">
  <Globe className="scale-[2]" />
</div>
```

### Opção 3: Globo no canto inferior direito
```tsx
<div className="absolute bottom-0 right-0 translate-x-[25%] translate-y-[25%] opacity-40 z-0">
  <Globe className="scale-[2]" />
</div>
```

---

## 🚀 Solução Rápida

Se nada funcionar, tente recriar o componente do zero:

1. **Pare o servidor** (Ctrl+C)
2. **Limpe o cache do Vite:**
   ```bash
   rm -rf node_modules/.vite
   ```
3. **Reinstale a dependência:**
   ```bash
   npm uninstall cobe
   npm install cobe@0.6.5
   ```
4. **Reinicie o servidor:**
   ```bash
   npm run dev
   ```
5. **Limpe o cache do navegador** (Ctrl+Shift+Delete)
6. **Recarregue a página** (Ctrl+F5)

---

## 📸 Como deve aparecer

O globo deve aparecer:
- ✅ Na parte **inferior** da página
- ✅ **Metade cortada** (apenas o topo visível)
- ✅ **Azul escuro** nos pontos
- ✅ **Girando lentamente**
- ✅ **Interativo** (pode arrastar com o mouse)
- ✅ Com **opacidade 40%**

---

## 🆘 Última Solução

Se NADA funcionar, use uma alternativa mais simples:

```tsx
// Substitua o Globe por um gradiente animado temporariamente
<div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-t from-blue-900/30 via-blue-800/20 to-transparent blur-3xl animate-pulse" />
```

Isso cria um efeito visual similar enquanto debugamos o problema do Globe.

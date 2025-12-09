# 📜 Scripts do Source (src/scripts)

Esta pasta contém scripts utilitários que são importados e usados pelo código da aplicação.

## 📂 Estrutura

```
src/scripts/
├── admin/              # Scripts administrativos
└── maintenance/       # Scripts de manutenção
```

## 🔧 Scripts Disponíveis

### Admin (`admin/`)

#### `promote-admin.ts`
Promove um usuário existente a administrador.

**Uso via NPM:**
```bash
npm run promote-admin [email]
```

**Uso direto:**
```bash
tsx src/scripts/admin/promote-admin.ts [email]
```

#### `ensure-admin-user.ts`
Garante que existe pelo menos um usuário administrador no sistema. Usado internamente pela aplicação.

### Maintenance (`maintenance/`)

#### `fix-duplicate-roles.ts`
Corrige roles duplicadas para usuários. Remove duplicatas mantendo apenas uma instância de cada role.

**Uso via API:**
```bash
POST /api/v1/users/fix-duplicate-roles
```

**Uso direto:**
```typescript
import { fixDuplicateRoles } from '../scripts/maintenance/fix-duplicate-roles.js';
await fixDuplicateRoles();
```

#### `fix-multiple-roles.ts`
Garante que cada usuário tenha apenas uma role, priorizando: admin > gerente > user.

**Uso via API:**
```bash
POST /api/v1/users/fix-multiple-roles
```

**Uso direto:**
```typescript
import { fixMultipleRoles } from '../scripts/maintenance/fix-multiple-roles.js';
await fixMultipleRoles();
```

## 📝 Notas

- Estes scripts são importados e usados pelo código da aplicação
- Alguns scripts também podem ser executados via API (requer permissões de admin)
- Sempre faça backup antes de executar scripts de manutenção


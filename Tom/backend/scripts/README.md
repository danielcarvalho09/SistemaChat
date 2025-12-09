# 📜 Scripts do Backend

Esta pasta contém scripts executáveis organizados por categoria.

## 📂 Estrutura

```
scripts/
├── admin/              # Scripts administrativos
├── maintenance/       # Scripts de manutenção
└── migration/         # Scripts de migração
```

## 🔧 Scripts Disponíveis

### Admin (`admin/`)

#### `create-admin.ts`
Cria um novo usuário administrador no sistema.

**Uso:**
```bash
tsx scripts/admin/create-admin.ts
```

#### `generate-encryption-key.ts`
Gera uma nova chave de criptografia AES-256.

**Uso:**
```bash
npm run generate:encryption-key
# ou
tsx scripts/admin/generate-encryption-key.ts
```

#### `setup-departments.js`
Configura os departamentos iniciais do sistema.

**Uso:**
```bash
tsx scripts/admin/setup-departments.js
```

### Maintenance (`maintenance/`)

#### `delete-inactive-connections.ts`
Remove conexões WhatsApp inativas do banco de dados.

**Uso:**
```bash
npm run clean:connections
# ou
tsx scripts/maintenance/delete-inactive-connections.ts
```

### Migration (`migration/`)

#### `migrate-encrypt-authdata.ts`
Migra dados de autenticação para formato criptografado.

**Uso:**
```bash
npm run migrate:encrypt-authdata
# ou
tsx scripts/migration/migrate-encrypt-authdata.ts
```

## 📝 Notas

- Todos os scripts TypeScript devem ser executados com `tsx`
- Scripts JavaScript podem ser executados com `node`
- Sempre faça backup antes de executar scripts de migração ou manutenção


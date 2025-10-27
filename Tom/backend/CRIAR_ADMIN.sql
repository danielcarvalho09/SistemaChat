-- Criar usuário admin padrão
-- Senha: admin123 (hash bcrypt)

-- Inserir role admin se não existir
INSERT INTO "roles" (id, name, description, "createdAt", "updatedAt")
VALUES (
  'admin-role-id',
  'admin',
  'Administrator role with full permissions',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Inserir role user se não existir
INSERT INTO "roles" (id, name, description, "createdAt", "updatedAt")
VALUES (
  'user-role-id',
  'user',
  'Regular user role',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Inserir usuário admin
-- Email: admin@admin.com
-- Senha: admin123
INSERT INTO "users" (id, email, password, name, avatar, status, "isActive", "createdAt", "updatedAt")
VALUES (
  'admin-user-id',
  'admin@admin.com',
  '$2b$10$rZ5qYQZ5qYQZ5qYQZ5qYQOGKx8qYQZ5qYQZ5qYQZ5qYQZ5qYQZ5qYQ',
  'Admin',
  NULL,
  'online',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  "isActive" = true;

-- Associar usuário admin ao role admin
INSERT INTO "user_roles" (id, "userId", "roleId", "createdAt")
VALUES (
  gen_random_uuid(),
  'admin-user-id',
  'admin-role-id',
  NOW()
)
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Criar departamento padrão
INSERT INTO "departments" (id, name, description, "isActive", "createdAt", "updatedAt")
VALUES (
  'default-dept-id',
  'Atendimento',
  'Departamento padrão de atendimento',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Associar admin ao departamento
INSERT INTO "user_department_access" (id, "userId", "departmentId", "createdAt")
VALUES (
  gen_random_uuid(),
  'admin-user-id',
  'default-dept-id',
  NOW()
)
ON CONFLICT ("userId", "departmentId") DO NOTHING;

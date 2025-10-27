-- Promover daniel@carvalhostudio.com.br para admin

-- 1. Criar role admin se não existir
INSERT INTO roles (id, name, description, "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'admin', 'Administrator role', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

-- 2. Adicionar role admin ao usuário
INSERT INTO user_roles (id, "userId", "roleId")
SELECT 
    gen_random_uuid(),
    u.id,
    r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'daniel@carvalhostudio.com.br'
  AND r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur."userId" = u.id AND ur."roleId" = r.id
  );

-- 3. Verificar resultado
SELECT u.email, u.name, r.name as role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur."userId"
LEFT JOIN roles r ON ur."roleId" = r.id
WHERE u.email = 'daniel@carvalhostudio.com.br';

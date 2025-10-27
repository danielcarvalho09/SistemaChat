# Script para promover daniel@carvalhostudio.com.br para admin

Write-Host "Promovendo daniel@carvalhostudio.com.br para admin..." -ForegroundColor Cyan

# SQL para promover usuário
$sql = @"
-- Verificar se usuário existe
DO `$`$
DECLARE
    v_user_id UUID;
    v_admin_role_id UUID;
BEGIN
    -- Buscar ID do usuário
    SELECT id INTO v_user_id FROM users WHERE email = 'daniel@carvalhostudio.com.br';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Usuario nao encontrado!';
    ELSE
        -- Buscar ID da role admin
        SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';
        
        IF v_admin_role_id IS NULL THEN
            -- Criar role admin se não existir
            INSERT INTO roles (id, name, description, "createdAt", "updatedAt") 
            VALUES (gen_random_uuid(), 'admin', 'Administrator role', NOW(), NOW())
            RETURNING id INTO v_admin_role_id;
            RAISE NOTICE 'Role admin criada';
        END IF;
        
        -- Verificar se já tem a role
        IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role_id = v_admin_role_id) THEN
            RAISE NOTICE 'Usuario ja e admin!';
        ELSE
            -- Adicionar role admin
            INSERT INTO user_roles (id, user_id, role_id)
            VALUES (gen_random_uuid(), v_user_id, v_admin_role_id);
            RAISE NOTICE 'Usuario promovido para admin com sucesso!';
        END IF;
    END IF;
END `$`$;

-- Verificar resultado
SELECT u.email, u.name, r.name as role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'daniel@carvalhostudio.com.br';
"@

# Executar no PostgreSQL
docker exec -i whatsapp_postgres psql -U postgres -d whatsapp_system -c $sql

Write-Host ""
Write-Host "Concluido!" -ForegroundColor Green

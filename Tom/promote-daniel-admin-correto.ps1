# ========================================
# Script para Promover daniel@carvalhostudio.com.br para Admin
# Windows PowerShell
# ========================================

Write-Host "Promovendo daniel@carvalhostudio.com.br para Admin..." -ForegroundColor Cyan
Write-Host ""

$email = "daniel@carvalhostudio.com.br"

# SQL para promover usuário
$sql = @"
DO `$`$
DECLARE
    v_user_id TEXT;
    v_admin_role_id TEXT;
    v_existing_role TEXT;
BEGIN
    -- Buscar usuário
    SELECT id INTO v_user_id FROM users WHERE email = '$email';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario nao encontrado: $email';
    END IF;
    
    -- Buscar role admin
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';
    
    IF v_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Role admin nao encontrada';
    END IF;
    
    -- Verificar se já é admin
    SELECT id INTO v_existing_role FROM user_roles 
    WHERE "userId" = v_user_id AND "roleId" = v_admin_role_id;
    
    IF v_existing_role IS NOT NULL THEN
        RAISE NOTICE 'Usuario ja e admin';
    ELSE
        -- Atribuir role admin
        INSERT INTO user_roles (id, "userId", "roleId", "createdAt")
        VALUES (gen_random_uuid(), v_user_id, v_admin_role_id, NOW());
        
        RAISE NOTICE 'Usuario promovido a admin com sucesso!';
    END IF;
END `$`$;
"@

# Executar SQL
try {
    $sql | docker exec -i whatsapp_postgres psql -U postgres -d whatsapp_system
    
    Write-Host ""
    Write-Host "[OK] Usuario daniel@carvalhostudio.com.br promovido para Admin!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Cyan
    Write-Host "  1. Faca logout da aplicacao" -ForegroundColor White
    Write-Host "  2. Faca login novamente com daniel@carvalhostudio.com.br" -ForegroundColor White
    Write-Host "  3. Agora voce tem acesso completo de administrador!" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "[ERRO] Erro ao promover usuario" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Certifique-se de que:" -ForegroundColor Yellow
    Write-Host "  - O PostgreSQL esta rodando (docker ps)" -ForegroundColor White
    Write-Host "  - O usuario ja foi cadastrado na aplicacao" -ForegroundColor White
}

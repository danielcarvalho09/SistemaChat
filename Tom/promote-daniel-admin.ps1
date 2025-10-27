# ========================================
# Script para Promover daniel@carvalhostudio para Admin
# Windows PowerShell
# ========================================

Write-Host "Promovendo daniel@carvalhostudio para Admin..." -ForegroundColor Cyan
Write-Host ""

$email = "daniel@carvalhostudio"

# SQL para promover usuário
$sql = @"
DO `$`$
DECLARE
    v_user_id UUID;
    v_admin_role_id UUID;
    v_existing_role UUID;
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
    WHERE user_id = v_user_id AND role_id = v_admin_role_id;
    
    IF v_existing_role IS NOT NULL THEN
        RAISE NOTICE 'Usuario ja e admin';
    ELSE
        -- Atribuir role admin
        INSERT INTO user_roles (id, user_id, role_id, created_at)
        VALUES (gen_random_uuid(), v_user_id, v_admin_role_id, NOW());
        
        RAISE NOTICE 'Usuario promovido a admin com sucesso!';
    END IF;
END `$`$;
"@

# Executar SQL
try {
    $sql | docker exec -i whatsapp_postgres psql -U postgres -d whatsapp_system
    
    Write-Host ""
    Write-Host "[OK] Usuario daniel@carvalhostudio promovido para Admin!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Cyan
    Write-Host "  1. Faca logout da aplicacao" -ForegroundColor White
    Write-Host "  2. Faca login novamente com daniel@carvalhostudio" -ForegroundColor White
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

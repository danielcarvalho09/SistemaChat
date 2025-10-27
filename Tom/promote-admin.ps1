# ========================================
# Script para Promover Usuário a Admin
# Windows PowerShell
# ========================================

Write-Host "👑 Promover Usuário para Admin" -ForegroundColor Cyan
Write-Host ""

# Solicitar email do usuário
$email = Read-Host "Digite o email do usuário"

if ([string]::IsNullOrWhiteSpace($email)) {
    Write-Host "❌ Email não pode ser vazio" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Buscando usuário..." -ForegroundColor Yellow

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
        RAISE EXCEPTION 'Usuário não encontrado: $email';
    END IF;
    
    -- Buscar role admin
    SELECT id INTO v_admin_role_id FROM roles WHERE name = 'admin';
    
    IF v_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'Role admin não encontrada';
    END IF;
    
    -- Verificar se já é admin
    SELECT id INTO v_existing_role FROM user_roles 
    WHERE user_id = v_user_id AND role_id = v_admin_role_id;
    
    IF v_existing_role IS NOT NULL THEN
        RAISE NOTICE 'Usuário já é admin';
    ELSE
        -- Atribuir role admin
        INSERT INTO user_roles (id, user_id, role_id, created_at)
        VALUES (gen_random_uuid(), v_user_id, v_admin_role_id, NOW());
        
        RAISE NOTICE 'Usuário promovido a admin com sucesso!';
    END IF;
END `$`$;
"@

# Executar SQL
try {
    $sql | docker exec -i whatsapp_postgres psql -U postgres -d whatsapp_system
    
    Write-Host ""
    Write-Host "✅ Usuário $email promovido para Admin!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
    Write-Host "  1. Faça logout da aplicação" -ForegroundColor White
    Write-Host "  2. Faça login novamente" -ForegroundColor White
    Write-Host "  3. Agora você tem acesso completo de administrador!" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Erro ao promover usuário" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Certifique-se de que:" -ForegroundColor Yellow
    Write-Host "  • O PostgreSQL está rodando (docker ps)" -ForegroundColor White
    Write-Host "  • O email está correto" -ForegroundColor White
    Write-Host "  • O usuário já foi cadastrado na aplicação" -ForegroundColor White
}

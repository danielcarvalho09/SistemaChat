-- Verificar usuários e seus departamentos

-- 1. Listar todos os departamentos
SELECT 
    d.id,
    d.name as department_name,
    COUNT(DISTINCT uda."userId") as user_count
FROM departments d
LEFT JOIN user_department_access uda ON d.id = uda."departmentId"
GROUP BY d.id, d.name
ORDER BY d.name;

-- 2. Verificar acesso do daniel@carvalhostudio.com.br
SELECT 
    u.email,
    u.name as user_name,
    d.name as department_name,
    uda."createdAt"
FROM users u
LEFT JOIN user_department_access uda ON u.id = uda."userId"
LEFT JOIN departments d ON uda."departmentId" = d.id
WHERE u.email = 'daniel@carvalhostudio.com.br';

-- 3. Listar TODOS os registros de user_department_access
SELECT 
    uda.id,
    u.email,
    u.name as user_name,
    d.name as department_name
FROM user_department_access uda
JOIN users u ON uda."userId" = u.id
JOIN departments d ON uda."departmentId" = d.id
ORDER BY d.name, u.name;


const BASE_URL = 'http://localhost:3000/api/v1';

async function checkApi() {
    try {
        console.log('1. Logging in...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@admin.com',
                password: 'admin123'
            })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        console.log('Login Response:', JSON.stringify(loginData, null, 2));

        const token = loginData.data?.tokens?.accessToken;
        if (!token) {
            console.error('❌ No Access Token returned!');
            // Se retornar bypass, vai cair aqui se a estrutura for diferente
        } else {
            console.log('✅ Access Token obtained:', token.substring(0, 10) + '...');
        }

        console.log('\n2. Fetching Connections...');
        const connRes = await fetch(`${BASE_URL}/connections`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const connData = await connRes.json();
        console.log('Connections:', JSON.stringify(connData, null, 2));

        console.log('\n3. Fetching Conversations...');
        const convRes = await fetch(`${BASE_URL}/conversations?page=1&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const convData = await convRes.json();
        console.log('Conversations:', JSON.stringify(convData, null, 2));

    } catch (error: any) {
        console.error('❌ Error:', error);
    }
}

checkApi();

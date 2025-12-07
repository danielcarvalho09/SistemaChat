import { readFileSync } from 'fs';
import { verifyAccessToken } from '../utils/jwt.js';

async function testToken() {
    try {
        const token = readFileSync('/tmp/admin_token_new.txt', 'utf-8').trim();
        console.log('Token:', token.substring(0, 50) + '...');

        const decoded = verifyAccessToken(token);
        console.log('\n✅ Token is VALID');
        console.log('User ID:', decoded.userId);
        console.log('Email:', decoded.email);
        console.log('Roles:', decoded.roles);
    } catch (error) {
        console.error('\n❌ Token is INVALID');
        console.error('Error:', error);
    }
}

testToken();

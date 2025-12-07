import { readFileSync } from 'fs';
import { decodeToken, verifyAccessToken } from '../utils/jwt.js';

async function testFreshToken() {
    try {
        const token = readFileSync('/tmp/admin_token_fresh.txt', 'utf-8').trim();
        console.log('Token length:', token.length);
        console.log('Token (first 50 chars):', token.substring(0, 50) + '...');

        // Decode without verification
        const decoded = decodeToken(token);
        console.log('\n📋 Decoded token (without verification):');
        console.log(JSON.stringify(decoded, null, 2));

        // Try to verify
        console.log('\n🔐 Attempting verification...');
        const verified = verifyAccessToken(token);
        console.log('✅ Token is VALID!');
        console.log('User ID:', verified.userId);
        console.log('Email:', verified.email);
        console.log('Roles:', verified.roles);
    } catch (error: any) {
        console.error('\n❌ Verification failed');
        console.error('Error:', error.message);
    }
}

testFreshToken();

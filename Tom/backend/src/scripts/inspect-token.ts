import { readFileSync } from 'fs';
import { decodeToken } from '../utils/jwt.js';

async function inspectToken() {
    try {
        const token = readFileSync('/tmp/admin_token_new.txt', 'utf-8').trim();
        console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
        console.log('Token length:', token.length);

        const decoded = decodeToken(token);
        console.log('\n📋 Decoded token (without verification):');
        console.log(JSON.stringify(decoded, null, 2));
    } catch (error) {
        console.error('\n❌ Error decoding token');
        console.error('Error:', error);
    }
}

inspectToken();

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Script para substituir variáveis de ambiente no build do Vite
 * Executa APÓS o build para injetar as URLs corretas
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

console.log('🔧 Substituindo variáveis de ambiente no build...');
console.log(`📍 BACKEND_URL: ${BACKEND_URL}`);

const distPath = './dist/assets';
const files = readdirSync(distPath);

// Encontrar arquivos JS
const jsFiles = files.filter(f => f.endsWith('.js'));

console.log(`📦 Encontrados ${jsFiles.length} arquivos JS`);

let replacements = 0;

jsFiles.forEach(file => {
  const filePath = join(distPath, file);
  let content = readFileSync(filePath, 'utf8');
  
  // Substituir localhost:3000 pela URL do Railway
  const originalContent = content;
  
  // Substituir URLs hardcoded
  content = content.replace(/http:\/\/localhost:3000/g, BACKEND_URL);
  content = content.replace(/ws:\/\/localhost:3000/g, BACKEND_URL);
  content = content.replace(/wss:\/\/localhost:3000/g, BACKEND_URL);
  
  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf8');
    replacements++;
    console.log(`✅ Substituído em: ${file}`);
  }
});

console.log(`\n✨ Concluído! ${replacements} arquivo(s) modificado(s)`);
console.log(`🌐 Todas as URLs agora apontam para: ${BACKEND_URL}`);

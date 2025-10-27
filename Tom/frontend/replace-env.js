import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Script para substituir variáveis de ambiente no build do Vite
 * Executa APÓS o build para injetar as URLs corretas
 */

const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = process.env.VITE_WS_URL || BACKEND_URL;

console.log('🔧 Substituindo variáveis de ambiente no build...');
console.log(`📍 BACKEND_URL: ${BACKEND_URL}`);
console.log(`📍 WS_URL: ${WS_URL}`);

const distPath = './dist/assets';
const files = readdirSync(distPath);

// Encontrar arquivos JS
const jsFiles = files.filter(f => f.endsWith('.js'));

console.log(`📦 Encontrados ${jsFiles.length} arquivos JS`);

let totalReplacements = 0;

jsFiles.forEach(file => {
  const filePath = join(distPath, file);
  let content = readFileSync(filePath, 'utf8');
  
  const originalContent = content;
  let fileReplacements = 0;
  
  // Substituir todas as variações de localhost
  const replacements = [
    { from: /http:\/\/localhost:3000/g, to: BACKEND_URL, name: 'http://localhost:3000' },
    { from: /https:\/\/localhost:3000/g, to: BACKEND_URL, name: 'https://localhost:3000' },
    { from: /ws:\/\/localhost:3000/g, to: WS_URL, name: 'ws://localhost:3000' },
    { from: /wss:\/\/localhost:3000/g, to: WS_URL, name: 'wss://localhost:3000' },
    { from: /"localhost:3000"/g, to: `"${BACKEND_URL.replace(/^https?:\/\//, '')}"`, name: '"localhost:3000"' },
    { from: /'localhost:3000'/g, to: `'${BACKEND_URL.replace(/^https?:\/\//, '')}'`, name: "'localhost:3000'" },
  ];
  
  replacements.forEach(({ from, to, name }) => {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      fileReplacements += matches.length;
      console.log(`  ✓ ${matches.length}x ${name} → ${to}`);
    }
  });
  
  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf8');
    totalReplacements += fileReplacements;
    console.log(`✅ ${file}: ${fileReplacements} substituições`);
  }
});

console.log(`\n✨ Concluído! ${totalReplacements} substituição(ões) em ${jsFiles.length} arquivo(s)`);
console.log(`🌐 Todas as URLs agora apontam para: ${BACKEND_URL}`);

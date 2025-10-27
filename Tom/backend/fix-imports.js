import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function fixImportsInFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  
  // Adiciona .js em imports relativos que não têm extensão
  const fixed = content.replace(
    /from ['"](\.[^'"]+)(?<!\.js)['"]/g,
    "from '$1.js'"
  );
  
  if (content !== fixed) {
    await writeFile(filePath, fixed, 'utf-8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }
  return false;
}

async function processDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  let count = 0;
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      count += await processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (await fixImportsInFile(fullPath)) {
        count++;
      }
    }
  }
  
  return count;
}

const srcDir = './src';
const count = await processDirectory(srcDir);
console.log(`\n🎉 Fixed ${count} files!`);

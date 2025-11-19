import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ IMPORTANTE: Headers para evitar cache de HTML e JS
// Arquivos estáticos (CSS, imagens, etc.) podem ser cacheados
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filePath) => {
    // Não cachear HTML e JS (Vite já adiciona hash nos nomes, mas garantimos)
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// Handle React Router - send all requests to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend server running on port ${PORT}`);
  console.log(`🌐 Server is accessible at http://0.0.0.0:${PORT}`);
});

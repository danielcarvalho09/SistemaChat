import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger.js';

export class CleanupService {
  private uploadsDir: string;
  private maxAgeInDays: number;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.maxAgeInDays = 7; // 7 dias
  }

  /**
   * Limpar arquivos antigos (mais de 7 dias)
   */
  async cleanOldFiles(): Promise<void> {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return;
      }

      const now = Date.now();
      const maxAge = this.maxAgeInDays * 24 * 60 * 60 * 1000; // 7 dias em ms

      const files = fs.readdirSync(this.uploadsDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const stats = fs.statSync(filePath);

        // Verificar idade do arquivo
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Deleted old file: ${file} (${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days old)`);
        }
      }

      if (deletedCount > 0) {
        logger.info(`✅ Cleanup completed: ${deletedCount} file(s) deleted`);
      }
    } catch (error) {
      logger.error('❌ Error cleaning old files:', error);
    }
  }

  /**
   * Iniciar limpeza automática (executa a cada 24 horas)
   */
  startAutomaticCleanup(): void {
    // Executar imediatamente
    this.cleanOldFiles();

    // Executar a cada 24 horas
    setInterval(() => {
      this.cleanOldFiles();
    }, 24 * 60 * 60 * 1000);

    logger.info('🧹 Automatic cleanup service started (runs every 24 hours)');
  }

  /**
   * Verificar se arquivo existe
   */
  fileExists(filename: string): boolean {
    const filePath = path.join(this.uploadsDir, filename);
    return fs.existsSync(filePath);
  }
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../config/logger.js';

export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucketName: string = 'media-uploads';

  /**
   * Extrai a URL do Supabase da DATABASE_URL
   * Exemplos:
   * - postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
   *   -> https://xxxxx.supabase.co
   * - postgresql://postgres.xxxxx:[password]@aws-0-region.pooler.supabase.com:6543/postgres
   *   -> https://xxxxx.supabase.co
   */
  private extractSupabaseUrl(databaseUrl: string): string | null {
    try {
      // Tentar parsear a URL
      const url = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'));
      const host = url.hostname;

      // Formato 1: db.[PROJECT-REF].supabase.co
      const match1 = host.match(/^db\.([^.]+)\.supabase\.co$/);
      if (match1) {
        return `https://${match1[1]}.supabase.co`;
      }

      // Formato 2: postgres.[PROJECT-REF].pooler.supabase.com
      const match2 = host.match(/^postgres\.([^.]+)\.pooler\.supabase\.com$/);
      if (match2) {
        return `https://${match2[1]}.supabase.co`;
      }

      // Formato 3: aws-0-[region].pooler.supabase.com (precisa do project ref do user)
      const match3 = host.match(/^aws-0-[^.]+\.pooler\.supabase\.com$/);
      if (match3) {
        // Neste caso, precisamos do project ref do usuário
        // Tentar extrair do user se estiver no formato postgres.PROJECT_REF
        const user = url.username;
        const userMatch = user.match(/^postgres\.([^.]+)$/);
        if (userMatch) {
          return `https://${userMatch[1]}.supabase.co`;
        }
      }

      logger.warn(`⚠️ Could not extract Supabase URL from DATABASE_URL: ${host}`);
      return null;
    } catch (error) {
      logger.error('❌ Error extracting Supabase URL:', error);
      return null;
    }
  }

  constructor() {
    // ✅ Prioridade 1: Usar variáveis fornecidas automaticamente pelo Railway (quando conectado ao Supabase)
    // O Railway pode fornecer: SUPABASE_URL, SUPABASE_ANON_KEY automaticamente
    let supabaseUrl = process.env.SUPABASE_URL;
    let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    // ✅ Prioridade 2: Extrair da DATABASE_URL (para sistemas que já usam Supabase via connection string)
    if (!supabaseUrl && process.env.DATABASE_URL) {
      supabaseUrl = this.extractSupabaseUrl(process.env.DATABASE_URL);
      if (supabaseUrl) {
        logger.info(`✅ Extracted Supabase URL from DATABASE_URL: ${supabaseUrl}`);
      }
    }

    // ✅ Log do que foi encontrado
    if (supabaseUrl) {
      logger.info(`✅ Supabase URL found: ${supabaseUrl}`);
    } else {
      logger.warn('⚠️ Supabase URL not found in environment variables');
    }

    if (supabaseServiceKey) {
      logger.info(`✅ Supabase key found (type: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON'})`);
    } else {
      logger.warn('⚠️ Supabase key not found (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)');
    }

    // Se não tiver URL ou chave, não configurar o cliente
    if (!supabaseUrl || !supabaseServiceKey) {
      logger.warn('⚠️ Supabase Storage credentials incomplete. File uploads will use local storage.');
      logger.info('💡 To enable Supabase Storage:');
      logger.info('   - Railway: Ensure Supabase project is connected (Railway provides SUPABASE_URL and SUPABASE_ANON_KEY automatically)');
      logger.info('   - Manual: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in environment variables');
      return;
    }

    try {
      this.client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      logger.info(`✅ Supabase Storage client initialized (URL: ${supabaseUrl})`);
    } catch (error) {
      logger.error('❌ Failed to initialize Supabase Storage:', error);
    }
  }

  /**
   * Verifica se o Supabase está configurado
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Faz upload de um arquivo para o Supabase Storage
   * @param buffer Buffer do arquivo
   * @param filename Nome do arquivo
   * @param mimetype Tipo MIME do arquivo
   * @returns URL pública do arquivo ou null em caso de erro
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<string | null> {
    if (!this.client) {
      logger.warn('⚠️ Supabase Storage not configured, cannot upload file');
      return null;
    }

    try {
      // Garantir que o bucket existe
      await this.ensureBucketExists();

      // Fazer upload do arquivo
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(filename, buffer, {
          contentType: mimetype,
          upsert: false, // Não sobrescrever arquivos existentes
        });

      if (error) {
        logger.error('❌ Error uploading to Supabase Storage:', error);
        return null;
      }

      // Obter URL pública do arquivo
      const { data: urlData } = this.client.storage
        .from(this.bucketName)
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      logger.info(`✅ File uploaded to Supabase Storage: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      logger.error('❌ Exception uploading to Supabase Storage:', error);
      return null;
    }
  }

  /**
   * Garante que o bucket existe, criando-o se necessário
   */
  private async ensureBucketExists(): Promise<void> {
    if (!this.client) return;

    try {
      // Verificar se o bucket existe
      const { data: buckets, error: listError } = await this.client.storage.listBuckets();

      if (listError) {
        logger.error('❌ Error listing buckets:', listError);
        return;
      }

      const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName);

      if (!bucketExists) {
        // Criar o bucket se não existir
        const { error: createError } = await this.client.storage.createBucket(this.bucketName, {
          public: true, // Tornar público para URLs públicas
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'audio/mpeg',
            'audio/ogg',
            'audio/wav',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
        });

        if (createError) {
          logger.error('❌ Error creating bucket:', createError);
        } else {
          logger.info(`✅ Created bucket: ${this.bucketName}`);
        }
      }
    } catch (error) {
      logger.error('❌ Exception ensuring bucket exists:', error);
    }
  }

  /**
   * Deleta um arquivo do Supabase Storage
   */
  async deleteFile(filename: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const { error } = await this.client.storage.from(this.bucketName).remove([filename]);

      if (error) {
        logger.error('❌ Error deleting file from Supabase Storage:', error);
        return false;
      }

      logger.info(`✅ File deleted from Supabase Storage: ${filename}`);
      return true;
    } catch (error) {
      logger.error('❌ Exception deleting file from Supabase Storage:', error);
      return false;
    }
  }
}

// Singleton instance
export const supabaseStorageService = new SupabaseStorageService();


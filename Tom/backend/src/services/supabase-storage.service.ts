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
   * - postgresql://postgres:[password]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
   *   -> Precisa extrair do username ou da URL do storage S3
   */
  private extractSupabaseUrl(databaseUrl: string): string | null {
    try {
      logger.info(`[SupabaseStorage] 🔍 Attempting to extract Supabase URL from DATABASE_URL...`);
      logger.info(`[SupabaseStorage] 🔍 DATABASE_URL (sanitized): ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
      
      // Tentar parsear a URL
      const url = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'));
      const host = url.hostname;
      const user = url.username;

      logger.info(`[SupabaseStorage] 🔍 Parsed hostname: ${host}`);
      logger.info(`[SupabaseStorage] 🔍 Parsed username: ${user}`);

      // Formato 1: db.[PROJECT-REF].supabase.co
      const match1 = host.match(/^db\.([^.]+)\.supabase\.co$/);
      if (match1) {
        const projectRef = match1[1];
        const supabaseUrl = `https://${projectRef}.supabase.co`;
        logger.info(`[SupabaseStorage] ✅ Extracted URL (format 1): ${supabaseUrl}`);
        return supabaseUrl;
      }

      // Formato 2: postgres.[PROJECT-REF].pooler.supabase.com
      const match2 = host.match(/^postgres\.([^.]+)\.pooler\.supabase\.com$/);
      if (match2) {
        const projectRef = match2[1];
        const supabaseUrl = `https://${projectRef}.supabase.co`;
        logger.info(`[SupabaseStorage] ✅ Extracted URL (format 2): ${supabaseUrl}`);
        return supabaseUrl;
      }

      // Formato 3: aws-0-[region].pooler.supabase.com (precisa do project ref do user)
      const match3 = host.match(/^aws-0-[^.]+\.pooler\.supabase\.com$/);
      if (match3) {
        // Tentar extrair do user se estiver no formato postgres.PROJECT_REF
        const userMatch = user.match(/^postgres\.([^.]+)$/);
        if (userMatch) {
          const projectRef = userMatch[1];
          const supabaseUrl = `https://${projectRef}.supabase.co`;
          logger.info(`[SupabaseStorage] ✅ Extracted URL (format 3 from user): ${supabaseUrl}`);
          return supabaseUrl;
        }
      }

      // Formato 4: Tentar extrair project ref de qualquer parte da URL
      // Buscar por padrão de project ref (geralmente 20 caracteres alfanuméricos)
      const projectRefMatch = databaseUrl.match(/([a-z0-9]{20,})/);
      if (projectRefMatch) {
        const possibleRef = projectRefMatch[1];
        logger.info(`[SupabaseStorage] 🔍 Found possible project ref: ${possibleRef}`);
        // Tentar construir URL com esse ref
        const testUrl = `https://${possibleRef}.supabase.co`;
        logger.info(`[SupabaseStorage] 🔍 Testing URL: ${testUrl}`);
        return testUrl;
      }

      logger.warn(`[SupabaseStorage] ⚠️ Could not extract Supabase URL from DATABASE_URL`);
      logger.warn(`[SupabaseStorage] ⚠️ Hostname: ${host}`);
      logger.warn(`[SupabaseStorage] ⚠️ Username: ${user}`);
      logger.warn(`[SupabaseStorage] 💡 Tip: Set SUPABASE_URL manually in environment variables`);
      return null;
    } catch (error) {
      logger.error('[SupabaseStorage] ❌ Error extracting Supabase URL:', error);
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
      const extractedUrl = this.extractSupabaseUrl(process.env.DATABASE_URL);
      if (extractedUrl) {
        supabaseUrl = extractedUrl;
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
      logger.warn(`⚠️ Supabase URL: ${supabaseUrl || 'NOT FOUND'}`);
      logger.warn(`⚠️ Supabase Key: ${supabaseServiceKey ? 'FOUND (length: ' + supabaseServiceKey.length + ')' : 'NOT FOUND'}`);
      logger.info('💡 To enable Supabase Storage:');
      logger.info('   1. Get your Supabase URL from: https://app.supabase.com/project/[PROJECT_REF]/settings/api');
      logger.info('   2. Get your Service Role Key (recommended) or Anon Key from the same page');
      logger.info('   3. Set in Railway environment variables:');
      logger.info('      - SUPABASE_URL=https://[PROJECT_REF].supabase.co');
      logger.info('      - SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
      logger.info('   4. Or set SUPABASE_URL manually if extraction from DATABASE_URL failed');
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
      
      // ✅ TESTE: Verificar conexão testando listar buckets
      this.testConnection().catch(err => {
        logger.warn('[SupabaseStorage] ⚠️ Connection test failed (this is OK if buckets list is empty):', err?.message);
      });
    } catch (error) {
      logger.error('❌ Failed to initialize Supabase Storage:', error);
      this.client = null;
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
      logger.info(`[SupabaseStorage] 📤 Starting upload: ${filename} (${buffer.length} bytes, ${mimetype})`);
      
      // Garantir que o bucket existe
      try {
        await this.ensureBucketExists();
        logger.info(`[SupabaseStorage] ✅ Bucket verified: ${this.bucketName}`);
      } catch (bucketError: any) {
        logger.error('[SupabaseStorage] ❌ Error ensuring bucket exists:', bucketError);
        throw bucketError;
      }

      // Fazer upload do arquivo
      logger.info(`[SupabaseStorage] 📤 Uploading file to bucket...`);
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(filename, buffer, {
          contentType: mimetype,
          upsert: false, // Não sobrescrever arquivos existentes
        });

      if (error) {
        logger.error('[SupabaseStorage] ❌ Error uploading to Supabase Storage:', {
          error: error.message || error,
          code: (error as any).statusCode,
          filename,
          mimetype,
          size: buffer.length,
        });
        return null;
      }

      if (!data) {
        logger.error('[SupabaseStorage] ❌ Upload returned no data');
        return null;
      }

      // Obter URL pública do arquivo
      logger.info(`[SupabaseStorage] 🔗 Getting public URL for path: ${data.path}`);
      const { data: urlData } = this.client.storage
        .from(this.bucketName)
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      logger.info(`[SupabaseStorage] ✅ File uploaded successfully: ${publicUrl}`);

      return publicUrl;
    } catch (error: any) {
      logger.error('[SupabaseStorage] ❌ Exception uploading to Supabase Storage:', {
        message: error?.message || String(error),
        stack: error?.stack,
        filename,
        mimetype,
        size: buffer.length,
      });
      return null;
    }
  }

  /**
   * Testa a conexão com o Supabase Storage
   */
  private async testConnection(): Promise<void> {
    if (!this.client) return;

    try {
      logger.info('[SupabaseStorage] 🧪 Testing connection to Supabase Storage...');
      const { data: buckets, error } = await this.client.storage.listBuckets();
      
      if (error) {
        logger.error('[SupabaseStorage] ❌ Connection test failed:', error);
        throw error;
      }
      
      logger.info(`[SupabaseStorage] ✅ Connection test successful! Found ${buckets?.length || 0} bucket(s)`);
      if (buckets && buckets.length > 0) {
        logger.info(`[SupabaseStorage] 📦 Existing buckets: ${buckets.map(b => b.name).join(', ')}`);
      }
    } catch (error: any) {
      logger.error('[SupabaseStorage] ❌ Connection test failed:', {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
      });
      throw error;
    }
  }

  /**
   * Garante que o bucket existe, criando-o se necessário
   */
  private async ensureBucketExists(): Promise<void> {
    if (!this.client) {
      logger.warn('[SupabaseStorage] ⚠️ Cannot ensure bucket exists - client not initialized');
      return;
    }

    try {
      logger.info(`[SupabaseStorage] 🔍 Checking if bucket '${this.bucketName}' exists...`);
      
      // Verificar se o bucket existe
      const { data: buckets, error: listError } = await this.client.storage.listBuckets();

      if (listError) {
        logger.error('[SupabaseStorage] ❌ Error listing buckets:', {
          message: listError.message,
          code: (listError as any).statusCode,
          error: listError,
        });
        throw listError;
      }

      logger.info(`[SupabaseStorage] 📦 Found ${buckets?.length || 0} bucket(s) in project`);
      
      const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName);
      logger.info(`[SupabaseStorage] 🔍 Bucket '${this.bucketName}' exists: ${bucketExists}`);

      if (!bucketExists) {
        logger.info(`[SupabaseStorage] 📦 Creating bucket '${this.bucketName}'...`);
        
        // Criar o bucket se não existir
        const { data: newBucket, error: createError } = await this.client.storage.createBucket(this.bucketName, {
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
          logger.error('[SupabaseStorage] ❌ Error creating bucket:', {
            message: createError.message,
            code: (createError as any).statusCode,
            error: createError,
          });
          throw createError;
        }
        
        logger.info(`[SupabaseStorage] ✅ Bucket '${this.bucketName}' created successfully!`, newBucket);
      } else {
        logger.info(`[SupabaseStorage] ✅ Bucket '${this.bucketName}' already exists`);
      }
    } catch (error: any) {
      logger.error('[SupabaseStorage] ❌ Exception ensuring bucket exists:', {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        statusCode: error?.statusCode,
      });
      throw error;
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



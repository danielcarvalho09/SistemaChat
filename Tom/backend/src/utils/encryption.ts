import crypto from 'crypto';
import { logger } from '../config/logger.js';

/**
 * Serviço de criptografia AES-256-GCM para dados sensíveis
 * 
 * ATENÇÃO: A chave de criptografia (ENCRYPTION_KEY) deve ter 32 bytes (256 bits)
 * Gere uma chave segura: openssl rand -hex 32
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // Para GCM, IV deve ser 12-16 bytes (16 é o padrão)
const AUTH_TAG_LENGTH = 16; // GCM authentication tag
const SALT_LENGTH = 64; // Salt para derivação de chave

/**
 * Obtém a chave de criptografia das variáveis de ambiente
 * @throws {Error} Se a chave não estiver configurada ou for inválida
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    logger.error('❌ ENCRYPTION_KEY não configurada nas variáveis de ambiente');
    throw new Error(
      'ENCRYPTION_KEY is not configured. Generate one with: openssl rand -hex 32'
    );
  }

  // Verificar se a chave tem o tamanho correto (64 caracteres hex = 32 bytes)
  if (key.length !== 64) {
    logger.error('❌ ENCRYPTION_KEY deve ter 64 caracteres (32 bytes)');
    throw new Error(
      'ENCRYPTION_KEY must be 64 hex characters (32 bytes). Current length: ' + key.length
    );
  }

  try {
    return Buffer.from(key, 'hex');
  } catch (error) {
    logger.error('❌ ENCRYPTION_KEY inválida (não é hexadecimal válido)');
    throw new Error('ENCRYPTION_KEY must be a valid hexadecimal string');
  }
}

/**
 * Criptografa dados usando AES-256-GCM
 * 
 * Formato final: iv:authTag:encryptedData (tudo em hex)
 * 
 * @param text - Texto em claro para criptografar
 * @returns String criptografada no formato iv:authTag:encryptedData
 * @throws {Error} Se houver erro na criptografia
 * 
 * @example
 * const encrypted = encrypt('dados sensíveis');
 * // Retorna: "a1b2c3d4....:e5f6g7h8....:i9j0k1l2...."
 */
export function encrypt(text: string): string {
  try {
    // Validar input
    if (!text || typeof text !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    // Obter chave de criptografia
    const key = getEncryptionKey();

    // Gerar IV aleatório (Initialization Vector)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Criar cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Criptografar
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Obter authentication tag (GCM)
    const authTag = cipher.getAuthTag();

    // Retornar: iv:authTag:encryptedData
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    logger.debug('✅ Data encrypted successfully');
    return result;
  } catch (error) {
    logger.error('❌ Encryption failed:', error);
    throw new Error(`Encryption failed: ${(error as Error).message}`);
  }
}

/**
 * Descriptografa dados usando AES-256-GCM
 * 
 * @param encryptedText - String criptografada no formato iv:authTag:encryptedData
 * @returns Texto em claro original
 * @throws {Error} Se houver erro na descriptografia ou autenticação falhar
 * 
 * @example
 * const decrypted = decrypt('a1b2c3d4....:e5f6g7h8....:i9j0k1l2....');
 * // Retorna: "dados sensíveis"
 */
export function decrypt(encryptedText: string): string {
  try {
    // Validar input
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    // Separar componentes: iv:authTag:encryptedData
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted format. Expected format: iv:authTag:encryptedData'
      );
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    // Converter de hex para Buffer
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();

    // Validar tamanhos
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: ${iv.length}, expected: ${IV_LENGTH}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: ${authTag.length}, expected: ${AUTH_TAG_LENGTH}`);
    }

    // Criar decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Descriptografar
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    logger.debug('✅ Data decrypted successfully');
    return decrypted;
  } catch (error) {
    logger.error('❌ Decryption failed:', error);
    
    // Se falhar autenticação, significa que os dados foram adulterados
    if ((error as Error).message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Authentication failed: data may have been tampered with');
    }
    
    throw new Error(`Decryption failed: ${(error as Error).message}`);
  }
}

/**
 * Verifica se um texto está criptografado (formato válido)
 * 
 * @param text - Texto para verificar
 * @returns true se estiver no formato criptografado válido
 */
export function isEncrypted(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const parts = text.split(':');
  if (parts.length !== 3) return false;
  
  // Verificar se são hex strings válidas
  const hexPattern = /^[0-9a-f]+$/i;
  return parts.every(part => hexPattern.test(part));
}

/**
 * Hash de dados usando SHA-256 (one-way)
 * Útil para comparação de dados sem armazená-los em claro
 * 
 * @param data - Dados para fazer hash
 * @returns Hash SHA-256 em hexadecimal
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Gera uma chave de criptografia aleatória segura
 * Útil para setup inicial
 * 
 * @returns Chave de 32 bytes em hexadecimal
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Testa se o sistema de criptografia está funcionando
 * Útil para validar configuração
 * 
 * @returns true se tudo estiver funcionando corretamente
 * @throws {Error} Se houver algum problema
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-data-' + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    if (testData !== decrypted) {
      throw new Error('Encryption test failed: decrypted data does not match original');
    }
    
    logger.info('✅ Encryption system test passed');
    return true;
  } catch (error) {
    logger.error('❌ Encryption system test failed:', error);
    throw error;
  }
}


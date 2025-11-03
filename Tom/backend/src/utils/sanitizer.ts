import validator from 'validator';
import xss from 'xss';
import { logger } from '../config/logger.js';

/**
 * Utilitários de sanitização de inputs
 * 
 * Previne:
 * - XSS (Cross-Site Scripting)
 * - SQL Injection (complemento ao Prisma)
 * - Path Traversal
 * - Command Injection
 * - HTML Injection
 */

/**
 * Remove tags HTML e scripts maliciosos
 * Usa biblioteca `xss` (4M+ downloads/semana)
 * 
 * @param input - String a ser sanitizada
 * @returns String sem HTML malicioso
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return xss(input, {
    whiteList: {}, // Remover TODAS as tags HTML
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
}

/**
 * Sanitiza texto simples (remove controles e normaliza)
 * 
 * @param input - String a ser sanitizada
 * @returns String limpa
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remover caracteres de controle
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Normalizar espaços em branco
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Limitar tamanho (DoS protection)
  if (sanitized.length > 10000) {
    logger.warn('Input text exceeds 10000 characters, truncating');
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
}

/**
 * Valida e sanitiza email
 * 
 * @param email - Email a ser validado
 * @returns Email normalizado ou null se inválido
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  
  // Normalizar
  const normalized = validator.normalizeEmail(email);
  if (!normalized) return null;
  
  // Validar
  if (!validator.isEmail(normalized)) {
    return null;
  }
  
  // Validar tamanho (RFC 5321)
  if (normalized.length > 254) {
    return null;
  }
  
  return normalized.toLowerCase();
}

/**
 * Valida e sanitiza URL
 * 
 * @param url - URL a ser validada
 * @param allowedProtocols - Protocolos permitidos (default: http, https)
 * @returns URL sanitizada ou null se inválida
 */
export function sanitizeURL(
  url: string,
  allowedProtocols: string[] = ['http', 'https']
): string | null {
  if (!url || typeof url !== 'string') return null;
  
  // Validar formato
  if (!validator.isURL(url, {
    protocols: allowedProtocols,
    require_protocol: true,
    require_valid_protocol: true,
    allow_underscores: false,
    allow_trailing_dot: false,
    allow_protocol_relative_urls: false,
  })) {
    return null;
  }
  
  // Verificar se não é javascript: ou data: (XSS)
  const urlLower = url.toLowerCase();
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some(proto => urlLower.startsWith(proto))) {
    logger.warn(`Dangerous protocol detected in URL: ${url}`);
    return null;
  }
  
  return url;
}

/**
 * Sanitiza número de telefone
 * Remove caracteres não-numéricos
 * 
 * @param phone - Telefone a ser sanitizado
 * @returns Apenas dígitos
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  // Remover tudo exceto dígitos e +
  let sanitized = phone.replace(/[^\d+]/g, '');
  
  // Limitar tamanho (15 dígitos = formato internacional máximo)
  if (sanitized.length > 20) {
    sanitized = sanitized.substring(0, 20);
  }
  
  return sanitized;
}

/**
 * Valida e sanitiza UUID
 * 
 * @param uuid - UUID a ser validado
 * @returns UUID válido ou null
 */
export function sanitizeUUID(uuid: string): string | null {
  if (!uuid || typeof uuid !== 'string') return null;
  
  if (!validator.isUUID(uuid, 4)) {
    return null;
  }
  
  return uuid.toLowerCase();
}

/**
 * Previne Path Traversal
 * Remove ../, ..\, etc.
 * 
 * @param path - Caminho a ser sanitizado
 * @returns Caminho seguro
 */
export function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') return '';
  
  // Remover path traversal
  let sanitized = path.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[/\\]+/g, '/'); // Normalizar separadores
  sanitized = sanitized.replace(/^\/+/, ''); // Remover / inicial
  
  // Remover caracteres perigosos
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');
  
  return sanitized;
}

/**
 * Escapa caracteres especiais para SQL (complemento ao Prisma)
 * Prisma já previne SQL injection, mas útil para queries raw
 * 
 * @param input - String a ser escapada
 * @returns String escapada
 */
export function escapeSQLString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/'/g, "''")  // Escapar aspas simples
    .replace(/\\/g, '\\\\')  // Escapar barras invertidas
    .replace(/\x00/g, '\\0')  // Null byte
    .replace(/\n/g, '\\n')  // Nova linha
    .replace(/\r/g, '\\r')  // Carriage return
    .replace(/\x1a/g, '\\Z'); // Ctrl-Z
}

/**
 * Sanitiza objeto inteiro recursivamente
 * Aplica sanitização apropriada a cada campo
 * 
 * @param obj - Objeto a ser sanitizado
 * @param options - Opções de sanitização
 * @returns Objeto sanitizado
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    htmlFields?: string[];
    textFields?: string[];
    emailFields?: string[];
    urlFields?: string[];
    phoneFields?: string[];
  } = {}
): T {
  const {
    htmlFields = [],
    textFields = [],
    emailFields = ['email'],
    urlFields = ['url', 'website', 'avatar'],
    phoneFields = ['phone', 'phoneNumber'],
  } = options;
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
      continue;
    }
    
    // Sanitizar strings
    if (typeof value === 'string') {
      if (emailFields.includes(key)) {
        sanitized[key] = sanitizeEmail(value);
      } else if (urlFields.includes(key)) {
        sanitized[key] = sanitizeURL(value);
      } else if (phoneFields.includes(key)) {
        sanitized[key] = sanitizePhone(value);
      } else if (htmlFields.includes(key)) {
        sanitized[key] = sanitizeHTML(value);
      } else if (textFields.includes(key)) {
        sanitized[key] = sanitizeText(value);
      } else {
        // Padrão: sanitizar como texto
        sanitized[key] = sanitizeText(value);
      }
    }
    // Recursão para objetos aninhados
    else if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value, options);
    }
    // Sanitizar arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      );
    }
    // Manter outros tipos (number, boolean, etc)
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Valida comprimento de string
 * 
 * @param input - String a ser validada
 * @param min - Comprimento mínimo
 * @param max - Comprimento máximo
 * @returns true se válido
 */
export function validateLength(
  input: string,
  min: number,
  max: number
): boolean {
  if (!input || typeof input !== 'string') return false;
  return input.length >= min && input.length <= max;
}

/**
 * Remove emojis de string
 * Útil para campos que não devem ter emojis (ex: código, ID)
 * 
 * @param input - String a ser sanitizada
 * @returns String sem emojis
 */
export function removeEmojis(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input.replace(
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
    ''
  );
}

/**
 * Sanitiza mensagem de chat (permite emojis, mas remove scripts)
 * 
 * @param message - Mensagem a ser sanitizada
 * @returns Mensagem segura
 */
export function sanitizeChatMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  
  // Remover tags HTML/scripts perigosos mas permitir texto rico
  let sanitized = xss(message, {
    whiteList: {
      b: [],
      i: [],
      u: [],
      strong: [],
      em: [],
      br: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe'],
  });
  
  // Normalizar espaços mas manter quebras de linha
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  
  // Limitar tamanho (WhatsApp limita 65536 caracteres)
  if (sanitized.length > 65536) {
    logger.warn('Message exceeds WhatsApp limit (65536 chars), truncating');
    sanitized = sanitized.substring(0, 65536);
  }
  
  return sanitized.trim();
}

/**
 * Testa se string contém conteúdo malicioso
 * 
 * @param input - String a ser testada
 * @returns true se contém conteúdo suspeito
 */
export function containsMaliciousContent(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick=, onload=, etc.
    /<iframe/gi,
    /eval\(/gi,
    /document\.cookie/gi,
    /\.\.\/\.\.\//gi, // Path traversal
    /\|\s*\w+/gi, // Command injection (pipe)
    /`.*`/gi, // Template literals
    /\$\{.*\}/gi, // Template expressions
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
}


/**
 * Utilitário para obter o nome de exibição correto de uma conversa WhatsApp
 * 
 * Regras:
 * - Grupos (@g.us): Sempre usar o nome do grupo (subject), nunca o nome do remetente
 * - Privados (@s.whatsapp.net): Usar pushName/name do contato, nunca o nome do remetente
 * 
 * @param jid - JID da conversa (ex: 5511999999999@s.whatsapp.net ou 120363123456789012@g.us)
 * @param socket - Socket Baileys para acessar groupMetadata e contacts
 * @param pushName - PushName da mensagem (apenas para privados como fallback)
 * @returns Nome de exibição da conversa
 */

import { WASocket } from '@whiskeysockets/baileys';
import { logger } from '../config/logger.js';

export async function getDisplayName(
  jid: string,
  socket: WASocket | null,
  pushName?: string | null
): Promise<string> {
  if (!jid) {
    logger.warn('[getDisplayName] JID vazio fornecido');
    return 'Desconhecido';
  }

  // Detectar se é grupo ou conversa privada
  const isGroup = jid.endsWith('@g.us');
  const isPrivate = jid.endsWith('@s.whatsapp.net');

  // ==================== GRUPOS ====================
  if (isGroup) {
    // ✅ REGRA: Em grupos, SEMPRE usar o nome do grupo (subject)
    // NUNCA usar o nome do remetente da última mensagem
    
    if (!socket) {
      logger.warn(`[getDisplayName] Socket não disponível para grupo ${jid}`);
      // Fallback: extrair número do JID
      const phoneNumber = jid.replace('@g.us', '').replace('@lid', '');
      return phoneNumber || 'Grupo Desconhecido';
    }

    try {
      // Tentar obter metadata do grupo através do socket
      const groupMetadata = await socket.groupMetadata(jid);
      
      if (groupMetadata?.subject) {
        logger.debug(`[getDisplayName] ✅ Nome do grupo obtido: ${groupMetadata.subject}`);
        return groupMetadata.subject;
      }

      // Fallback se subject não existir
      logger.warn(`[getDisplayName] ⚠️ Grupo ${jid} não tem subject, usando fallback`);
      const phoneNumber = jid.replace('@g.us', '').replace('@lid', '');
      return phoneNumber || 'Grupo Desconhecido';
    } catch (error: any) {
      // Erro ao buscar metadata do grupo
      logger.warn(`[getDisplayName] ⚠️ Erro ao buscar metadata do grupo ${jid}:`, error?.message || error);
      
      // Fallback: extrair número do JID
      const phoneNumber = jid.replace('@g.us', '').replace('@lid', '');
      return phoneNumber || 'Grupo Desconhecido';
    }
  }

  // ==================== CONVERSAS PRIVADAS ====================
  if (isPrivate) {
    // ✅ REGRA: Em privados, usar pushName/name do contato
    // NUNCA usar o nome do remetente da última mensagem
    
    if (!socket) {
      logger.warn(`[getDisplayName] Socket não disponível para privado ${jid}`);
      // Fallback: usar pushName da mensagem ou número
      return pushName || jid.replace('@s.whatsapp.net', '').replace('@lid', '') || 'Desconhecido';
    }

    // ✅ REGRA: Em privados, usar pushName da mensagem ou número
    // O Baileys não mantém um store de contatos facilmente acessível na versão atual
    // A melhor fonte é o pushName que vem na mensagem ou buscar do banco de dados
    
    // Fallback: usar pushName da mensagem ou número
    const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const displayName = pushName || phoneNumber || 'Desconhecido';
    
    logger.debug(`[getDisplayName] ✅ Nome do contato privado: ${displayName} (pushName: ${pushName || 'N/A'})`);
    return displayName;
  }

  // ==================== FALLBACK GENÉRICO ====================
  // Se não é grupo nem privado (caso raro), usar número extraído do JID
  logger.warn(`[getDisplayName] ⚠️ JID com formato desconhecido: ${jid}`);
  const phoneNumber = jid.split('@')[0] || 'Desconhecido';
  return phoneNumber;
}

/**
 * Versão síncrona simplificada (sem acesso ao socket)
 * Usa apenas informações disponíveis localmente
 */
export function getDisplayNameSync(
  jid: string,
  pushName?: string | null,
  contactName?: string | null
): string {
  if (!jid) {
    return 'Desconhecido';
  }

  const isGroup = jid.endsWith('@g.us');
  const isPrivate = jid.endsWith('@s.whatsapp.net');

  if (isGroup) {
    // Para grupos, retornar número (será atualizado quando socket estiver disponível)
    return jid.replace('@g.us', '').replace('@lid', '') || 'Grupo Desconhecido';
  }

  if (isPrivate) {
    // Para privados, priorizar: contactName > pushName > número
    return contactName || pushName || jid.replace('@s.whatsapp.net', '').replace('@lid', '') || 'Desconhecido';
  }

  return jid.split('@')[0] || 'Desconhecido';
}


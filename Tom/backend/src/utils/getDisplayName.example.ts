/**
 * EXEMPLO DE USO: getDisplayName no handler de messages.upsert
 * 
 * Este arquivo demonstra como usar a função getDisplayName dentro do handler
 * de messages.upsert para obter o nome correto da conversa.
 * 
 * IMPORTANTE: Este é um arquivo de exemplo/documentação. Não importe este arquivo.
 */

import { WASocket, proto } from '@whiskeysockets/baileys';
import { getDisplayName } from './getDisplayName.js';

/**
 * Exemplo de handler para messages.upsert
 * 
 * Este exemplo mostra como obter o nome correto da conversa ao receber uma mensagem,
 * seguindo as regras:
 * - Grupos: sempre usar subject do grupo
 * - Privados: usar pushName/name do contato
 */
export async function exampleMessagesUpsertHandler(
  socket: WASocket,
  connectionId: string,
  messages: proto.IWebMessageInfo[]
) {
  for (const msg of messages) {
    const jid = msg.key.remoteJid;
    if (!jid) continue;

    // ✅ OBTER NOME DA CONVERSA USANDO getDisplayName
    // Esta função centraliza toda a lógica de detecção de grupo vs privado
    // e retorna o nome correto conforme as regras estabelecidas
    
    const pushName = msg.pushName || null;
    const conversationName = await getDisplayName(jid, socket, pushName);
    
    console.log(`[Example] Conversa: ${conversationName}`);
    console.log(`[Example] JID: ${jid}`);
    console.log(`[Example] É grupo: ${jid.endsWith('@g.us')}`);
    
    // ✅ DETALHES IMPORTANTES:
    // 
    // 1. Para grupos (@g.us):
    //    - getDisplayName sempre retorna o subject do grupo
    //    - NUNCA usa o nome do remetente (participant)
    //    - Se não conseguir obter subject, usa fallback (número do grupo)
    //
    // 2. Para privados (@s.whatsapp.net):
    //    - getDisplayName usa pushName da mensagem ou número
    //    - NUNCA usa o nome do remetente da última mensagem
    //    - O pushName é do contato da conversa, não do remetente
    //
    // 3. Fallbacks:
    //    - Se socket não disponível: usa número extraído do JID
    //    - Se erro ao buscar metadata: usa número como fallback
    //    - Sempre retorna algo (nunca undefined/null)
    
    // ✅ USO NO PROCESSAMENTO DE MENSAGENS:
    // 
    // Você pode usar conversationName para:
    // - Criar/atualizar contato no banco de dados
    // - Exibir nome da conversa no frontend
    // - Logs e debugging
    // 
    // Exemplo de uso no MessageService:
    // 
    // const contactName = await getDisplayName(from, client?.socket || null, pushName || null);
    // await prisma.contact.upsert({
    //   where: { phoneNumber },
    //   update: { name: contactName }, // Atualizar se mudou
    //   create: { phoneNumber, name: contactName }
    // });
  }
}

/**
 * Exemplo de uso síncrono (quando socket não está disponível)
 * 
 * Use getDisplayNameSync quando você já tem as informações do contato
 * e não precisa acessar o socket do Baileys.
 */
export function exampleSyncUsage(
  jid: string,
  pushName: string | null,
  contactNameFromDB: string | null
) {
  const { getDisplayNameSync } = require('./getDisplayName.js');
  
  // Para grupos: retorna número (será atualizado quando socket estiver disponível)
  // Para privados: retorna contactName > pushName > número
  const displayName = getDisplayNameSync(jid, pushName, contactNameFromDB);
  
  return displayName;
}


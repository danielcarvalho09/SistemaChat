/**
 * EXEMPLO DE USO: Enviar Áudio PTT (Push-to-Talk) no WhatsApp
 * 
 * Este exemplo demonstra como:
 * 1. Detectar um comando/trigger em mensagem recebida
 * 2. Converter um arquivo de áudio para formato OGG/Opus mono
 * 3. Enviar como mensagem de voz (PTT) usando Baileys
 * 
 * Para usar, importe este código no seu handler de mensagens.
 */

import { baileysManager } from '../whatsapp/baileys.manager.js';
import { convertToOggOpusMono, convertBufferToOggOpusMono } from '../utils/audio-ptt.utils.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger.js';

/**
 * Exemplo 1: Enviar áudio PTT quando receber um comando específico
 * 
 * Este exemplo mostra como detectar um comando (ex: "/audio") e enviar
 * um áudio PTT como resposta.
 */
export async function exemploEnviarAudioPTTComTrigger(
  connectionId: string,
  fromJid: string,
  messageText: string
): Promise<void> {
  try {
    // ✅ DETECTAR TRIGGER/COMANDO
    // Exemplo: Se mensagem for "/audio", enviar áudio PTT
    const trigger = '/audio';
    
    if (!messageText.trim().startsWith(trigger)) {
      // Não é o comando esperado, ignorar
      return;
    }

    logger.info(`[AudioPTT Example] 🎤 Trigger detectado: "${trigger}" de ${fromJid}`);

    // ✅ CAMINHO DO ARQUIVO DE ÁUDIO
    // Você pode ter um arquivo pré-gravado ou gerar dinamicamente
    const audioFilePath = path.join(process.cwd(), 'assets', 'audio', 'resposta-voz.ogg');
    
    // Se o arquivo não existir, criar um exemplo ou usar outro arquivo
    if (!fs.existsSync(audioFilePath)) {
      logger.warn(`[AudioPTT Example] ⚠️ Arquivo de áudio não encontrado: ${audioFilePath}`);
      logger.info(`[AudioPTT Example] 💡 Criando áudio de exemplo ou usando arquivo alternativo...`);
      
      // Exemplo: Converter arquivo MP3 para OGG/Opus
      const mp3Path = path.join(process.cwd(), 'assets', 'audio', 'resposta-voz.mp3');
      if (fs.existsSync(mp3Path)) {
        logger.info(`[AudioPTT Example] 🔄 Convertendo MP3 para OGG/Opus...`);
        const convertedPath = await convertToOggOpusMono(mp3Path, {
          quality: 3,
          bitrate: 32000,
          sampleRate: 16000,
          keepOriginal: true, // Manter arquivo MP3 original
        });
        
        // Usar arquivo convertido
        const convertedBuffer = fs.readFileSync(convertedPath);
        
        // ✅ ENVIAR ÁUDIO PTT
        await baileysManager.enviarAudioPTT(
          connectionId,
          fromJid,
          convertedBuffer,
          {
            autoConvert: false, // Já está convertido
          }
        );
        
        return;
      } else {
        throw new Error(`Arquivo de áudio não encontrado: ${audioFilePath} ou ${mp3Path}`);
      }
    }

    // ✅ ENVIAR ÁUDIO PTT (com conversão automática se necessário)
    logger.info(`[AudioPTT Example] 📤 Enviando áudio PTT...`);
    
    await baileysManager.enviarAudioPTT(
      connectionId,
      fromJid,
      audioFilePath, // Caminho do arquivo
      {
        autoConvert: true, // Converter automaticamente para OGG/Opus se necessário
      }
    );

    logger.info(`[AudioPTT Example] ✅ Áudio PTT enviado com sucesso para ${fromJid}`);
  } catch (error) {
    logger.error(`[AudioPTT Example] ❌ Erro ao enviar áudio PTT:`, error);
    throw error;
  }
}

/**
 * Exemplo 2: Enviar áudio PTT a partir de buffer (áudio gravado em tempo real)
 * 
 * Este exemplo mostra como enviar um buffer de áudio que foi gravado
 * em tempo real (por exemplo, de um stream de áudio).
 */
export async function exemploEnviarAudioPTTDeBuffer(
  connectionId: string,
  toJid: string,
  audioBuffer: Buffer,
  audioFormat: string = 'mp3'
): Promise<void> {
  try {
    logger.info(`[AudioPTT Example] 🎤 Preparando envio de áudio PTT de buffer...`);
    logger.info(`[AudioPTT Example]    Tamanho: ${audioBuffer.length} bytes`);
    logger.info(`[AudioPTT Example]    Formato original: ${audioFormat}`);

    // ✅ CONVERTER BUFFER PARA OGG/OPUS MONO
    // Se o buffer não está em formato OGG/Opus, converter primeiro
    if (audioFormat.toLowerCase() !== 'ogg' && audioFormat.toLowerCase() !== 'opus') {
      logger.info(`[AudioPTT Example] 🔄 Convertendo buffer para OGG/Opus mono...`);
      
      const convertedBuffer = await convertBufferToOggOpusMono(
        audioBuffer,
        audioFormat,
        {
          quality: 3,
          bitrate: 32000,
          sampleRate: 16000,
        }
      );

      // ✅ ENVIAR BUFFER CONVERTIDO
      await baileysManager.enviarAudioPTT(
        connectionId,
        toJid,
        convertedBuffer,
        {
          autoConvert: false, // Já está convertido
        }
      );
    } else {
      // ✅ ENVIAR BUFFER DIRETO (já está em formato correto)
      await baileysManager.enviarAudioPTT(
        connectionId,
        toJid,
        audioBuffer,
        {
          autoConvert: false,
        }
      );
    }

    logger.info(`[AudioPTT Example] ✅ Áudio PTT enviado com sucesso para ${toJid}`);
  } catch (error) {
    logger.error(`[AudioPTT Example] ❌ Erro ao enviar áudio PTT de buffer:`, error);
    throw error;
  }
}

/**
 * Exemplo 3: Integração completa com handler de mensagens
 * 
 * Este exemplo mostra como integrar o envio de áudio PTT no handler
 * de mensagens do Baileys, respondendo automaticamente a comandos.
 */
export async function exemploIntegracaoComHandlerDeMensagens(
  connectionId: string,
  from: string,
  messageText: string
): Promise<void> {
  try {
    // ✅ DETECTAR COMANDOS DIFERENTES
    const commands = {
      '/audio1': path.join(process.cwd(), 'assets', 'audio', 'audio1.ogg'),
      '/audio2': path.join(process.cwd(), 'assets', 'audio', 'audio2.mp3'),
      '/audio3': path.join(process.cwd(), 'assets', 'audio', 'audio3.wav'),
    };

    // Verificar se mensagem é um comando conhecido
    const command = Object.keys(commands).find(cmd => messageText.trim() === cmd);
    
    if (!command) {
      // Não é um comando de áudio, ignorar
      return;
    }

    const audioPath = commands[command as keyof typeof commands];
    
    logger.info(`[AudioPTT Example] 🎤 Comando detectado: ${command}`);
    logger.info(`[AudioPTT Example]    Arquivo: ${audioPath}`);
    logger.info(`[AudioPTT Example]    Para: ${from}`);

    // ✅ VERIFICAR SE ARQUIVO EXISTE
    if (!fs.existsSync(audioPath)) {
      logger.warn(`[AudioPTT Example] ⚠️ Arquivo de áudio não encontrado: ${audioPath}`);
      logger.info(`[AudioPTT Example] 💡 Enviando mensagem de texto como fallback...`);
      
      // Enviar mensagem de texto como fallback
      await baileysManager.sendMessage(
        connectionId,
        from,
        'Desculpe, o arquivo de áudio não está disponível no momento.',
        'text'
      );
      
      return;
    }

    // ✅ ENVIAR ÁUDIO PTT
    await baileysManager.enviarAudioPTT(
      connectionId,
      from,
      audioPath,
      {
        autoConvert: true, // Converter automaticamente se necessário
      }
    );

    logger.info(`[AudioPTT Example] ✅ Áudio PTT enviado para ${from}`);
  } catch (error) {
    logger.error(`[AudioPTT Example] ❌ Erro na integração com handler:`, error);
    
    // Enviar mensagem de erro ao usuário
    try {
      await baileysManager.sendMessage(
        connectionId,
        from,
        'Desculpe, ocorreu um erro ao enviar o áudio. Por favor, tente novamente.',
        'text'
      );
    } catch (sendError) {
      logger.error(`[AudioPTT Example] ❌ Erro ao enviar mensagem de erro:`, sendError);
    }
  }
}

/**
 * Exemplo 4: Enviar áudio PTT como resposta a uma mensagem (reply)
 * 
 * Este exemplo mostra como enviar um áudio PTT como resposta a uma
 * mensagem específica (usando quoted message).
 */
export async function exemploEnviarAudioPTTComoReply(
  connectionId: string,
  toJid: string,
  audioFilePath: string,
  quotedMessage: {
    stanzaId: string;
    messageId: string;
    messageType: string;
    content: string;
    mediaUrl: string | null;
    isFromContact: boolean;
  }
): Promise<void> {
  try {
    logger.info(`[AudioPTT Example] 🎤 Enviando áudio PTT como reply...`);
    logger.info(`[AudioPTT Example]    Reply para mensagem: ${quotedMessage.messageId}`);

    // ✅ ENVIAR ÁUDIO PTT COM QUOTED MESSAGE
    await baileysManager.enviarAudioPTT(
      connectionId,
      toJid,
      audioFilePath,
      {
        autoConvert: true,
        quotedMessage: quotedMessage,
      }
    );

    logger.info(`[AudioPTT Example] ✅ Áudio PTT enviado como reply para ${toJid}`);
  } catch (error) {
    logger.error(`[AudioPTT Example] ❌ Erro ao enviar áudio PTT como reply:`, error);
    throw error;
  }
}


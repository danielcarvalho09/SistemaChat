import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger.js';

const execAsync = promisify(exec);

/**
 * Interface para opções de conversão de áudio
 */
interface AudioConversionOptions {
  /** Diretório de saída para o arquivo convertido */
  outputDir?: string;
  /** Qualidade de áudio (0-9, onde 0 é melhor qualidade) */
  quality?: number;
  /** Taxa de bits do áudio (padrão: 32000 para mensagens de voz) */
  bitrate?: number;
  /** Taxa de amostragem (padrão: 16000 Hz para voz) */
  sampleRate?: number;
  /** Manter arquivo original após conversão */
  keepOriginal?: boolean;
}

/**
 * Converte áudio para formato OGG/Opus mono compatível com WhatsApp PTT
 * 
 * @param inputPath - Caminho do arquivo de entrada (pode ser qualquer formato)
 * @param options - Opções de conversão
 * @returns Promise<string> - Caminho do arquivo convertido
 * 
 * @example
 * ```typescript
 * const outputPath = await convertToOggOpusMono('./audio.mp3', {
 *   quality: 3,
 *   sampleRate: 16000
 * });
 * ```
 */
export async function convertToOggOpusMono(
  inputPath: string,
  options: AudioConversionOptions = {}
): Promise<string> {
  const {
    outputDir = path.join(process.cwd(), 'secure-uploads', 'audio-ptt'),
    quality = 3, // Qualidade boa para voz (0-9, menor = melhor)
    bitrate = 32000, // 32kbps é suficiente para voz
    sampleRate = 16000, // 16kHz é padrão para voz
    keepOriginal = false,
  } = options;

  try {
    // Validar se arquivo de entrada existe
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Arquivo de entrada não encontrado: ${inputPath}`);
    }

    // Criar diretório de saída se não existir
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logger.info(`[AudioPTT] ✅ Diretório de saída criado: ${outputDir}`);
    }

    // Gerar nome do arquivo de saída (mesmo nome, extensão .ogg)
    const inputFilename = path.basename(inputPath);
    const outputFilename = `${path.parse(inputFilename).name}_ptt.ogg`;
    const outputPath = path.join(outputDir, outputFilename);

    logger.info(`[AudioPTT] 🎵 Convertendo áudio para OGG/Opus mono...`);
    logger.info(`[AudioPTT]    Entrada: ${inputPath}`);
    logger.info(`[AudioPTT]    Saída: ${outputPath}`);
    logger.info(`[AudioPTT]    Qualidade: ${quality}, Bitrate: ${bitrate}bps, Sample Rate: ${sampleRate}Hz`);

    // Comando FFmpeg para converter para OGG/Opus mono
    // Parâmetros importantes:
    // -ac 1: Áudio mono (1 canal) - necessário para PTT
    // -c:a libopus: Codec Opus
    // -b:a: Bitrate em bps
    // -ar: Taxa de amostragem
    // -application voip: Otimizado para voz
    // -compression_level: Qualidade (0-10, menor = melhor)
    const ffmpegCommand = [
      'ffmpeg',
      '-i', `"${inputPath}"`, // Arquivo de entrada
      '-ac', '1', // Converter para mono (1 canal)
      '-ar', sampleRate.toString(), // Taxa de amostragem
      '-c:a', 'libopus', // Codec Opus
      '-b:a', `${bitrate}`, // Bitrate
      '-application', 'voip', // Otimizado para voz
      '-compression_level', quality.toString(), // Qualidade (0-10)
      '-avoid_negative_ts', 'make_zero', // Corrigir timestamps negativos
      '-y', // Sobrescrever arquivo de saída se existir
      `"${outputPath}"`,
    ].join(' ');

    logger.info(`[AudioPTT] 🔧 Executando FFmpeg: ${ffmpegCommand.replace(/\s+/g, ' ')}`);

    // Executar conversão
    const { stdout, stderr } = await execAsync(ffmpegCommand);

    if (stderr && !stderr.includes('Stream mapping:')) {
      // FFmpeg normalmente escreve informações em stderr, mas erros críticos também
      logger.warn(`[AudioPTT] ⚠️ FFmpeg stderr: ${stderr.substring(0, 500)}`);
    }

    if (stdout) {
      logger.debug(`[AudioPTT] FFmpeg stdout: ${stdout}`);
    }

    // Verificar se arquivo foi criado
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Arquivo convertido não foi criado: ${outputPath}`);
    }

    const fileStats = fs.statSync(outputPath);
    logger.info(`[AudioPTT] ✅ Conversão concluída: ${outputPath} (${fileStats.size} bytes)`);

    // Remover arquivo original se solicitado
    if (!keepOriginal && inputPath !== outputPath) {
      try {
        fs.unlinkSync(inputPath);
        logger.info(`[AudioPTT] 🗑️ Arquivo original removido: ${inputPath}`);
      } catch (deleteError) {
        logger.warn(`[AudioPTT] ⚠️ Erro ao remover arquivo original: ${deleteError}`);
      }
    }

    return outputPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AudioPTT] ❌ Erro ao converter áudio: ${errorMessage}`);
    logger.error(`[AudioPTT] Stack trace:`, error instanceof Error ? error.stack : undefined);

    // Verificar se FFmpeg está instalado
    try {
      await execAsync('ffmpeg -version');
    } catch (ffmpegError) {
      throw new Error(
        'FFmpeg não está instalado ou não está no PATH. ' +
        'Instale FFmpeg para usar conversão de áudio: ' +
        'https://ffmpeg.org/download.html'
      );
    }

    throw error;
  }
}

/**
 * Converte buffer de áudio para OGG/Opus mono
 * Útil quando o áudio já está em memória
 * 
 * @param audioBuffer - Buffer contendo o áudio
 * @param inputFormat - Formato do áudio de entrada (ex: 'mp3', 'wav')
 * @param options - Opções de conversão
 * @returns Promise<Buffer> - Buffer do áudio convertido
 */
export async function convertBufferToOggOpusMono(
  audioBuffer: Buffer,
  inputFormat: string = 'mp3',
  options: AudioConversionOptions = {}
): Promise<Buffer> {
  const {
    outputDir = path.join(process.cwd(), 'secure-uploads', 'audio-ptt', 'temp'),
    quality = 3,
    bitrate = 32000,
    sampleRate = 16000,
  } = options;

  try {
    // Criar diretório temporário se não existir
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Criar arquivo temporário para entrada
    const tempInputPath = path.join(outputDir, `temp_input_${Date.now()}.${inputFormat}`);
    const tempOutputPath = path.join(outputDir, `temp_output_${Date.now()}.ogg`);

    // Escrever buffer no arquivo temporário
    fs.writeFileSync(tempInputPath, audioBuffer);
    logger.info(`[AudioPTT] 💾 Buffer temporário salvo: ${tempInputPath} (${audioBuffer.length} bytes)`);

    try {
      // Converter usando função existente
      await convertToOggOpusMono(tempInputPath, {
        outputDir: path.dirname(tempOutputPath),
        quality,
        bitrate,
        sampleRate,
        keepOriginal: false,
      });

      // Ler arquivo convertido
      const convertedBuffer = fs.readFileSync(tempOutputPath);
      logger.info(`[AudioPTT] ✅ Buffer convertido: ${convertedBuffer.length} bytes`);

      return convertedBuffer;
    } finally {
      // Limpar arquivos temporários
      try {
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      } catch (cleanupError) {
        logger.warn(`[AudioPTT] ⚠️ Erro ao limpar arquivos temporários: ${cleanupError}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AudioPTT] ❌ Erro ao converter buffer: ${errorMessage}`);
    throw error;
  }
}


import { useState, useEffect } from 'react';
import { Save, Clock, Info } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { toast } from 'sonner';

export function BroadcastSettings() {
  const [minInterval, setMinInterval] = useState(5);
  const [maxInterval, setMaxInterval] = useState(15);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoadingData(true);
    try {
      const response = await api.get('/broadcast/config/interval');
      const config = response.data?.data || response.data || {};
      setMinInterval(config.minInterval || 5);
      setMaxInterval(config.maxInterval || 15);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async () => {
    if (minInterval < 1) {
      toast.error('Intervalo mínimo deve ser pelo menos 1 segundo');
      return;
    }

    if (maxInterval < minInterval) {
      toast.error('Intervalo máximo deve ser maior que o mínimo');
      return;
    }

    setLoading(true);
    try {
      await api.put('/broadcast/config/interval', {
        minInterval,
        maxInterval,
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error(error.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008069] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações de Disparo</h1>
          <p className="text-gray-600 mt-1">Configure os intervalos entre envios de mensagens</p>
        </div>

        {/* Card de Configuração */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Informação */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Por que configurar intervalos?</p>
              <p>
                O WhatsApp pode detectar envios em massa como spam. Configurar intervalos aleatórios
                entre as mensagens ajuda a evitar bloqueios e torna os envios mais naturais.
              </p>
            </div>
          </div>

          {/* Intervalo Mínimo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Intervalo Mínimo (segundos)
            </label>
            <input
              type="number"
              min="1"
              value={minInterval}
              onChange={(e) => setMinInterval(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Tempo mínimo de espera entre cada mensagem
            </p>
          </div>

          {/* Intervalo Máximo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Intervalo Máximo (segundos)
            </label>
            <input
              type="number"
              min={minInterval}
              value={maxInterval}
              onChange={(e) => setMaxInterval(parseInt(e.target.value) || minInterval)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008069] focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Tempo máximo de espera entre cada mensagem
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Preview</h3>
            <p className="text-sm text-gray-600">
              O sistema aguardará entre <span className="font-semibold text-[#008069]">{minInterval}</span> e{' '}
              <span className="font-semibold text-[#008069]">{maxInterval}</span> segundos antes de enviar
              cada mensagem.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Tempo estimado para 100 mensagens:{' '}
              <span className="font-semibold">
                {Math.floor((minInterval + maxInterval) / 2 * 100 / 60)} minutos
              </span>
            </p>
          </div>

          {/* Recomendações */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Recomendações</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#008069] mt-1.5 flex-shrink-0"></div>
                <p>Para envios pequenos (até 50 mensagens): 3-8 segundos</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#008069] mt-1.5 flex-shrink-0"></div>
                <p>Para envios médios (50-200 mensagens): 5-15 segundos</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#008069] mt-1.5 flex-shrink-0"></div>
                <p>Para envios grandes (200+ mensagens): 10-30 segundos</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                <p className="text-red-600">
                  Evite intervalos muito curtos (menos de 3 segundos) para não ser detectado como spam
                </p>
              </div>
            </div>
          </div>

          {/* Botão Salvar */}
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>

        {/* Card de Avisos */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-2">⚠️ Avisos Importantes</h3>
          <ul className="space-y-1 text-sm text-yellow-800">
            <li>• Respeite as políticas do WhatsApp para evitar bloqueios</li>
            <li>• Não envie spam ou mensagens não solicitadas</li>
            <li>• Mantenha suas listas de contatos atualizadas</li>
            <li>• Use intervalos adequados ao volume de envios</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatArea } from '../components/chat/ChatArea';
import { ContactDetails } from '../components/chat/ContactDetails';
import { BackgroundPaths } from '../components/ui/background-paths';
import { useEnhancedWebSocket } from '../hooks/useEnhancedWebSocket';

export function Dashboard() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showContactDetails, setShowContactDetails] = useState(false);

  // 🔥 NOVO: Hook de WebSocket aprimorado para garantir atualizações em tempo real
  useEnhancedWebSocket();

  return (
    <div className="flex h-full bg-black">
      {/* Main Content - 3 Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Conversation List */}
        <div className="w-[600px] bg-black flex flex-col relative">
          <BackgroundPaths />
          <ConversationList
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
          />
        </div>

        {/* Center - Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversationId ? (
            <ChatArea
              conversationId={selectedConversationId}
              onToggleDetails={() => setShowContactDetails(!showContactDetails)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white relative">
              <BackgroundPaths />
              <div className="z-10 text-center space-y-3">
                <h1 className="text-[120px] font-bold text-gray-800 tracking-[0.02em] leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  AUTOCHAT
                </h1>
                <p className="text-xl text-gray-500 tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  POWERED BY DANIEL DE CARVALHO
                </p>
                <p className="text-sm text-gray-400 max-w-md mt-6">
                  Selecione uma conversa para começar o atendimento
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Contact Details */}
        {showContactDetails && selectedConversationId && (
          <div className="w-[400px] bg-black border-l border-gray-800">
            <ContactDetails
              conversationId={selectedConversationId}
              onClose={() => setShowContactDetails(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

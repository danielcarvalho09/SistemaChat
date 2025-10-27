import { useState } from 'react';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatArea } from '../components/chat/ChatArea';
import { ContactDetails } from '../components/chat/ContactDetails';
import { useWebSocket } from '../hooks/useWebSocket';
import { BackgroundPaths } from '../components/ui/background-paths';

export function Dashboard() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showContactDetails, setShowContactDetails] = useState(false);

  // Conectar ao WebSocket para receber mensagens em tempo real
  useWebSocket();

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
            <div className="flex-1 flex items-center justify-center bg-white relative">
              <BackgroundPaths />
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

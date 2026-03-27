import { useState, useEffect, useRef } from 'react';
import { X, Send, Minimize2 } from 'lucide-react';
import { aiService } from '@/services/aiService';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useTranslation } from 'react-i18next';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function AIChatbot() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: t('chatbot.welcome'),
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mapping entre avatars idle et working
  const avatarPairs = {
    '/ai-avatar/idle/processed_image-9.png': '/ai-avatar/working/output-onlinegiftools.gif',
    '/ai-avatar/idle/167c8f45-c0cb-41c5-aa4a-39c4cd32a8ea_removalai_preview.png': '/ai-avatar/working/output-onlinegiftools (1).gif',
    '/ai-avatar/idle/Frame_8-removebg-preview.png': '/ai-avatar/working/output-onlinegiftools-2.gif',
    '/ai-avatar/idle/final_5-removebg-preview.png': '/ai-avatar/working/output-onlinegiftools-3.gif',
  };

  // Charger les avatars disponibles
  const [idleAvatars] = useState<string[]>([
    '/ai-avatar/idle/processed_image-9.png',
    '/ai-avatar/idle/167c8f45-c0cb-41c5-aa4a-39c4cd32a8ea_removalai_preview.png',
    '/ai-avatar/idle/Frame_8-removebg-preview.png',
    '/ai-avatar/idle/final_5-removebg-preview.png',
  ]);
  const [hoveredAvatar, setHoveredAvatar] = useState<string>('');

  // Fonction pour sélectionner un avatar aléatoire
  const getRandomAvatar = () => {
    if (idleAvatars.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * idleAvatars.length);
    return idleAvatars[randomIndex];
  };

  // Fonction pour obtenir le working avatar associé
  const getWorkingAvatar = (idleAvatar: string) => {
    return avatarPairs[idleAvatar as keyof typeof avatarPairs] || null;
  };

  // Changer l'avatar idle au démarrage
  useEffect(() => {
    const avatar = getRandomAvatar();
    setCurrentAvatar(avatar || '');
    setHoveredAvatar('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changer le hovered avatar basé sur isTyping
  useEffect(() => {
    if (isTyping && currentAvatar) {
      const workingAvatar = getWorkingAvatar(currentAvatar);
      setHoveredAvatar(workingAvatar || '');
    } else {
      setHoveredAvatar('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping, currentAvatar]);

  // Auto-scroll vers le bas
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Ajouter le message de l'utilisateur
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      // Préparer l'historique de conversation pour Gemini
      const history = messages
        .filter((msg) => msg.sender !== 'ai' || msg.id !== '1') // Exclure le message d'accueil initial
        .map((msg) => ({
          role: (msg.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
          parts: [{ text: msg.text }],
        }));

      // Appeler l'API
      const response = await aiService.chat(currentInput, history);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);

      let errorText = t('chatbot.error_general');

      // Gérer les erreurs de rate limit spécifiquement
      if (error.response?.status === 429 || error.response?.data?.error === 'RATE_LIMIT_EXCEEDED') {
        errorText = t('chatbot.quota_exceeded');
        toast.error(t('chatbot.quota_toast'));
      } else {
        toast.error(t('chatbot.error_chat'));
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Placeholder avatar avec dégradé
  const AvatarPlaceholder = ({ isWorking }: { isWorking: boolean }) => (
    <div
      className={`w-full h-full rounded-full bg-gradient-to-br ${
        isWorking
          ? 'from-primary-500 via-primary-600 to-primary-700 animate-pulse'
          : 'from-primary-400 via-primary-500 to-primary-600'
      } flex items-center justify-center text-white font-bold text-2xl shadow-lg`}
    >
      AI
    </div>
  );

  return (
    <>
      {/* Bouton flottant avec avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => {
          if (currentAvatar) {
            const workingAvatar = getWorkingAvatar(currentAvatar);
            setHoveredAvatar(workingAvatar || '');
          }
        }}
        onMouseLeave={() => setHoveredAvatar('')}
        className={`fixed bottom-6 right-6 w-20 h-20 hover:scale-110 transition-all duration-300 z-50 bg-transparent border-none ${
          isOpen ? 'scale-0' : 'scale-100'
        }`}
        title={t('chatbot.tooltip')}
      >
        {hoveredAvatar ? (
          <img
            src={hoveredAvatar}
            alt={t('chatbot.name')}
            className="w-full h-full object-contain"
          />
        ) : currentAvatar ? (
          <img
            src={currentAvatar}
            alt={t('chatbot.name')}
            className="w-full h-full object-contain"
          />
        ) : (
          <AvatarPlaceholder isWorking={isTyping} />
        )}
      </button>

      {/* Fenêtre de chat */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col z-50 transition-all duration-300 ${
            isMinimized ? 'h-16' : 'h-[600px]'
          }`}
        >
          {/* Header du chat avec avatar */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 rounded-t-2xl">
            <div className="flex items-center space-x-3">
              {/* Avatar miniature */}
              <div className="w-16 h-16">
                {isTyping && currentAvatar ? (
                  <img
                    src={getWorkingAvatar(currentAvatar) || currentAvatar}
                    alt={t('chatbot.name')}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                ) : currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt={t('chatbot.name')}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                ) : (
                  <AvatarPlaceholder isWorking={isTyping} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('chatbot.name')}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isTyping ? t('chatbot.typing') : t('chatbot.online')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={isMinimized ? t('chatbot.maximize') : t('chatbot.minimize')}
              >
                <Minimize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title={t('common.close')}
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-red-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        message.sender === 'user'
                          ? 'bg-primary-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                      }`}
                    >
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          remarkPlugins={[remarkBreaks]}
                          components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            br: () => <br className="my-1" />,
                          }}
                        >
                          {message.text}
                        </ReactMarkdown>
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          message.sender === 'user'
                            ? 'text-primary-200'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-end space-x-2">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('chatbot.placeholder')}
                    rows={1}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="p-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                    title={t('chatbot.send')}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  {t('chatbot.hint')}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

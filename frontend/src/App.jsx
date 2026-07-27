import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import CodeComposer from './components/CodeComposer';
import ResponseParser from './components/ResponseParser';
import Logo from './components/Logo';

// API Client Helper
const askQuestionApi = async (question, codeContext) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
  
  try {
    const response = await fetch('/api/v1/tutor/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        code_context: codeContext || ""
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server returned error status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Connection timeout. The RAG vector search or model inference is taking too long.');
    }
    throw new Error(error.message || 'Unable to connect to the tutor backend. Please verify the server is running.');
  }
};

export default function App() {
  // Load initial chats from Local Storage
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem('ansi_c_tutor_chats');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse chats from localStorage', e);
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      const savedActive = localStorage.getItem('ansi_c_tutor_active_id');
      return savedActive || null;
    } catch (e) {
      return null;
    }
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Track copy status per message index
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const messagesEndRef = useRef(null);

  // Sync chats to Local Storage
  useEffect(() => {
    localStorage.setItem('ansi_c_tutor_chats', JSON.stringify(chats));
  }, [chats]);

  // Sync active chat ID to Local Storage
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('ansi_c_tutor_active_id', activeChatId);
    } else {
      localStorage.removeItem('ansi_c_tutor_active_id');
    }
  }, [activeChatId]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId, isGenerating]);

  // Locate currently active chat object
  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // New Chat Handler
  const handleNewChat = () => {
    setActiveChatId(null);
  };

  // Select Chat from Sidebar
  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
  };

  // Delete Chat from History
  const handleDeleteChat = (chatId) => {
    const updatedChats = chats.filter(c => c.id !== chatId);
    setChats(updatedChats);
    if (activeChatId === chatId) {
      setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    }
  };

  // Send Message Logic (handles both new messages and retries in-place)
  const handleSendMessage = async (question, codeContext, retryMsgId = null) => {
    if (isGenerating) return;

    let currentChatId = activeChatId;
    let updatedChats = [...chats];

    // 1. Create a new chat if there isn't one selected
    if (!currentChatId) {
      currentChatId = `chat-${Date.now()}`;
      const newChatObj = {
        id: currentChatId,
        title: question.length > 30 ? question.substring(0, 30) + '...' : question,
        messages: []
      };
      updatedChats = [newChatObj, ...updatedChats];
      setChats(updatedChats);
      setActiveChatId(currentChatId);
    }

    const activeChatIndex = updatedChats.findIndex(c => c.id === currentChatId);
    if (activeChatIndex === -1) return;

    const targetChat = { ...updatedChats[activeChatIndex] };
    let placeholderId;

    if (retryMsgId) {
      // Retry in-place: reset failed message to generating placeholder
      placeholderId = retryMsgId;
      targetChat.messages = targetChat.messages.map(m => {
        if (m.id === retryMsgId) {
          return {
            ...m,
            content: '',
            sourcesUsed: [],
            error: null,
            retryData: null,
            isPlaceholder: true
          };
        }
        return m;
      });
    } else {
      // Standard flow: append user message + assistant placeholder
      const userMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content: question,
        codeContext: codeContext || ''
      };
      placeholderId = `msg-assistant-temp-${Date.now()}`;
      const assistantPlaceholder = {
        id: placeholderId,
        role: 'assistant',
        content: '',
        sourcesUsed: [],
        isPlaceholder: true
      };
      targetChat.messages = [...targetChat.messages, userMessage, assistantPlaceholder];
    }

    updatedChats[activeChatIndex] = targetChat;
    setChats(updatedChats);
    setIsGenerating(true);

    try {
      // 4. Fire API call
      const data = await askQuestionApi(question, codeContext);
      
      // 5. Replace placeholder on success
      setChats(prevChats => {
        return prevChats.map(c => {
          if (c.id === currentChatId) {
            return {
              ...c,
              messages: c.messages.map(m => {
                if (m.id === placeholderId) {
                  return {
                    id: `msg-assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data.answer,
                    sourcesUsed: data.sources_used || []
                  };
                }
                return m;
              })
            };
          }
          return c;
        });
      });
    } catch (error) {
      // 6. Replace placeholder with error details on failure (keeping placeholderId for future retry)
      setChats(prevChats => {
        return prevChats.map(c => {
          if (c.id === currentChatId) {
            return {
              ...c,
              messages: c.messages.map(m => {
                if (m.id === placeholderId) {
                  return {
                    id: placeholderId,
                    role: 'assistant',
                    content: '',
                    sourcesUsed: [],
                    error: error.message || 'An unexpected request error occurred.',
                    retryData: { question, codeContext }
                  };
                }
                return m;
              })
            };
          }
          return c;
        });
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Retry logic for failed messages
  const handleRetry = (retryQuestion, retryCodeContext, errorMsgId) => {
    if (!activeChatId) return;
    handleSendMessage(retryQuestion, retryCodeContext, errorMsgId);
  };

  const handleCopyResponse = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message text: ', err);
    }
  };

  return (
    <div className="app-container">
      {/* Collapsible Sidebar */}
      <Sidebar 
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onNewChat={handleNewChat}
        isCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(true)}
      />

      {/* Mobile Sidebar Overlay */}
      {!isSidebarCollapsed && (
        <div 
          className="mobile-menu-overlay active" 
          onClick={() => setIsSidebarCollapsed(true)} 
        />
      )}

      {/* Main Container Area */}
      <div className="main-chat-container">
        {/* Header */}
        <header className="main-header">
          <div className="header-left">
            {isSidebarCollapsed && (
              <button 
                type="button" 
                className="toggle-sidebar-btn" 
                onClick={() => setIsSidebarCollapsed(false)}
                title="Expand Sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
              </button>
            )}
            <div className="header-title-area">
              <span className="header-title">ANSI C AI Tutor</span>
              <span className="header-subtitle">C89 SPEC</span>
            </div>
          </div>
          <div className="header-right">
            <Logo size="small" glow={true} />
          </div>
        </header>

        {/* Conversation Feed or Welcome Screen */}
        {!activeChat || activeChat.messages.length === 0 ? (
          <WelcomeScreen onSelectSuggestion={(text) => handleSendMessage(text, '')} />
        ) : (
          <div className="conversation-feed">
            <div className="messages-list">
              {activeChat.messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div key={message.id} className={`message-row ${message.role}`}>
                    {/* Icon/Avatar columns */}
                    {!isUser && (
                      <div className="message-avatar assistant">
                        <Logo size="small" glow={false} />
                      </div>
                    )}

                    <div className="message-bubble-wrapper">
                      {/* User input display */}
                      {isUser ? (
                        <>
                          <div className="message-bubble">
                            {message.content}
                          </div>
                          {message.codeContext && (
                            <div className="message-code-context">
                              <div className="code-context-header">C Source Code Attachment</div>
                              {message.codeContext}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Assistant output display */
                        <div className="message-bubble">
                          {message.isPlaceholder ? (
                            /* Loader animation */
                            <div className="generating-status">
                              <span className="generating-text">Generating response</span>
                              <div className="generating-dots">
                                <div className="generating-dot" />
                                <div className="generating-dot" />
                                <div className="generating-dot" />
                              </div>
                            </div>
                          ) : message.error ? (
                            /* Error alert panel */
                            <div className="error-alert-box">
                              <div className="error-header-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                                Connection Interrupted
                              </div>
                              <div className="error-message-text">
                                {message.error}
                              </div>
                              <button 
                                type="button" 
                                className="error-retry-btn"
                                onClick={() => handleRetry(message.retryData.question, message.retryData.codeContext, message.id)}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.72 2.78L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
                                Retry Query
                              </button>
                            </div>
                          ) : (
                            /* Renders formatted tutor sections */
                            <>
                              <ResponseParser answer={message.content} />
                              
                              {/* Display sources separately below the AI response */}
                              {message.sourcesUsed && message.sourcesUsed.length > 0 && (
                                <div className="sources-box">
                                  <svg className="sources-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                  <span className="sources-label">Sources:</span>
                                  <span>{message.sourcesUsed.join(', ')}</span>
                                </div>
                              )}

                              {/* Bubble controls */}
                              <div className="bubble-actions-row">
                                <button 
                                  className="bubble-action-btn"
                                  onClick={() => handleCopyResponse(message.content, message.id)}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                  {copiedMessageId === message.id ? 'Copied!' : 'Copy Explanation'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* User avatar right column */}
                    {isUser && (
                      <div className="message-avatar user">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Sticky Composer */}
        <CodeComposer 
          onSend={handleSendMessage} 
          isGenerating={isGenerating} 
        />
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import CodeComposer from './components/CodeComposer';
import ResponseParser from './components/ResponseParser';
import Logo from './components/Logo';

// API Client Helper
const askQuestionApi = async (question, codeContext) => {
  const controller = new AbortController();

  // Local RAG + local LLM inference can take time.
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch('/api/v1/tutor/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        code_context: codeContext || '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        errorData.detail ||
          `Server returned error status ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(
        'The request timed out while the tutor was generating a response.'
      );
    }

    throw new Error(
      error.message ||
        'Unable to connect to the tutor backend. Please verify the server is running.'
    );
  }
};

export default function App() {
  // -------------------------------------------------------
  // CHAT STATE
  // -------------------------------------------------------

  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem('ansi_c_tutor_chats');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error(
        'Failed to parse chats from localStorage:',
        error
      );
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [copiedMessageId, setCopiedMessageId] =
    useState(null);

  const messagesEndRef = useRef(null);

  // -------------------------------------------------------
  // LOCAL STORAGE
  // -------------------------------------------------------

  useEffect(() => {
    try {
      localStorage.setItem(
        'ansi_c_tutor_chats',
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error('Failed to save chats:', error);
    }
  }, [chats]);

  // -------------------------------------------------------
  // AUTO SCROLL
  // -------------------------------------------------------

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId, isGenerating]);

  // -------------------------------------------------------
  // ACTIVE CHAT
  // -------------------------------------------------------

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) ||
    null;

  // -------------------------------------------------------
  // NEW CHAT
  // -------------------------------------------------------

  const handleNewChat = () => {
    setActiveChatId(null);
  };

  // -------------------------------------------------------
  // SELECT CHAT
  // -------------------------------------------------------

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
  };

  // -------------------------------------------------------
  // DELETE CHAT
  // -------------------------------------------------------

  const handleDeleteChat = (chatId) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.filter(
        (chat) => chat.id !== chatId
      );

      if (activeChatId === chatId) {
        setActiveChatId(
          updatedChats.length > 0
            ? updatedChats[0].id
            : null
        );
      }

      return updatedChats;
    });
  };

  // -------------------------------------------------------
  // RENAME CHAT
  // -------------------------------------------------------

  const handleRenameChat = (chatId, newTitle) => {
    const trimmedTitle = newTitle.trim();

    if (!trimmedTitle) return;

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: trimmedTitle,
            }
          : chat
      )
    );
  };

  // -------------------------------------------------------
  // SEND MESSAGE
  // -------------------------------------------------------

  const handleSendMessage = async (
    question,
    codeContext,
    retryMsgId = null
  ) => {
    if (isGenerating) return;

    let currentChatId = activeChatId;
    let updatedChats = [...chats];

    // Create a new chat when no chat is selected
    if (!currentChatId) {
      currentChatId = `chat-${Date.now()}`;

      const newChatObj = {
        id: currentChatId,

        title:
          question.length > 30
            ? `${question.substring(0, 30)}...`
            : question,

        messages: [],
      };

      updatedChats = [
        newChatObj,
        ...updatedChats,
      ];

      setChats(updatedChats);
      setActiveChatId(currentChatId);
    }

    const activeChatIndex =
      updatedChats.findIndex(
        (chat) => chat.id === currentChatId
      );

    if (activeChatIndex === -1) return;

    const targetChat = {
      ...updatedChats[activeChatIndex],
    };

    let placeholderId;

    // -------------------------------------------------------
    // RETRY EXISTING FAILED RESPONSE
    // -------------------------------------------------------

    if (retryMsgId) {
      placeholderId = retryMsgId;

      targetChat.messages =
        targetChat.messages.map((message) => {
          if (message.id === retryMsgId) {
            return {
              ...message,
              content: '',
              sourcesUsed: [],
              error: null,
              retryData: null,
              isPlaceholder: true,
            };
          }

          return message;
        });
    }

    // -------------------------------------------------------
    // NORMAL NEW MESSAGE
    // -------------------------------------------------------

    else {
      const userMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content: question,
        codeContext: codeContext || '',
      };

      placeholderId =
        `msg-assistant-temp-${Date.now()}`;

      const assistantPlaceholder = {
        id: placeholderId,
        role: 'assistant',
        content: '',
        sourcesUsed: [],
        isPlaceholder: true,
      };

      targetChat.messages = [
        ...targetChat.messages,
        userMessage,
        assistantPlaceholder,
      ];
    }

    updatedChats[activeChatIndex] =
      targetChat;

    setChats(updatedChats);
    setIsGenerating(true);

    try {
      // -------------------------------------------------------
      // CALL RAG BACKEND
      // -------------------------------------------------------

      const data = await askQuestionApi(
        question,
        codeContext
      );

      // -------------------------------------------------------
      // REPLACE LOADER WITH RESPONSE
      // -------------------------------------------------------

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== currentChatId) {
            return chat;
          }

          return {
            ...chat,

            messages: chat.messages.map(
              (message) => {
                if (
                  message.id === placeholderId
                ) {
                  return {
                    id: `msg-assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data.answer,
                    sourcesUsed:
                      data.sources_used || [],
                  };
                }

                return message;
              }
            ),
          };
        })
      );
    } catch (error) {
      // -------------------------------------------------------
      // SHOW ERROR IN SAME RESPONSE POSITION
      // -------------------------------------------------------

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== currentChatId) {
            return chat;
          }

          return {
            ...chat,

            messages: chat.messages.map(
              (message) => {
                if (
                  message.id === placeholderId
                ) {
                  return {
                    id: placeholderId,
                    role: 'assistant',
                    content: '',
                    sourcesUsed: [],

                    error:
                      error.message ||
                      'An unexpected request error occurred.',

                    retryData: {
                      question,
                      codeContext,
                    },
                  };
                }

                return message;
              }
            ),
          };
        })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------
  // RETRY FAILED RESPONSE
  // -------------------------------------------------------

  const handleRetry = (
    retryQuestion,
    retryCodeContext,
    errorMsgId
  ) => {
    if (!activeChatId) return;

    handleSendMessage(
      retryQuestion,
      retryCodeContext,
      errorMsgId
    );
  };

  // -------------------------------------------------------
  // COPY RESPONSE
  // -------------------------------------------------------

  const handleCopyResponse = async (
    text,
    messageId
  ) => {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedMessageId(messageId);

      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error(
        'Failed to copy response:',
        error
      );
    }
  };

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <div className="app-container">

      {/* SIDEBAR */}

      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onNewChat={handleNewChat}
        isCollapsed={isSidebarCollapsed}
        onToggleSidebar={() =>
          setIsSidebarCollapsed(true)
        }
      />

      {/* MOBILE SIDEBAR OVERLAY */}

      {!isSidebarCollapsed && (
        <div
          className="mobile-menu-overlay active"
          onClick={() =>
            setIsSidebarCollapsed(true)
          }
        />
      )}

      {/* MAIN CHAT AREA */}

      <div className="main-chat-container">

        {/* HEADER */}

        <header className="main-header">

          <div className="header-left">

            {isSidebarCollapsed && (
              <button
                type="button"
                className="toggle-sidebar-btn"
                onClick={() =>
                  setIsSidebarCollapsed(false)
                }
                title="Expand Sidebar"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line
                    x1="3"
                    x2="21"
                    y1="12"
                    y2="12"
                  />

                  <line
                    x1="3"
                    x2="21"
                    y1="6"
                    y2="6"
                  />

                  <line
                    x1="3"
                    x2="21"
                    y1="18"
                    y2="18"
                  />
                </svg>
              </button>
            )}

            <div className="header-title-area">
              <span className="header-title">
                ANSI C Tutor
              </span>
            </div>

          </div>

          <div className="header-right">
            <Logo
              size="small"
              glow={true}
            />
          </div>

        </header>

        {/* WELCOME SCREEN OR CONVERSATION */}

        {!activeChat ||
        activeChat.messages.length === 0 ? (

          <WelcomeScreen
            onSelectSuggestion={(text) =>
              handleSendMessage(text, '')
            }
          />

        ) : (

          <div className="conversation-feed">

            <div className="messages-list">

              {activeChat.messages.map(
                (message) => {
                  const isUser =
                    message.role === 'user';

                  return (
                    <div
                      key={message.id}
                      className={`message-row ${message.role}`}
                    >

                      {/* ASSISTANT LOGO */}

                      {!isUser && (
                        <div className="message-avatar assistant">
                          <Logo
                            size="small"
                            glow={false}
                          />
                        </div>
                      )}

                      <div className="message-bubble-wrapper">

                        {/* USER MESSAGE */}

                        {isUser ? (
                          <>
                            <div className="message-bubble">
                              {message.content}
                            </div>

                            {message.codeContext && (
                              <div className="message-code-context">

                                <div className="code-context-header">
                                  C Source Code
                                </div>

                                {message.codeContext}

                              </div>
                            )}
                          </>
                        ) : (

                          /* ASSISTANT MESSAGE */

                          <div className="message-bubble">

                            {/* GENERATING */}

                            {message.isPlaceholder ? (

                              <div className="generating-status">

                                <span className="generating-text">
                                  Generating response
                                </span>

                                <div className="generating-dots">
                                  <div className="generating-dot" />
                                  <div className="generating-dot" />
                                  <div className="generating-dot" />
                                </div>

                              </div>

                            ) : message.error ? (

                              /* ERROR */

                              <div className="error-alert-box">

                                <div className="error-header-row">

                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <line
                                      x1="12"
                                      x2="12"
                                      y1="9"
                                      y2="13"
                                    />
                                    <line
                                      x1="12"
                                      x2="12.01"
                                      y1="17"
                                      y2="17"
                                    />
                                  </svg>

                                  Response Interrupted

                                </div>

                                <div className="error-message-text">
                                  {message.error}
                                </div>

                                <button
                                  type="button"
                                  className="error-retry-btn"
                                  onClick={() =>
                                    handleRetry(
                                      message.retryData
                                        ?.question,
                                      message.retryData
                                        ?.codeContext,
                                      message.id
                                    )
                                  }
                                >

                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.72 2.78L21 8" />
                                    <polyline points="21 3 21 8 16 8" />
                                  </svg>

                                  Retry

                                </button>

                              </div>

                            ) : (

                              /* RESPONSE */

                              <>

                                <ResponseParser
                                  answer={
                                    message.content
                                  }
                                />

                                {/* SOURCES */}

                                {message.sourcesUsed &&
                                  message.sourcesUsed
                                    .length > 0 && (

                                    <div className="sources-box">

                                      <svg
                                        className="sources-icon"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                      >
                                        <circle
                                          cx="12"
                                          cy="12"
                                          r="10"
                                        />
                                        <path d="M12 16v-4" />
                                        <path d="M12 8h.01" />
                                      </svg>

                                      <span className="sources-label">
                                        Sources:
                                      </span>

                                      <span>
                                        {message.sourcesUsed.join(
                                          ', '
                                        )}
                                      </span>

                                    </div>
                                  )}

                                {/* RESPONSE ACTIONS */}

                                <div className="bubble-actions-row">

                                  <button
                                    type="button"
                                    className="bubble-action-btn"
                                    onClick={() =>
                                      handleCopyResponse(
                                        message.content,
                                        message.id
                                      )
                                    }
                                  >

                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <rect
                                        width="14"
                                        height="14"
                                        x="8"
                                        y="8"
                                        rx="2"
                                        ry="2"
                                      />

                                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                    </svg>

                                    {copiedMessageId ===
                                    message.id
                                      ? 'Copied!'
                                      : 'Copy'}

                                  </button>

                                </div>

                              </>
                            )}

                          </div>
                        )}

                      </div>

                      {/* USER AVATAR */}

                      {isUser && (
                        <div className="message-avatar user">

                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle
                              cx="12"
                              cy="7"
                              r="4"
                            />
                          </svg>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

              <div ref={messagesEndRef} />

            </div>
          </div>
        )}

        {/* COMPOSER */}

        <CodeComposer
          onSend={handleSendMessage}
          isGenerating={isGenerating}
        />

      </div>
    </div>
  );
}
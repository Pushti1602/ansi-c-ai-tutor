import React, { useState } from 'react';
import Logo from './Logo';

/**
 * Sidebar component displaying Logo, New Chat action,
 * saved chat history, rename/delete actions, and footer.
 */
export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onNewChat,
  isCollapsed,
  onToggleSidebar
}) {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');

  // Start editing a chat title
  const startRenaming = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditedTitle(chat.title);
  };

  // Save the renamed chat title
  const saveRename = (chatId) => {
    const title = editedTitle.trim();

    if (title && onRenameChat) {
      onRenameChat(chatId, title);
    }

    setEditingChatId(null);
    setEditedTitle('');
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>

      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-title-area">
          <Logo size="small" glow={true} />
          <span className="sidebar-title">ANSI C TUTOR</span>
        </div>

        {/* Collapse Sidebar Button */}
        <button
          type="button"
          className="close-sidebar-btn"
          onClick={onToggleSidebar}
          title="Collapse Sidebar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="new-chat-btn-container">
        <button
          type="button"
          className="new-chat-btn"
          onClick={onNewChat}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" x2="12" y1="5" y2="19" />
            <line x1="5" x2="19" y1="12" y2="12" />
          </svg>

          New Chat
        </button>
      </div>

      {/* Chat History */}
      <div className="sidebar-history">
        <div className="history-section-title">
          Saved Chats
        </div>

        {chats.length === 0 ? (
          <div
            style={{
              padding: '1rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}
          >
            No recent chats
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-history-item ${
                chat.id === activeChatId ? 'active' : ''
              }`}
              onClick={() => {
                if (editingChatId !== chat.id) {
                  onSelectChat(chat.id);
                }
              }}
            >

              {/* Chat Icon + Title */}
              <div className="history-item-content">

                <span className="history-item-icon">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>

                {/* Rename Input OR Normal Title */}
                {editingChatId === chat.id ? (
                  <input
                    type="text"
                    className="history-rename-input"
                    value={editedTitle}
                    autoFocus
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveRename(chat.id);
                      }

                      if (e.key === 'Escape') {
                        setEditingChatId(null);
                        setEditedTitle('');
                      }
                    }}
                    onBlur={() => saveRename(chat.id)}
                  />
                ) : (
                  <span
                    className="history-item-title"
                    title={chat.title}
                  >
                    {chat.title}
                  </span>
                )}

              </div>

              {/* Rename + Delete Actions */}
              <div className="history-item-actions">

                {/* Rename Chat */}
                <button
                  type="button"
                  className="rename-history-btn"
                  onClick={(e) => startRenaming(e, chat)}
                  title="Rename Chat"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>

                {/* Delete Chat */}
                <button
                  type="button"
                  className="delete-history-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  title="Delete Chat"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="3 6 5 6 21 6" />

                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />

                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">

        <div className="avatar">
          C
        </div>

        <div className="user-info">
          <span className="username">
            C Programmer
          </span>

          <span className="user-role">
            Learner
          </span>
        </div>

      </div>

    </aside>
  );
}
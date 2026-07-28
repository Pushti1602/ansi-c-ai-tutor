import React, { useState, useRef, useEffect } from 'react';

/**
 * Message composer for the ANSI C AI Tutor.
 * Supports normal questions and optional C source-code context.
 */
export default function CodeComposer({ onSend, isGenerating }) {
  const [message, setMessage] = useState('');
  const [codeContext, setCodeContext] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const textareaRef = useRef(null);

  // Automatically resize the question box as the user types.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isGenerating) {
      return;
    }

    onSend(
      trimmedMessage,
      showCodeInput ? codeContext : ''
    );

    setMessage('');
    setCodeContext('');
    setShowCodeInput(false);

    textareaRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    // Enter sends. Shift + Enter creates a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="composer-wrapper">
      <div className="composer-container">

        {/* Optional C source-code attachment */}
        {showCodeInput && (
          <div className="code-context-composer-pane">

            <div className="code-context-pane-header">
              <span className="code-context-pane-title">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>

                C Source Code
              </span>

              <button
                type="button"
                className="remove-code-btn"
                onClick={() => {
                  setShowCodeInput(false);
                  setCodeContext('');
                }}
                title="Remove code"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>

                Remove
              </button>
            </div>

            <textarea
              className="code-context-textarea"
              placeholder="Paste your C code here..."
              value={codeContext}
              onChange={(event) => setCodeContext(event.target.value)}
            />
          </div>
        )}

        {/* Main question input */}
        <div className="composer-input-row">

          <button
            type="button"
            className={`composer-action-btn ${
              showCodeInput ? 'active' : ''
            }`}
            onClick={() => setShowCodeInput(!showCodeInput)}
            title="Add C source code"
            aria-label="Add C source code"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            className="composer-textarea"
            placeholder="Ask anything about ANSI C..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />

          <div className="composer-actions">
            <button
              type="button"
              className="send-message-btn"
              onClick={handleSend}
              disabled={!message.trim() || isGenerating}
              title="Send message"
              aria-label="Send message"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="22" x2="11" y1="2" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

        </div>
      </div>

      <div className="composer-disclaimer">
        Ask questions, understand concepts, debug code, or learn ANSI C step by step.
      </div>
    </div>
  );
}
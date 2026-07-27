import React, { useState, useRef, useEffect } from 'react';

/**
 * CodeComposer component.
 * Handles the message input, optional C code context container, Shift+Enter newlines, and sends.
 */
export default function CodeComposer({ onSend, isGenerating }) {
  const [message, setMessage] = useState('');
  const [codeContext, setCodeContext] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize the prompt textarea based on content length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isGenerating) return;

    onSend(trimmedMessage, showCodeInput ? codeContext : '');
    
    // Clear inputs on success
    setMessage('');
    setCodeContext('');
    setShowCodeInput(false);
    
    // Focus back on text area
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Enter sends message, Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="composer-wrapper">
      <div className="composer-container">
        {/* Optional code context input drawer */}
        {showCodeInput && (
          <div className="code-context-composer-pane">
            <div className="code-context-pane-header">
              <span className="code-context-pane-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                ANSI C Source Context
              </span>
              <button 
                type="button" 
                className="remove-code-btn" 
                onClick={() => {
                  setShowCodeInput(false);
                  setCodeContext('');
                }}
                title="Remove Code Context"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                Remove
              </button>
            </div>
            <textarea
              className="code-context-textarea"
              placeholder="/* Paste C code here (e.g. variable declarations, pointers) to ground your question */"
              value={codeContext}
              onChange={(e) => setCodeContext(e.target.value)}
            />
          </div>
        )}

        {/* Primary composer text row */}
        <div className="composer-input-row">
          {/* Add Code control button */}
          <button
            type="button"
            className={`composer-action-btn ${showCodeInput ? 'active' : ''}`}
            onClick={() => setShowCodeInput(!showCodeInput)}
            title="Attach C Source Code Context"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>

          {/* Prompt textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            className="composer-textarea"
            placeholder="Ask a question about strict ANSI C (C89)..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />

          <div className="composer-actions">
            {/* Submit button */}
            <button
              type="button"
              className="send-message-btn"
              onClick={handleSend}
              disabled={!message.trim() || isGenerating}
              title="Send Message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div className="composer-disclaimer">
        ANSI C Tutor references the ISO C89/C90 standard. Ask about pointer arithmetic, memory allocation, or syntax rules.
      </div>
    </div>
  );
}

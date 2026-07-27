import React from 'react';
import Logo from './Logo';

/**
 * WelcomeScreen component displayed when there are no active messages in a conversation.
 * Showcases tutor description and suggestions for rapid interaction.
 */
export default function WelcomeScreen({ onSelectSuggestion }) {
  const suggestions = [
    "Explain pointers with an example",
    "Teach me dynamic memory allocation",
    "How does file handling work in C?",
    "Explain structures and unions"
  ];

  return (
    <div className="welcome-container">
      {/* Glowing Logo Wrap */}
      <div className="welcome-logo-wrapper">
        <Logo size="large" glow={true} />
      </div>

      {/* Hero Title & Subtitle */}
      <h1 className="welcome-title">ANSI C AI Tutor</h1>
      <p className="welcome-tagline">
        Learn C. Understand the standard. Write better code. Grounded in C89/C90 compliance vector stores.
      </p>

      {/* Suggested Quick Prompts Grid */}
      <div className="suggestions-grid">
        {suggestions.map((text, idx) => (
          <button
            key={idx}
            type="button"
            className="suggestion-card"
            onClick={() => onSelectSuggestion(text)}
          >
            <span className="suggestion-text">{text}</span>
            <span className="suggestion-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

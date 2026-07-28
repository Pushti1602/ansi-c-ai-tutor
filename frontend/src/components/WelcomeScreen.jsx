import React from 'react';
import Logo from './Logo';

/**
 * Welcome screen shown when there is no active conversation.
 */
export default function WelcomeScreen() {
  return (
    <div className="welcome-container">
      <div className="welcome-logo-wrapper">
        <Logo size="large" glow={true} />
      </div>

      <h1 className="welcome-title">ANSI C AI TUTOR</h1>

      <p className="welcome-tagline">
        Your AI-powered guide to understanding C, from fundamentals to advanced concepts.
      </p>
    </div>
  );
}